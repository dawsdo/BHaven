import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const app = express();
app.use(express.json());

const HOLD_MINUTES = [15, 30, 45];

// Every host row comes back with how many beds are tied up in live holds.
const HOST_SQL = `
  SELECT h.*,
         COALESCE((SELECT SUM(people) FROM holds
                    WHERE host_id = h.id AND status = 'held' AND expires_at > @now), 0) AS beds_held
    FROM hosts h`;
const listHosts = db.prepare(`${HOST_SQL} WHERE h.verified = 1 OR @all = 1 ORDER BY h.name`);
const getHost = db.prepare(`${HOST_SQL} WHERE h.id = @id`);

function shape(h) {
  return {
    id: h.id,
    name: h.name,
    type: h.type,
    address: h.address,
    lat: h.lat,
    lng: h.lng,
    takes_men: !!h.takes_men,
    takes_women: !!h.takes_women,
    takes_family: !!h.takes_family,
    step_free: !!h.step_free,
    pets: !!h.pets,
    accepting: !!h.accepting,
    verified: !!h.verified,
    note: h.note,
    beds_open: h.beds_open,
    beds_held: h.beds_held,
    beds_available: h.accepting ? Math.max(0, h.beds_open - h.beds_held) : 0,
    updated_at: h.updated_at
  };
}

app.get('/api/hosts', (req, res) => {
  const all = req.query.all === '1' ? 1 : 0;
  res.json(listHosts.all({ now: Date.now(), all }).map(shape));
});

app.get('/api/hosts/:id', (req, res) => {
  const h = getHost.get({ id: Number(req.params.id), now: Date.now() });
  if (!h) return res.status(404).json({ error: 'Host not found' });
  res.json(shape(h));
});

// Host updates its own count. Sending an empty body just confirms the count is still right.
const updateHost = db.prepare(`
  UPDATE hosts
     SET beds_open = COALESCE(@beds_open, beds_open),
         accepting = COALESCE(@accepting, accepting),
         updated_at = @now
   WHERE id = @id`);

app.patch('/api/hosts/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  let beds_open = null;
  if (body.beds_open !== undefined) {
    beds_open = Number(body.beds_open);
    if (!Number.isInteger(beds_open) || beds_open < 0 || beds_open > 500) {
      return res.status(400).json({ error: 'beds_open must be a whole number from 0 to 500' });
    }
  }
  const accepting = body.accepting === undefined ? null : body.accepting ? 1 : 0;
  const now = Date.now();
  const out = updateHost.run({ id, beds_open, accepting, now });
  if (out.changes === 0) return res.status(404).json({ error: 'Host not found' });
  res.json(shape(getHost.get({ id, now })));
});

// Holds
const insertHold = db.prepare(`
  INSERT INTO holds (host_id, code, people, status, created_at, expires_at)
  VALUES (@host_id, @code, @people, 'held', @now, @expires_at)`);
const codeTaken = db.prepare('SELECT 1 FROM holds WHERE code = ?');
const getHold = db.prepare('SELECT * FROM holds WHERE code = ?');
const hostHolds = db.prepare(`
  SELECT code, people, status, created_at, expires_at FROM holds
   WHERE host_id = @id AND status = 'held' AND expires_at > @now
   ORDER BY expires_at`);
const setHoldStatus = db.prepare('UPDATE holds SET status = @status WHERE code = @code');
const takeBeds = db.prepare(
  'UPDATE hosts SET beds_open = MAX(0, beds_open - @people), updated_at = @now WHERE id = @id');

function newCode() {
  for (;;) {
    const code = 'BHM-' + String(Math.floor(1000 + Math.random() * 9000));
    if (!codeTaken.get(code)) return code;
  }
}

const createHold = db.transaction(({ host_id, people, minutes }) => {
  const now = Date.now();
  const h = getHost.get({ id: host_id, now });
  if (!h) return { status: 404, body: { error: 'Host not found' } };
  const host = shape(h);
  if (host.beds_available < people) {
    return { status: 409, body: { error: 'Not enough beds open', beds_available: host.beds_available } };
  }
  const hold = { host_id, code: newCode(), people, now, expires_at: now + minutes * 60000 };
  insertHold.run(hold);
  return {
    status: 201,
    body: { code: hold.code, host_id, people, status: 'held', expires_at: hold.expires_at }
  };
});

app.post('/api/holds', (req, res) => {
  const body = req.body ?? {};
  const host_id = Number(body.host_id);
  const people = Number(body.people);
  const minutes = HOLD_MINUTES.includes(Number(body.minutes)) ? Number(body.minutes) : 45;
  if (!Number.isInteger(people) || people < 1 || people > 9) {
    return res.status(400).json({ error: 'people must be a whole number from 1 to 9' });
  }
  const out = createHold({ host_id, people, minutes });
  res.status(out.status).json(out.body);
});

app.get('/api/hosts/:id/holds', (req, res) => {
  res.json(hostHolds.all({ id: Number(req.params.id), now: Date.now() }));
});

app.post('/api/holds/:code/release', (req, res) => {
  const hold = getHold.get(req.params.code);
  if (!hold) return res.status(404).json({ error: 'Hold not found' });
  if (hold.status === 'held') setHoldStatus.run({ code: hold.code, status: 'released' });
  res.json({ code: hold.code, status: hold.status === 'held' ? 'released' : hold.status });
});

// The host checks the group in: the hold closes and those beds leave the open count.
const arrive = db.transaction((code) => {
  const hold = getHold.get(code);
  if (!hold) return { status: 404, body: { error: 'Hold not found' } };
  if (hold.status !== 'held') return { status: 409, body: { error: 'Hold is already ' + hold.status } };
  setHoldStatus.run({ code, status: 'arrived' });
  takeBeds.run({ id: hold.host_id, people: hold.people, now: Date.now() });
  return { status: 200, body: { code, status: 'arrived' } };
});

app.post('/api/holds/:code/arrive', (req, res) => {
  const out = arrive(req.params.code);
  res.status(out.status).json(out.body);
});

// In production (npm run build, then npm start) this server also serves the React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, pool } from './db.js';

const app = express();
app.use(express.json());

const HOLD_MINUTES = [15, 30, 45];

// Express 4 does not catch errors from async handlers, so wrap each one.
const route = (fn) => (req, res, next) => fn(req, res).catch(next);

// Host ids in the URL must be whole numbers; anything else is a 404, not a database error.
app.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'Host not found' });
  next();
});

// Every host row comes back with how many beds are tied up in live holds.
const HOST_SQL = `
  SELECT h.*,
         (SELECT COALESCE(SUM(people), 0) FROM holds
           WHERE host_id = h.id AND status = 'held' AND expires_at > ?) AS beds_held
    FROM hosts h`;

function shape(h) {
  const beds_held = Number(h.beds_held);
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
    beds_held,
    beds_available: h.accepting ? Math.max(0, h.beds_open - beds_held) : 0,
    updated_at: Number(h.updated_at)
  };
}

// `db` is the pool, or a single connection when inside a transaction.
async function findHost(db, id, { lock = false } = {}) {
  const [rows] = await db.query(`${HOST_SQL} WHERE h.id = ?${lock ? ' FOR UPDATE' : ''}`, [Date.now(), id]);
  return rows[0] ? shape(rows[0]) : null;
}

app.get(
  '/api/hosts',
  route(async (req, res) => {
    const where = req.query.all === '1' ? '' : ' WHERE h.verified = 1';
    const [rows] = await pool.query(`${HOST_SQL}${where} ORDER BY h.name`, [Date.now()]);
    res.json(rows.map(shape));
  })
);

app.get(
  '/api/hosts/:id',
  route(async (req, res) => {
    const host = await findHost(pool, Number(req.params.id));
    if (!host) return res.status(404).json({ error: 'Host not found' });
    res.json(host);
  })
);

// Host updates its own count. Sending an empty body just confirms the count is still right.
app.patch(
  '/api/hosts/:id',
  route(async (req, res) => {
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
    await pool.query(
      `UPDATE hosts
          SET beds_open = COALESCE(?, beds_open),
              accepting = COALESCE(?, accepting),
              updated_at = ?
        WHERE id = ?`,
      [beds_open, accepting, Date.now(), id]
    );
    const host = await findHost(pool, id);
    if (!host) return res.status(404).json({ error: 'Host not found' });
    res.json(host);
  })
);

// Runs `work` inside a transaction on one connection, rolling back if it throws.
async function inTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await work(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function newCode(conn) {
  for (;;) {
    const code = 'BHM-' + String(Math.floor(1000 + Math.random() * 9000));
    const [rows] = await conn.query('SELECT 1 FROM holds WHERE code = ?', [code]);
    if (rows.length === 0) return code;
  }
}

app.post(
  '/api/holds',
  route(async (req, res) => {
    const body = req.body ?? {};
    const host_id = Number(body.host_id);
    const people = Number(body.people);
    const minutes = HOLD_MINUTES.includes(Number(body.minutes)) ? Number(body.minutes) : 45;
    if (!Number.isInteger(people) || people < 1 || people > 9) {
      return res.status(400).json({ error: 'people must be a whole number from 1 to 9' });
    }

    const out = await inTransaction(async (conn) => {
      // Locking the host row makes two people holding the last bed take turns.
      const host = await findHost(conn, host_id, { lock: true });
      if (!host) return { status: 404, body: { error: 'Host not found' } };
      if (host.beds_available < people) {
        return { status: 409, body: { error: 'Not enough beds open', beds_available: host.beds_available } };
      }
      const now = Date.now();
      const code = await newCode(conn);
      const expires_at = now + minutes * 60000;
      await conn.query(
        `INSERT INTO holds (host_id, code, people, status, created_at, expires_at)
         VALUES (?, ?, ?, 'held', ?, ?)`,
        [host_id, code, people, now, expires_at]
      );
      return { status: 201, body: { code, host_id, people, status: 'held', expires_at } };
    });
    res.status(out.status).json(out.body);
  })
);

app.get(
  '/api/hosts/:id/holds',
  route(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT code, people, status, created_at, expires_at FROM holds
        WHERE host_id = ? AND status = 'held' AND expires_at > ?
        ORDER BY expires_at`,
      [Number(req.params.id), Date.now()]
    );
    res.json(rows.map((r) => ({ ...r, created_at: Number(r.created_at), expires_at: Number(r.expires_at) })));
  })
);

app.post(
  '/api/holds/:code/release',
  route(async (req, res) => {
    const [rows] = await pool.query('SELECT code, status FROM holds WHERE code = ?', [req.params.code]);
    const hold = rows[0];
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    if (hold.status === 'held') {
      await pool.query("UPDATE holds SET status = 'released' WHERE code = ? AND status = 'held'", [hold.code]);
    }
    res.json({ code: hold.code, status: hold.status === 'held' ? 'released' : hold.status });
  })
);

// The host checks the group in: the hold closes and those beds leave the open count.
app.post(
  '/api/holds/:code/arrive',
  route(async (req, res) => {
    const out = await inTransaction(async (conn) => {
      const [rows] = await conn.query('SELECT * FROM holds WHERE code = ? FOR UPDATE', [req.params.code]);
      const hold = rows[0];
      if (!hold) return { status: 404, body: { error: 'Hold not found' } };
      if (hold.status !== 'held') return { status: 409, body: { error: 'Hold is already ' + hold.status } };
      await conn.query("UPDATE holds SET status = 'arrived' WHERE id = ?", [hold.id]);
      await conn.query(
        'UPDATE hosts SET beds_open = GREATEST(0, beds_open - ?), updated_at = ? WHERE id = ?',
        [hold.people, Date.now(), hold.host_id]
      );
      return { status: 200, body: { code: hold.code, status: 'arrived' } };
    });
    res.status(out.status).json(out.body);
  })
);

// In production (npm run build, then npm start) this server also serves the React app.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT) || 3001;
try {
  await initDb();
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
} catch (err) {
  console.error('\nCould not connect to MySQL:', err.message);
  console.error('Check that MySQL is running and that .env has the right user and password.\n');
  process.exit(1);
}

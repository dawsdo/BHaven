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
  if (!/^\d{1,9}$/.test(id)) return res.status(404).json({ error: 'Host not found' });
  next();
});

// Every host row comes back with how many beds are tied up in live holds ($1 is "now").
const HOST_SQL = `
  SELECT h.*,
         (SELECT COALESCE(SUM(people), 0) FROM holds
           WHERE host_id = h.id AND status = 'held' AND expires_at > $1) AS beds_held
    FROM hosts h`;

// PostgreSQL returns BIGINT and SUM() as strings, so numbers are converted here.
function shape(h) {
  const beds_held = Number(h.beds_held);
  return {
    id: h.id,
    name: h.name,
    type: h.type,
    address: h.address,
    lat: h.lat,
    lng: h.lng,
    takes_men: h.takes_men,
    takes_women: h.takes_women,
    takes_women_children: h.takes_women_children,
    takes_families: h.takes_families,
    takes_youth: h.takes_youth,
    youth_max_age: h.youth_max_age,
    step_free: h.step_free,
    pets: h.pets,
    accepting: h.accepting,
    verified: h.verified,
    note: h.note,
    beds_open: h.beds_open,
    beds_held,
    beds_available: h.accepting ? Math.max(0, h.beds_open - beds_held) : 0,
    updated_at: Number(h.updated_at)
  };
}

// `db` is the pool, or a single client when inside a transaction.
async function findHost(db, id, { lock = false } = {}) {
  // Take the row lock in its own statement first. The count below must run as a new
  // statement so it sees holds committed while this request was waiting for the lock.
  if (lock) await db.query('SELECT id FROM hosts WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query(`${HOST_SQL} WHERE h.id = $2`, [Date.now(), id]);
  return rows[0] ? shape(rows[0]) : null;
}

app.get(
  '/api/hosts',
  route(async (req, res) => {
    const where = req.query.all === '1' ? '' : ' WHERE h.verified';
    const { rows } = await pool.query(`${HOST_SQL}${where} ORDER BY h.name`, [Date.now()]);
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
    const accepting = body.accepting === undefined ? null : !!body.accepting;
    await pool.query(
      `UPDATE hosts
          SET beds_open = COALESCE($1::int, beds_open),
              accepting = COALESCE($2::boolean, accepting),
              updated_at = $3
        WHERE id = $4`,
      [beds_open, accepting, Date.now(), id]
    );
    const host = await findHost(pool, id);
    if (!host) return res.status(404).json({ error: 'Host not found' });
    res.json(host);
  })
);

// Runs `work` inside a transaction on one client, rolling back if it throws.
async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await work(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function newCode(client) {
  for (;;) {
    const code = 'BHM-' + String(Math.floor(1000 + Math.random() * 9000));
    const found = await client.query('SELECT 1 FROM holds WHERE code = $1', [code]);
    if (found.rowCount === 0) return code;
  }
}

app.post(
  '/api/holds',
  route(async (req, res) => {
    const body = req.body ?? {};
    const host_id = Number(body.host_id);
    const people = Number(body.people);
    const minutes = HOLD_MINUTES.includes(Number(body.minutes)) ? Number(body.minutes) : 45;
    if (!Number.isInteger(host_id) || host_id < 1) {
      return res.status(404).json({ error: 'Host not found' });
    }
    if (!Number.isInteger(people) || people < 1 || people > 9) {
      return res.status(400).json({ error: 'people must be a whole number from 1 to 9' });
    }

    const out = await inTransaction(async (client) => {
      // Locking the host row makes two people holding the last bed take turns.
      const host = await findHost(client, host_id, { lock: true });
      if (!host) return { status: 404, body: { error: 'Host not found' } };
      if (host.beds_available < people) {
        return { status: 409, body: { error: 'Not enough beds open', beds_available: host.beds_available } };
      }
      const now = Date.now();
      const code = await newCode(client);
      const expires_at = now + minutes * 60000;
      await client.query(
        `INSERT INTO holds (host_id, code, people, status, created_at, expires_at)
         VALUES ($1, $2, $3, 'held', $4, $5)`,
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
    const { rows } = await pool.query(
      `SELECT code, people, status, created_at, expires_at FROM holds
        WHERE host_id = $1 AND status = 'held' AND expires_at > $2
        ORDER BY expires_at`,
      [Number(req.params.id), Date.now()]
    );
    res.json(rows.map((r) => ({ ...r, created_at: Number(r.created_at), expires_at: Number(r.expires_at) })));
  })
);

app.post(
  '/api/holds/:code/release',
  route(async (req, res) => {
    const { rows } = await pool.query('SELECT code, status FROM holds WHERE code = $1', [req.params.code]);
    const hold = rows[0];
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    if (hold.status === 'held') {
      await pool.query("UPDATE holds SET status = 'released' WHERE code = $1 AND status = 'held'", [hold.code]);
    }
    res.json({ code: hold.code, status: hold.status === 'held' ? 'released' : hold.status });
  })
);

// The host checks the group in: the hold closes and those beds leave the open count.
app.post(
  '/api/holds/:code/arrive',
  route(async (req, res) => {
    const out = await inTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM holds WHERE code = $1 FOR UPDATE', [req.params.code]);
      const hold = rows[0];
      if (!hold) return { status: 404, body: { error: 'Hold not found' } };
      if (hold.status !== 'held') return { status: 409, body: { error: 'Hold is already ' + hold.status } };
      await client.query("UPDATE holds SET status = 'arrived' WHERE id = $1", [hold.id]);
      await client.query(
        'UPDATE hosts SET beds_open = GREATEST(0, beds_open - $1), updated_at = $2 WHERE id = $3',
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
  console.error('\nCould not connect to PostgreSQL:', err.code || '', err.message || '');
  console.error('Check that PostgreSQL is running and that .env has the right user and password.\n');
  process.exit(1);
}

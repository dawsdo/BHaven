import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, pool } from './db.js';
import { makeToken, passwordMatches, requireStaff } from './auth.js';

const app = express();
app.use(express.json());
// No request logging on purpose: nothing about who is searching should be stored.

const HOLD_MINUTES = [15, 30, 45];
const MAX_OPEN = 999;
// Counts nobody has confirmed in 24 hours are withheld here, so no page can show them.
const EXPIRY_MS = 24 * 60 * 60000;

// Express 4 does not catch errors from async handlers, so wrap each one.
const route = (fn) => (req, res, next) => fn(req, res).catch(next);

// Host ids in the URL must be whole numbers; anything else is a 404, not a database error.
app.param('id', (req, res, next, id) => {
  if (!/^\d{1,9}$/.test(id)) return res.status(404).json({ error: 'Host not found' });
  next();
});

// Staff may only act on the host their account belongs to.
function ownHost(req, res, next) {
  if (Number(req.params.id) !== req.staff.hostId) {
    return res.status(403).json({ error: 'You can only manage your own place.' });
  }
  next();
}

// Every host row comes back with its bed counts and how much of each is tied up in live
// holds ($1 is "now").
const HOST_SQL = `
  SELECT h.*,
         (SELECT COALESCE(json_agg(json_build_object(
                   'id', c.id, 'kind', c.kind, 'open', c.beds_open, 'capacity', c.capacity,
                   'held', (SELECT COALESCE(SUM(beds), 0) FROM holds
                             WHERE count_id = c.id AND status = 'held' AND expires_at > $1)
                 ) ORDER BY array_position(ARRAY['men', 'women', 'family', 'youth', 'any'], c.kind)), '[]'::json)
            FROM bed_counts c WHERE c.host_id = h.id) AS counts
    FROM hosts h`;

// PostgreSQL returns BIGINT as a string, so numbers are converted here.
//
// Two things are withheld here rather than in the browser, so that no client can
// render them by mistake:
//
//   1. Counts nobody has confirmed in 24 hours. A stale number is worse than no number:
//      someone acts on it and drives across town to a full shelter. Staff still see
//      their own, because it is the record they are about to correct.
//   2. The location of a confidential host. Domestic violence shelters keep their
//      locations private by design; the address and coordinates never leave here.
function shape(h, { forStaff = false } = {}) {
  const updated_at = Number(h.updated_at);
  const expired = Date.now() - updated_at > EXPIRY_MS;
  const counts = h.counts.map((c) => ({ ...c, available: h.accepting ? Math.max(0, c.open - c.held) : 0 }));
  const withheld = expired && !forStaff;
  const confidential = h.address_confidential;
  return {
    id: h.id,
    name: h.name,
    type: h.type,
    address: confidential ? null : h.address,
    address_confidential: confidential,
    phone: h.phone,
    lat: confidential ? null : h.lat,
    lng: confidential ? null : h.lng,
    takes_men: h.takes_men,
    takes_women: h.takes_women,
    takes_women_children: h.takes_women_children,
    takes_families: h.takes_families,
    takes_youth: h.takes_youth,
    youth_max_age: h.youth_max_age,
    step_free: h.step_free,
    pets: h.pets,
    languages: h.languages,
    accepting: h.accepting,
    verified: h.verified,
    note: h.note,
    updated_at,
    expired,
    counts: withheld ? null : counts,
    beds_available: withheld ? null : counts.reduce((sum, c) => sum + c.available, 0)
  };
}

// `db` is the pool, or a single client when inside a transaction.
async function findHost(db, id, { lock = false, forStaff = false } = {}) {
  // Take the row lock in its own statement first. The count below must run as a new
  // statement so it sees holds committed while this request was waiting for the lock.
  if (lock) await db.query('SELECT id FROM hosts WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query(`${HOST_SQL} WHERE h.id = $2`, [Date.now(), id]);
  return rows[0] ? shape(rows[0], { forStaff }) : null;
}

app.get(
  '/api/hosts',
  route(async (req, res) => {
    const { rows } = await pool.query(`${HOST_SQL} WHERE h.verified ORDER BY h.name`, [Date.now()]);
    res.json(rows.map((row) => shape(row)));
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

// Where a ZIP code is, so the browser can sort the list by distance from it.
app.get(
  '/api/zips/:zip',
  route(async (req, res) => {
    const { zip } = req.params;
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP code.' });
    const { rows } = await pool.query('SELECT zip, city, lat, lng FROM zip_codes WHERE zip = $1', [zip]);
    if (!rows[0]) {
      return res.status(404).json({
        error: `We don't have ZIP code ${zip} yet. This demo covers Birmingham, AL (for example 35203).`
      });
    }
    res.json({ zip, label: `${rows[0].city} ${zip}`, lat: rows[0].lat, lng: rows[0].lng });
  })
);

app.post(
  '/api/auth/login',
  route(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    const { rows } = await pool.query('SELECT id, host_id, password_hash FROM staff_users WHERE email = $1', [
      email.trim().toLowerCase()
    ]);
    const staff = rows[0];
    if (!staff || !(await passwordMatches(password, staff.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    res.json({ token: makeToken({ staffId: staff.id, hostId: staff.host_id }) });
  })
);

// The signed-in staff member's own host, with its counts even when they have expired.
app.get(
  '/api/staff/host',
  requireStaff,
  route(async (req, res) => {
    const host = await findHost(pool, req.staff.hostId, { forStaff: true });
    if (!host) return res.status(404).json({ error: 'Your place was not found. Sign in again.' });
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

// Staff update their own counts. Any save, even an empty body, confirms every count is
// still right and restarts the 24-hour clock.
app.patch(
  '/api/hosts/:id',
  requireStaff,
  ownHost,
  route(async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body ?? {};
    const changes = body.counts ?? [];
    const valid =
      Array.isArray(changes) &&
      changes.every((c) => Number.isInteger(c?.id) && Number.isInteger(c?.open) && c.open >= 0 && c.open <= MAX_OPEN);
    if (!valid) {
      return res.status(400).json({ error: `Each count needs an id and a whole number from 0 to ${MAX_OPEN}.` });
    }
    const accepting = body.accepting === undefined ? null : !!body.accepting;

    const out = await inTransaction(async (client) => {
      const host = await findHost(client, id, { lock: true, forStaff: true });
      if (!host) return { status: 404, body: { error: 'Host not found' } };
      if (!host.verified) {
        return { status: 403, body: { error: 'This place is not approved to post counts yet.' } };
      }
      for (const change of changes) {
        const count = host.counts.find((c) => c.id === change.id);
        if (!count) return { status: 400, body: { error: 'This place has no such bed count.' } };
        if (count.capacity !== null && change.open > count.capacity) {
          return {
            status: 400,
            body: { error: `That count can't be more than ${count.capacity}, the total for this place.` }
          };
        }
      }
      for (const change of changes) {
        await client.query('UPDATE bed_counts SET beds_open = $1 WHERE id = $2', [change.open, change.id]);
      }
      await client.query(
        'UPDATE hosts SET accepting = COALESCE($1::boolean, accepting), updated_at = $2 WHERE id = $3',
        [accepting, Date.now(), id]
      );
      return { status: 200, body: await findHost(client, id, { forStaff: true }) };
    });
    res.status(out.status).json(out.body);
  })
);

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
    const count_id = Number(body.count_id);
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
      if (!host.counts) return { status: 409, body: { error: 'No recent update. Call to confirm.' } };
      const count = host.counts.find((c) => c.id === count_id);
      if (!count) return { status: 400, body: { error: 'Choose which kind of bed to hold.' } };
      // A family room is held whole. Every other kind is held one bed per person.
      const beds = count.kind === 'family' ? 1 : people;
      if (count.available < beds) {
        return { status: 409, body: { error: 'Not enough beds open', beds_available: count.available } };
      }
      const now = Date.now();
      const code = await newCode(client);
      const expires_at = now + minutes * 60000;
      await client.query(
        `INSERT INTO holds (count_id, code, people, beds, status, created_at, expires_at)
         VALUES ($1, $2, $3, $4, 'held', $5, $6)`,
        [count_id, code, people, beds, now, expires_at]
      );
      return {
        status: 201,
        body: { code, host_id, count_id, kind: count.kind, people, beds, status: 'held', expires_at }
      };
    });
    res.status(out.status).json(out.body);
  })
);

app.get(
  '/api/hosts/:id/holds',
  requireStaff,
  ownHost,
  route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ho.code, ho.people, ho.beds, c.kind, ho.status, ho.created_at, ho.expires_at
         FROM holds ho JOIN bed_counts c ON c.id = ho.count_id
        WHERE c.host_id = $1 AND ho.status = 'held' AND ho.expires_at > $2
        ORDER BY ho.expires_at`,
      [Number(req.params.id), Date.now()]
    );
    res.json(rows.map((r) => ({ ...r, created_at: Number(r.created_at), expires_at: Number(r.expires_at) })));
  })
);

// Anyone holding the code can cancel: the code is all the person who made the hold has.
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

// Staff check the group in: the hold closes and those beds leave the open count.
app.post(
  '/api/holds/:code/arrive',
  requireStaff,
  route(async (req, res) => {
    const out = await inTransaction(async (client) => {
      const { rows } = await client.query(
        `SELECT ho.*, c.host_id FROM holds ho JOIN bed_counts c ON c.id = ho.count_id
          WHERE ho.code = $1 FOR UPDATE OF ho`,
        [req.params.code]
      );
      const hold = rows[0];
      // A hold at someone else's host is reported as missing, so codes cannot be probed.
      if (!hold || hold.host_id !== req.staff.hostId) return { status: 404, body: { error: 'Hold not found' } };
      if (hold.status !== 'held') return { status: 409, body: { error: 'Hold is already ' + hold.status } };
      await client.query("UPDATE holds SET status = 'arrived' WHERE id = $1", [hold.id]);
      // Host row before count row, the same order a count update locks them in.
      await client.query('UPDATE hosts SET updated_at = $1 WHERE id = $2', [Date.now(), hold.host_id]);
      await client.query('UPDATE bed_counts SET beds_open = GREATEST(0, beds_open - $1) WHERE id = $2', [
        hold.beds,
        hold.count_id
      ]);
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

const DB_DOWN = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '57P03'];

app.use((err, req, res, next) => {
  console.error(err);
  if (DB_DOWN.includes(err.code)) {
    return res.status(503).json({ error: 'Shelter data is unavailable right now. Try again in a moment.' });
  }
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT) || 3001;
try {
  await initDb();
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
} catch (err) {
  if (['42703', '42P01'].includes(err.code)) {
    // Undefined column or table: the tables were made by an older version of schema.sql.
    console.error('\nThe database has tables from an older version of this app:', err.message);
    console.error('Rebuild them (this replaces the demo data) with: npm run reset-db\n');
  } else {
    console.error('\nCould not connect to PostgreSQL:', err.code || '', err.message || '');
    console.error('Check that PostgreSQL is running and that .env has the right user and password.\n');
  }
  process.exit(1);
}

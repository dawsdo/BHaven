// Loads data/organizations_seed.csv (2025 HUD Housing Inventory Count, CoC AL-500)
// into the database: one host per program, a bed count per kind of bed, and one demo
// staff account each. This file is the list of places; initDb() runs it when the
// hosts table is empty, and `npm run reset-db` rebuilds from it.
//
// Two things this deliberately does NOT do:
//
//   1. It never invents a vacancy. The HIC counts funded inventory, taken one night
//      in late January. It says nothing about who has a bed free tonight, and nobody
//      publishes that — it is the gap this project exists to fill. So every count loads
//      with beds_open = 0 and a reported time old enough to be withheld. The app opens
//      showing dashes and "Call to confirm" until a real host reports a real number.
//      Seeding the HUD total as though it were vacancy would manufacture exactly the
//      fake availability this project was built to argue against.
//
//   2. It never writes an address or coordinates for a confidential host, even if they
//      are present in the source file. A database CHECK enforces the same rule underneath.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(here, '..', 'data', 'organizations_seed.csv');

// Old enough that the API withholds the count (see EXPIRY_MS in index.js). Not a real report.
const NEVER_REPORTED_MS = Date.now() - 72 * 60 * 60 * 1000;

// Minimal RFC-4180 parser: handles quoted fields and embedded commas, which the
// address and notes columns both use.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// '{women,children}' -> ['women', 'children']
const popList = (s) =>
  (s || '').replace(/^\{|\}$/g, '').split(',').map((p) => p.trim().replace(/^"|"$/g, '')).filter(Boolean);

// The source records populations as a free-form set; this schema records who a host
// takes as five booleans. The mapping is deliberately conservative: where the source
// is ambiguous the flags under-claim, because a wrong 'yes' sends someone to a place
// that will turn them away, and a wrong 'no' only means they call to check.
//
//   'adults' / 'veterans' -> single men and single women. Neither is a gender, and
//   this schema has no veterans flag, so eligibility goes in the note instead and the
//   responder confirms it on the phone. Worth revisiting with a real takes_veterans
//   column if these programs matter to the demo.
function flags(pops) {
  const has = (p) => pops.includes(p);
  const adultsAny = has('adults') || has('veterans');
  return {
    takes_men: has('men') || adultsAny,
    takes_women: has('women') || adultsAny,
    takes_women_children: has('women') && has('children'),
    takes_families: has('families'),
    takes_youth: has('youth')
  };
}

// Which kinds of bed a program has, each with its total.
//
// The bed_kinds column says so outright where a program has more than one kind, or
// counts family rooms rather than beds: 'women:8;family:5'. Otherwise the program is
// one count holding all of total_beds, of the single kind its populations point to,
// or 'any' when they point to more than one. 'any' is counted in beds, one per person.
function bedCounts(row, pops) {
  if (row.bed_kinds) {
    return row.bed_kinds.split(';').map((part) => {
      const [kind, capacity] = part.split(':');
      return { kind: kind.trim(), capacity: Number(capacity) };
    });
  }
  const only = (...allowed) => pops.length > 0 && pops.every((p) => allowed.includes(p));
  const kind = only('men') ? 'men' : only('women', 'children') ? 'women' : only('youth') ? 'youth' : 'any';
  return [{ kind, capacity: row.total_beds ? Number(row.total_beds) : null }];
}

function noteFor(row, pops) {
  const parts = [];
  if (pops.includes('veterans')) parts.push('Veterans program — confirm eligibility');
  if (row.notes) parts.push(row.notes);
  if (row.status && /NOT FOUND|verify|confirm|call before/i.test(row.status)) {
    parts.push('Unverified: ' + row.status);
  }
  return parts.join('. ');
}

// `pool` is the pg pool. Everything loads in one transaction, so a failure part-way
// leaves the tables empty and the next start tries again.
export async function loadHic(pool) {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  if (!rows.length) throw new Error('No rows found in ' + CSV);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let confidential = 0;

    for (const row of rows) {
      const pops = popList(row.populations);
      const f = flags(pops);
      const isConfidential = String(row.address_confidential).toLowerCase() === 'true';
      // Combine org and facility: four Salvation Army programs share one org name.
      const name = row.facility_name && row.facility_name !== row.name
        ? `${row.name} — ${row.facility_name}`
        : row.name;
      // Never store where a confidential host is, whatever the file says.
      const place = (value) => (isConfidential || value === '' ? null : value);

      const host = await client.query(
        `INSERT INTO hosts
           (name, type, address, address_confidential, phone, lat, lng,
            takes_men, takes_women, takes_women_children, takes_families, takes_youth,
            pets, accepting, verified, note, updated_at)
         VALUES ($1,'shelter',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,TRUE,$13,$14)
         RETURNING id`,
        [
          name,
          place(row.address),
          isConfidential,
          row.phone || null,
          place(row.lat),
          place(row.lng),
          f.takes_men,
          f.takes_women,
          f.takes_women_children,
          f.takes_families,
          f.takes_youth,
          String(row.pets_allowed).toLowerCase() === 'true',
          noteFor(row, pops),
          NEVER_REPORTED_MS
        ]
      );
      const hostId = host.rows[0].id;

      for (const count of bedCounts(row, pops)) {
        await client.query('INSERT INTO bed_counts (host_id, kind, beds_open, capacity) VALUES ($1, $2, 0, $3)', [
          hostId,
          count.kind,
          count.capacity
        ]);
      }
      // A made-up sign-in for the demo. It has no password until initDb() sets one.
      if (row.staff_email) {
        await client.query('INSERT INTO staff_users (host_id, email) VALUES ($1, $2)', [
          hostId,
          row.staff_email.toLowerCase()
        ]);
      }
      if (isConfidential) confidential++;
    }

    await client.query('COMMIT');
    return { loaded: rows.length, confidential };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

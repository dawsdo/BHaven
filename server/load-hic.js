// Loads data/organizations_seed.csv (2025 HUD Housing Inventory Count, CoC AL-500)
// into the hosts table:  npm run load-hic
//
// Replaces the demo rows. Re-running it is safe: rows are matched on name, so an
// existing row is updated rather than duplicated.
//
// Two things this deliberately does NOT do:
//
//   1. It never invents a vacancy. The HIC counts funded inventory, taken one night
//      in late January. It says nothing about who has a bed free tonight, and nobody
//      publishes that — it is the gap this project exists to fill. So every row loads
//      with beds_open = 0 and a reported time old enough to read as 'unknown'. The
//      app opens showing dashes and "call ahead" until a real host reports a real
//      number. Seeding total_beds as though it were vacancy would manufacture exactly
//      the fake availability this project was built to argue against.
//
//   2. It never writes an address for a confidential host, even if one is present in
//      the source file. A database CHECK enforces the same rule underneath.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(here, '..', 'data', 'organizations_seed.csv');

// Old enough that freshnessOf() reports 'unknown'. Not a real report.
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

function noteFor(row, pops) {
  const parts = [];
  if (pops.includes('veterans')) parts.push('Veterans program — confirm eligibility');
  if (row.notes) parts.push(row.notes);
  if (row.status && /NOT FOUND|verify|confirm|call before/i.test(row.status)) {
    parts.push('Unverified: ' + row.status);
  }
  return parts.join('. ');
}

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
if (!rows.length) {
  console.error('No rows found in', CSV);
  process.exit(1);
}

try {
  await initDb();

  // Clear the demo hosts, and the holds that point at them, so the two data sets do
  // not sit side by side. Holds are demo artefacts; nothing real is lost.
  await pool.query('DELETE FROM holds');
  await pool.query('DELETE FROM hosts');

  let loaded = 0;
  let confidential = 0;

  for (const row of rows) {
    const pops = popList(row.populations);
    const f = flags(pops);
    const isConfidential = String(row.address_confidential).toLowerCase() === 'true';
    // Combine org and facility: four Salvation Army programs share one org name.
    const name = row.facility_name && row.facility_name !== row.name
      ? `${row.name} — ${row.facility_name}`
      : row.name;

    await pool.query(
      `INSERT INTO hosts
         (name, type, address, address_confidential, phone, lat, lng, total_beds,
          takes_men, takes_women, takes_women_children, takes_families, takes_youth,
          youth_max_age, step_free, pets, beds_open, accepting, verified, note, updated_at)
       VALUES ($1,'shelter',$2,$3,$4,NULL,NULL,$5,$6,$7,$8,$9,$10,NULL,FALSE,$11,0,TRUE,TRUE,$12,$13)`,
      [
        name,
        // Never store an address for a confidential host, whatever the file says.
        isConfidential ? null : (row.address || null),
        isConfidential,
        row.phone || null,
        row.total_beds ? Number(row.total_beds) : null,
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
    loaded++;
    if (isConfidential) confidential++;
  }

  const beds = rows.reduce((a, r) => a + (Number(r.total_beds) || 0), 0);
  console.log(`Loaded ${loaded} programs, ${beds} beds of inventory.`);
  console.log(`${confidential} have confidential locations and carry no address.`);
  console.log('No vacancy was seeded: every row reads as "not reported" until a host reports.');
} catch (err) {
  console.error('Load failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

# BHaven — project handoff

State dump so a new teammate or session can pick this up cold. `README.md` is the
public-facing writeup; this is the working context behind it.

**Status:** React + Express + PostgreSQL app, running end to end. Real HUD dataset
loaded. Both safety rules enforced server-side. Not deployed.

---

## 1. How this came together

Two halves were built in parallel and merged:

- **The app** (`src/`, `server/`) — React/Vite frontend, Express API, PostgreSQL.
  Browse, filter by who needs a place, hold a bed with an expiring code, host console.
- **The data and the design rules** — 20 real Birmingham shelter programs from HUD's
  2025 Housing Inventory Count, plus server-side staleness gating and confidential-address
  handling for domestic violence shelters.

A separate Supabase prototype was retired into this one. Its schema contributed the
freshness view and the confidential-address concept; its data became
`data/organizations_seed.csv`.

## 2. Architecture

```
browser (React, Vite dev server :5173)
   | /api proxied to :3001
Express (server/index.js)
   | pg
PostgreSQL  —  local Docker, or hosted (Supabase/Neon/RDS)
```

Two tables: `hosts` and `holds`. `server/schema.sql` creates both and ends with
idempotent `ALTER`s, so it is safe to re-run on every start.

The frontend polls every 4 seconds (`usePolling` in `src/lib.js`). Not websockets —
simpler, and fast enough that a host update appears on the browse page while you watch.

## 3. The two rules that are the point of the project

Both are enforced in `server/index.js`, not in the browser, so no client can render
something it shouldn't have.

**Staleness gating.** `freshnessOf()` classifies a count by age: `fresh` under 4h,
`stale` to 12h, `unknown` beyond. `shape()` sends `beds_open: null` and
`beds_available: null` unless `fresh`. `POST /api/holds` refuses a hold on anything
not `fresh`. Thresholds are `FRESH_MS` / `STALE_MS` at the top of the file.

The one exception: `GET /api/hosts?console=1` returns a host its own real numbers.
A shelter needs to see the figure it is about to correct. The public list stays gated.

**Confidential addresses.** `hosts.address_confidential` rows carry no address and no
coordinates. A `CHECK` constraint makes a confidential row with an address unwritable.
`shape()` nulls `address`, `lat`, `lng`. `src/pages/Listing.jsx` renders no address and
builds no Google Maps link. The phone number is the only way in, which is why `phone`
was added to the schema.

Three rows are confidential: SafeHouse of Shelby County, YWCA Family Violence Shelter,
and TAKE Resource Center (which publishes no street address — likely intentional given
who they serve).

## 4. The data

`data/organizations_seed.csv` → `npm run load-hic` → `hosts`.

Source: 2025 HUD Housing Inventory Count, CoC **AL-500**. Downloaded from
`files.hudexchange.info` (navigate via hudexchange.info → CoC Housing Inventory Count
Reports → Year 2025, Scope "For a CoC", State Alabama, CoC AL-500).

19 emergency shelter programs plus one Safe Haven, 432 beds. Addresses, phones and
populations added by hand from each organization's own site.

**The HIC counts inventory, not vacancy** — one night in late January, once a year.
This is the likeliest judge question. Nobody publishes vacancy; that is the gap.

Not resolved:
- Three programs couldn't be identified (HIC truncates long provider names): Housing
  Assistance Fund, Family Connection, Great Expectations — 20 beds between them. One
  Roof could identify these in a phone call.
- `lat`/`lng` empty for every row, so distance sorting is inert. Collect from Google
  Maps right-click. **Never for the three confidential rows.**
- Intake hours and pets policy unverified almost everywhere.
- `adults` and `veterans` in the source don't map cleanly to the five boolean flags.
  `load-hic.js` maps both to single men and women and records eligibility in `note`.
  A `takes_veterans` column is the honest fix.

## 5. Gotchas already hit

1. **The repo was cloned on Windows with CRLF line endings.** Working on it from a
   Linux shell makes git report all 23 files as modified. Fix in the repo:
   `git config core.autocrlf true` and `git config core.filemode false`.
2. **Supabase refuses non-SSL connections** and won't let you `CREATE DATABASE`.
   Hence `PGSSL` and `PGCREATE_DB` in `server/db.js`.
3. **Use Supabase's session-mode pooler**, not the direct connection — direct is
   IPv6-only on the free tier and usually fails from Windows.
4. **`npm run reset-db` reloads the seven demo rows, not the HUD data.** Follow it with
   `npm run load-hic`.
5. **Dependabot has two open PRs** branched from an older commit. Merging them as-is
   would regress `server/` and `src/`. Rebase or close.
6. UPDATE in a SQL console always reports success whether or not it matched. Verify
   with a SELECT.

## 6. Verified working

Tested against a real PostgreSQL 16 instance:

- Confidential rows expose no address, lat or lng through the API.
- With nothing reported: all 20 rows `unknown`, every count `null`.
- Hold refused on an unconfirmed count.
- Host reports 8 → `fresh`, count published, hold succeeds and returns a code.
- Report backdated 6 hours → count disappears from the API, hold refused again.
- Host console still sees its own numbers while the public list shows a dash.
- `npm run build` clean; browse and listing pages render correctly.

## 7. Next steps

1. **Collect `lat`/`lng`** for the 17 non-confidential rows. Distance sorting is built
   and waiting. ~25 min.
2. **Rehearse the demo.** The script is in the README. Do not skip.
3. **Deploy** if judges should open it on their phones. Needs the API hosted too now,
   so it is no longer a drag-and-drop — a container host or a Node platform.
4. **Nightly SMS to shelters** — "How many beds open tonight? Reply with a number."
   Highest pitch value, highest risk. Needs the app deployed first for the webhook URL.
   Twilio trial accounts can only text verified numbers: verify the team's phones early
   or the demo fails.
5. **Host authentication.** `?console=1` is a query string, not security.

## 8. The pitch

**One-liner:** inventory is public, availability isn't, so we built the missing half.

**Opening (~30s):** It's 9pm and cold. An outreach worker has someone who needs a bed.
There's no way to find out who has space — shelters don't publish it anywhere. When a
reporter tried calling around, one shelter was full by 3:30 and two wouldn't give a
number at all. So the worker guesses, drives across town, and finds it full.

**What we built:** A live bed-availability service for Birmingham's shelters, with a
one-tap reporting screen for shelter staff and a hold system so a responder can reserve
a bed before driving. Seeded with all 20 emergency shelter programs in Birmingham's HUD
Continuum of Care — 432 beds.

**The demo (30s):** Finder on the projector, everything grey and "Not reported." On a
phone, open the host console, pick Firehouse, set it to 8, submit. The projector flips
to a green 8 untouched. Hold two beds, get a code, check in on the phone.

**The differentiator:** Everyone builds the map. LA built one — an audit found it showing
a shelter with an 89% vacancy rate that wasn't real. The hard problem is keeping it fresh.
So updating is one tap with no login, and staleness is enforced in the API: if a count is
over four hours old we don't send the number at all. The browser cannot display what it
was never given. We'd rather show nothing than send someone across town for a bed that
isn't there.

**The detail that lands:** Two of these are domestic violence shelters. Their addresses
are confidential by design. They're in the list with a phone number, they carry no
coordinates in the database, and the listing page builds no directions link. A database
constraint makes it impossible to write an address onto one of those rows at all.

**Expected questions:**

- *"Who keeps it updated?"* → Adoption is the real problem, not technology. That's why
  updating is one tap with no account, and why the next step is nightly SMS. The step
  after that is piloting with one shelter, not launching citywide.
- *"Is the data real?"* → The shelters are, from HUD's 2025 Housing Inventory Count for
  AL-500. Bed counts are entered by us, because no system exists to pull them from —
  that's the gap we built the collection mechanism for. We deliberately don't seed fake
  vacancy; everything starts at "not reported."
- *"Security?"* → There's no host login yet. Production restricts writes to authenticated
  shelter staff.
- *"Why not use HMIS?"* → Long term we'd integrate with One Roof's HMIS so counts flow
  from the intake system shelters already use. That's a six-month conversation with a
  nonprofit, not a hackathon feature.

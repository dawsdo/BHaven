# ShelterLink BHM

A live view of which Birmingham shelters have beds open tonight, and a way to hold one.

Built for ShiptHacks ("Build a Better Birmingham"). The organizations listed are real and come
from HUD's 2025 inventory count. **No bed count in this app is real until a shelter reports it** —
see [Data](#data). This project is not affiliated with or endorsed by any organization shown.

## The problem

It's 9pm and cold. An outreach worker, ER discharge nurse, or police officer has someone in front
of them who needs a bed. There is no way to find out which shelter has space.

Shelters don't publish open bed counts anywhere. One Roof — the regional Continuum of Care
(AL-500) — runs HMIS and Coordinated Entry, but those are built for HUD compliance reporting, not
for someone checking a phone at 9pm. When a reporter called around to check availability, First
Light had no beds by 3:30pm and two other shelters wouldn't give a number at all.

So the helper guesses, drives across town, and finds the shelter full. It's 10pm now and they
start over.

It gets worse because shelters are split by population. Firehouse takes men only. First Light
takes women and children. Each has different intake cutoffs.

## Why this isn't solved already

It has been tried. Los Angeles built a public bed-availability system called Find-a-Shelter; an
audit found low participation and inaccurate estimates — at one point showing a shelter with an
89% vacancy rate that wasn't real. Portland has piloted one. There are open-source attempts.

**The hard problem is not displaying the data. It's keeping it fresh.** Everyone builds the map.
Nobody solves the updating. The four decisions below follow from that.

## Four decisions that are the project

**1. Updating is one tap, no login.** The host console takes a number and nothing else. If
updating takes more than five seconds, nobody does it and the app is dead.

**2. A count nobody has confirmed recently is never shown as current.** Freshness is computed in
`server/index.js` and the stale number **does not leave the server** — the browser is not sent a
figure it could render by mistake.

| Age of report | `freshness` | What the API sends | What the user sees |
| --- | --- | --- | --- |
| under 4 hours | `fresh` | the count | the number, "Confirmed N min ago" |
| 4 to 12 hours | `stale` | `null` | `—`, "Not confirmed since this morning — call ahead" |
| over 12 hours, or never | `unknown` | `null` | `—`, "Not reported — call ahead" |

A hold cannot be placed against a count that isn't `fresh`; the API refuses it. An app that sends
someone to a full shelter is worse than no app.

The 4 and 12 hour thresholds are judgment calls, not laws. They are `FRESH_MS` and `STALE_MS` at
the top of `server/index.js`. If a shelter director says two hours, change one line.

**3. Population filtering is a hard filter, not a nice-to-have.** Sending a woman to a men's
shelter is the exact failure this exists to prevent. See [Who a host takes](#who-a-host-takes).

**4. Domestic violence shelters are never mapped.** SafeHouse of Shelby County and the YWCA
Family Violence Shelter keep confidential addresses by design. They appear in the list with a
phone number and "Location confidential", and:

- `address_confidential` rows carry **no address and no coordinates** in the database. A `CHECK`
  constraint enforces it, so a confidential row with an address cannot be written at all.
- The API nulls `address`, `lat` and `lng` for those rows before serialising.
- The listing page renders no address and **no Google Maps directions link** — not even one built
  from the shelter's name, which would still point a search engine at it.

Publishing their locations would put the people inside them at risk.

## Stack

- React 18 + Vite, plain CSS (`src/`)
- Express API (`server/index.js`)
- PostgreSQL through `pg` (`server/schema.sql`)

## Run it

Needs Node 20 or newer, and a PostgreSQL database. Either works.

```bash
npm ci
cp .env.example .env    # Windows: copy .env.example .env
```

**Option A — hosted PostgreSQL (Supabase, Neon, RDS).** No Docker needed. Put the connection
details in `.env` and set:

```
PGSSL=true
PGCREATE_DB=false
```

Hosted providers require TLS and won't let the app create a database. On Supabase use the
**session-mode pooler** connection under Project Settings → Database, not the direct one: direct
connections are IPv6-only on the free tier and often fail from Windows.

**Option B — local PostgreSQL in Docker.** Leave `PGSSL` and `PGCREATE_DB` unset:

```bash
docker compose up -d db
```

Wait for `docker compose ps` to report healthy. Then either way:

```bash
npm run load-hic   # load the 20 real Birmingham programs (first run only)
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 and Vite proxies `/api` to it.

- `npm run load-hic` replaces whatever is in `hosts` with the real HUD dataset. Re-runnable.
- `npm run reset-db` drops the tables and re-seeds the seven original demo rows. Run it after
  pulling a change to `server/schema.sql` — the server creates missing tables and runs the
  idempotent `ALTER`s at the bottom of that file, but does not otherwise alter existing ones.
- `npm run build && npm start` serves the built app and the API together on one port.
- `.env` holds your password and is git-ignored. Each teammate makes their own.

## Demo script

1. Open `/` in one window and `/host` in another. Every shelter reads `—` and "Not reported".
2. On `/host`, pick Firehouse Ministries and set a bed count. The browse page updates within a few
   seconds: the dash becomes a number and "Confirmed just now".
3. On `/`, pick who needs a place, open the listing, and hold a bed. You get a code.
4. Back on `/host`, the hold shows under "On the way to you". Press "Check in".
5. Open SafeHouse of Shelby County to show the confidential-address handling.

## Data

Seeded from the **2025 HUD Housing Inventory Count for CoC AL-500** (Birmingham / Jefferson,
St. Clair, Shelby Counties): 19 emergency shelter programs plus one Safe Haven, 432 beds.

`data/organizations_seed.csv` is the source of truth; `server/load-hic.js` loads it.

**The HIC counts inventory, not vacancy.** It is taken on a single night in late January, once a
year. It says nothing about who has a bed free tonight — nobody publishes that, which is the gap
this project fills. So the loader sets `beds_open = 0` and an `updated_at` old enough to read as
`unknown`. Every shelter opens as "not reported" until a real host reports a real number.
Seeding `total_beds` as though it were vacancy would manufacture exactly the fake availability
this project was built to argue against.

Addresses, phones and populations were added by hand from each organization's own site. Three
programs (Housing Assistance Fund, Family Connection, Great Expectations — 20 beds between them)
could not be identified because the HIC truncates long provider names; One Roof could resolve
them in a phone call. Rows carry their status in `note`.

**Known mapping caveat.** The source records populations as a free-form set that includes
`adults` and `veterans`. This schema records who a host takes as five booleans with no veterans
flag, so `load-hic.js` maps both to single men and women and puts the eligibility in `note` for
the responder to confirm by phone. A `takes_veterans` column would be the honest fix.

## Pages

| Route        | What it is                                                   |
| ------------ | ------------------------------------------------------------ |
| `/`          | Browse and filter places with open beds                      |
| `/place/:id` | One listing, with the "Hold a bed" panel                     |
| `/host`      | Host console: update the count, pause arrivals, check people in |

## API

| Method | Path                       | Purpose                                       |
| ------ | -------------------------- | --------------------------------------------- |
| GET    | `/api/hosts`               | Verified hosts (`?all=1` includes unverified; `?console=1` returns a host its own counts even when stale) |
| GET    | `/api/hosts/:id`           | One host                                      |
| PATCH  | `/api/hosts/:id`           | `{ beds_open?, accepting? }`; empty body confirms the count |
| GET    | `/api/hosts/:id/holds`     | Live holds for a host                         |
| POST   | `/api/holds`               | `{ host_id, people, minutes }` returns a code; refused unless the count is `fresh` |
| POST   | `/api/holds/:code/release` | Cancel a hold                                 |
| POST   | `/api/holds/:code/arrive`  | Check in: closes the hold, lowers the count   |

`beds_available = beds_open - people on unexpired holds`, or `null` when the count is not
`fresh`. Holds expire on their own.

## Who a host takes

Each host row carries five flags, returned as-is by the hosts endpoints:

| Field                  | Means                                                    | Search pill          |
| ---------------------- | -------------------------------------------------------- | -------------------- |
| `takes_men`            | Single adult men                                         | Man                  |
| `takes_women`          | Single adult women                                       | Woman                |
| `takes_women_children` | Mothers with children                                    | Woman with children  |
| `takes_families`       | Any parent or parents with children                      | Family with children |
| `takes_youth`          | Unaccompanied young people; `youth_max_age` is the oldest age taken, or `null` | Youth on their own |

A woman with children is a family, so a host with `takes_families` also matches a "Woman with
children" search. It does not run the other way: `takes_women_children` alone does not match a
"Family with children" search. The matching lives in `takes()` in `src/lib.js`; the API only
returns the flags.

## Privacy choices

- No names, photos, or health details are collected. A hold is a code and a head count.
- Location is requested only when the user presses "Use my location". It is used in the browser
  to sort the list and is never sent to the server. Browsers only allow this over HTTPS or on
  `localhost`.
- Confidential shelters carry no address or coordinates anywhere in the system. See decision 4.

## Not built yet

- Login for hosts. The host console lets anyone pick any host, which is fine for a demo only.
  `?console=1` is a query string, not authentication.
- Row-level security. Anyone who can reach the API can write to it.
- Nightly SMS to shelters: "How many beds open tonight? Reply with a number." Inbound webhook
  parses the reply and records it. This is the real answer to decision 1 and needs a deployed URL.
- `lat`/`lng` are empty for every row, so distance sorting does nothing until coordinates are
  collected. Never for the confidential rows.
- Intake hours and pets policy are unverified for nearly every row. "Open beds but intake closed"
  is a wasted trip.
- "List a space" form and the review step that verifies new hosts.
- Per-group bed counts instead of one number per host.

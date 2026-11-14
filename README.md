# ShelterLink BHM

A live view of which Birmingham shelters have beds open tonight, and a way to hold one.

Built for ShiptHacks ("Build a Better Birmingham"). The organizations listed are real and come
from HUD's 2025 inventory count. **No bed count in this app is real until a shelter reports it** —
see [Data](#data). This project is not affiliated with or endorsed by any organization shown.

This is the one app for the team. It includes the data and features of the "Open Beds" MVP (the
`open-beds-mvp` branch): bed counts per kind of bed with HUD totals, staff sign-in, counts that
expire, ZIP code search, and Call and Directions on every listing. There is one database and one
row per place.

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

**1. Updating is one tap after sign-in.** Staff sign in once (the session lasts 8 hours) and land
on their own place. From there a count changes with one tap, and "Counts are still right" confirms
everything without changing a number. If updating takes more than five seconds, nobody does it and
the app is dead. Sign-in exists so that only a shelter's own staff can change its counts.

**2. A count nobody has confirmed recently is never shown as current.**

| Age of the last report | What the API sends | What the user sees |
| --- | --- | --- |
| under 3 hours | the counts | the number, "Reported N min ago" |
| 3 to 24 hours | the counts | the number, flagged "may be out of date" |
| over 24 hours, or never | `expired: true`, `counts: null` | `–`, "No recent update. Call to confirm." |

Past 24 hours the number **does not leave the server** — the browser is not sent a figure it could
render by mistake — and the API refuses a hold there. An app that sends someone to a full shelter
is worse than no app. A shelter's own staff still see their numbers in the console, because they
need to see the figure they are about to correct.

Both thresholds are judgment calls, not laws. The 3-hour flag is `isStale` in `src/lib.js` and the
24-hour cutoff is `EXPIRY_MS` at the top of `server/index.js`. If a shelter director says counts
should disappear sooner, change one line.

**3. Population filtering is a hard filter, not a nice-to-have.** Sending a woman to a men's
shelter is the exact failure this exists to prevent. See [Who a host takes](#who-a-host-takes).

**4. Domestic violence shelters are never mapped.** SafeHouse of Shelby County and the YWCA
Family Violence Shelter keep confidential addresses by design. They appear in the list with a
phone number and "Location confidential", and:

- `address_confidential` rows carry **no address and no coordinates** in the database. A `CHECK`
  constraint enforces it, so a confidential row with an address cannot be written at all.
- The API nulls `address`, `lat` and `lng` for those rows before serialising.
- The listing page renders no address and **no Google Maps directions link** — not even one built
  from the shelter's name, which would still point a search engine at it. The Call button is the
  way in.

Publishing their locations would put the people inside them at risk.

## Stack

- React 18 + Vite, plain CSS (`src/`)
- Express API (`server/index.js`, sign-in in `server/auth.js`)
- PostgreSQL through `pg` (`server/schema.sql`)

## Run it

Needs Node 20 or newer, and a PostgreSQL database. Either option works.

```bash
npm ci
cp .env.example .env    # Windows: copy .env.example .env
```

In `.env`, fill in the two blank values:

- `SEED_STAFF_PASSWORD`: the password for every demo staff account. Without it nobody can sign in
  to the host console.
- `SESSION_SECRET`: a long random string that signs staff sessions, for example the output of
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Without it the
  server makes a new key on every start, so each restart signs staff out.

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
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 and Vite proxies `/api` to it. On first
start the server creates its tables and loads the 20 programs from `data/organizations_seed.csv`.

- `npm run reset-db` drops the tables and loads the 20 programs again, with no vacancy: every
  place reads "No recent update. Call to confirm." until its staff report. **Run it once after
  pulling this version** (the tables changed, and the server only creates missing tables), and
  after changing `SEED_STAFF_PASSWORD`. `npm run load-hic` is the same command under its old name.
- `npm run demo-db` does the same and then applies `server/demo.sql`: **simulated** counts for
  Firehouse, Pathways, three Salvation Army programs and First Light, so there is something on
  screen to search and hold.
- Both commands wipe every count and hold in the database they point at. On a shared hosted
  database, tell the team first.
- `npm run build && npm start` serves the built app and the API together on one port.
- `.env` holds your passwords and is git-ignored. Each teammate makes their own.

## Demo script

After `npm run reset-db` (nothing simulated):

1. Open `/` in one window and `/host` in another. Every shelter reads `–` and "No recent update.
   Call to confirm."
2. On `/host`, sign in as `staff@firehouse-demo.example` and raise the men's beds. The browse page
   updates within a few seconds: the dash becomes a number and "Reported just now".
3. On `/`, pick "Man", open Firehouse, and hold a bed. You get a code.
4. Back on `/host`, the hold shows under "On the way to you". Press "Check in".
5. Open SafeHouse of Shelby County to show the confidential-address handling.

After `npm run demo-db` you can also show a room held for a family at Pathways Stepping Stones
(`staff@pathways-demo.example`), the "may be out of date" flag on the Salvation Army programs, and
First Light coming back when `staff@firstlight-demo.example` presses "Counts are still right".

## Demo logins

Each place has one made-up staff account, named in the `staff_email` column of
`data/organizations_seed.csv`. The password for all of them is the `SEED_STAFF_PASSWORD` value in
`.env`. An account can only see and change its own place.

| Place | Demo staff email |
| --- | --- |
| Firehouse Ministries — Emergency Shelter | `staff@firehouse-demo.example` |
| First Light — Emergency Shelter | `staff@firstlight-demo.example` |
| Pathways — Stepping Stones | `staff@pathways-demo.example` |
| One Roof — Pathways Safe Haven | `safehaven@oneroof-demo.example` |
| Salvation Army — Center of Hope, Men's | `mens@salvationarmy-demo.example` |
| Salvation Army — Center of Hope, Women's | `womens@salvationarmy-demo.example` |
| Salvation Army — Center of Hope, Family | `family@salvationarmy-demo.example` |
| Salvation Army — Center of Hope, Women's overflow | `overflow@salvationarmy-demo.example` |
| SafeHouse of Shelby County | `staff@safehouse-demo.example` |
| YWCA — Family Violence Shelter | `fvs@ywca-demo.example` |
| YWCA — Interfaith Hospitality House | `ihh@ywca-demo.example` |
| The other nine | see the CSV |

Sign out of the host console before resetting the database: it rebuilds the accounts.

## Data

Seeded from the **2025 HUD Housing Inventory Count for CoC AL-500** (Birmingham / Jefferson,
St. Clair, Shelby Counties): 19 emergency shelter programs plus one Safe Haven, 432 beds.

`data/organizations_seed.csv` is the source of truth; `server/load-hic.js` loads it. Each HUD
program is its own place, so the Salvation Army's Center of Hope is four entries.

**The HIC counts inventory, not vacancy.** It is taken on a single night in late January, once a
year. It says nothing about who has a bed free tonight — nobody publishes that, which is the gap
this project fills. So the loader sets every open count to 0 with an update time old enough to
read as expired. Every shelter opens as "No recent update. Call to confirm." until a real host
reports a real number. Seeding the HUD totals as though they were vacancy would manufacture
exactly the fake availability this project was built to argue against. The HUD totals are kept as
each count's `capacity`: shown as "N total", and the ceiling a host cannot report above.

| Field | Source |
| --- | --- |
| Program names and total beds | HUD 2025 HIC, CoC AL-500. |
| Addresses, phones, populations | Added by hand from each organization's own site. |
| Coordinates | 7 of the 20 rows (Firehouse, First Light, the four Salvation Army programs, Pathways Stepping Stones). The rest sort last when sorting by distance. **Never for the confidential rows.** |
| `bed_kinds` column | Splits a program's beds by kind where the HIC gives family units (Pathways: 8 women's beds and 5 family rooms; Salvation Army Family: 8 rooms). Otherwise the kind follows the population and the capacity is the program total. |
| Open counts and update times from `npm run demo-db` | **Simulated.** |
| Step-free access, pets, intake hours | **Unverified** for nearly every row. |
| Staff accounts | **Made up.** |
| ZIP code centers | Approximate, for ten Birmingham ZIP codes. |

Three programs (Housing Assistance Fund, Family Connection, Great Expectations — 20 beds between
them) could not be identified because the HIC truncates long provider names; One Roof could
resolve them in a phone call. They have no address or phone listed. TAKE Resource Center is
confidential and has no phone number on file, so its listing can only say so. Rows carry their
status in `note`.

**Known mapping caveat.** The source records populations as a free-form set that includes
`adults` and `veterans`. This schema records who a host takes as five booleans with no veterans
flag, so `load-hic.js` maps both to single men and women and puts the eligibility in `note` for
the responder to confirm by phone. A `takes_veterans` column would be the honest fix.

## Pages

| Route        | What it is                                                              |
| ------------ | ----------------------------------------------------------------------- |
| `/`          | Browse and filter places with open beds, sorted by ZIP code or location |
| `/place/:id` | One listing, with Call, Directions and the "Hold a bed" panel           |
| `/host`      | Host console, after sign-in: update counts, pause arrivals, check people in |

## API

| Method | Path                       | Who    | Purpose                                             |
| ------ | -------------------------- | ------ | --------------------------------------------------- |
| GET    | `/api/hosts`               | Anyone | Verified hosts with their counts                    |
| GET    | `/api/hosts/:id`           | Anyone | One host                                            |
| GET    | `/api/zips/:zip`           | Anyone | Approximate center of a ZIP code                    |
| POST   | `/api/holds`               | Anyone | `{ host_id, count_id, people, minutes }` returns a code; refused when the counts have expired |
| POST   | `/api/holds/:code/release` | Anyone with the code | Cancel a hold                         |
| POST   | `/api/auth/login`          | Staff  | `{ email, password }` returns `{ token }`           |
| GET    | `/api/staff/host`          | Staff  | The signed-in account's own host, with its counts even when expired |
| PATCH  | `/api/hosts/:id`           | Staff  | `{ counts?: [{ id, open }], accepting? }`; an empty body confirms the counts |
| GET    | `/api/hosts/:id/holds`     | Staff  | Live holds for the host                             |
| POST   | `/api/holds/:code/arrive`  | Staff  | Check in: closes the hold, lowers that count        |

Staff calls send `Authorization: Bearer <token>`. A token lasts 8 hours and only works for its
own host: another host's id answers 403. The old `?console=1` and `?all=1` query options are gone.

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

The "Kind of place" filter (Women only, Men only, Co-ed) is worked out from the same flags in
`placeKind()`, not stored separately.

## Bed counts and holds

A host reports open beds per kind, one `bed_counts` row each: `men`, `women`, `family`, `youth`,
or `any` for beds not set aside for one group. A `family` count is in rooms; the rest are in beds.
Each count can carry a `capacity`, the HUD total of that kind, and can never be set above it.

Each count comes back as `{ id, kind, open, capacity, held, available }`, where
`available = open - held` and `held` is what unexpired holds are tying up. Holds expire on their
own.

A search draws on one count per host, the first kind the host has:

| Search               | Uses                               |
| -------------------- | ---------------------------------- |
| Man                  | `men`, else `any`                  |
| Woman                | `women`, else `any`                |
| Woman with children  | `family`, else `women`, else `any` |
| Family with children | `family`, else `any`               |
| Youth on their own   | `youth`, else `any`                |
| Anyone               | every count                        |

A hold is placed on one count. It ties up one bed per person, or one whole room for a `family`
count however many people are coming.

## Privacy choices

- No names, photos, or health details are collected. A hold is a code and a head count.
- Device location is requested only when the user presses "Use my location". It is used in the
  browser to sort the list and is never sent to the server. Browsers only allow this over HTTPS
  or on `localhost`.
- A typed ZIP code is sent to the server, which answers with that ZIP's approximate center. The
  server keeps no request log.
- Confidential shelters carry no address or coordinates anywhere in the system. See decision 4.
- Staff passwords are stored as salted scrypt hashes. No password is committed to the repository.

## Not built yet

- Nightly SMS to shelters: "How many beds open tonight? Reply with a number." Inbound webhook
  parses the reply and records it. This is the real answer to decision 1 and needs a deployed URL.
- Coordinates for the ten other non-confidential rows. Never for the confidential rows.
- Verified intake hours and pets policy. "Open beds but intake closed" is a wasted trip.
- Host sign-up ("List a space") and the review step that verifies new hosts. Places and staff
  accounts come from the CSV.
- Editing a place's details, or adding a kind of bed, from the console.
- Sign-in rate limiting, and password reset.
- Searching by a young person's age. `youth_max_age` is stored but not filtered on.

# ShelterLink BHM

Find an open shelter bed in Birmingham, AL and hold it, Airbnb-style. Hosts (shelters, warming
stations, community spaces) sign in and keep their own bed counts current.

Built for ShiptHacks. **All open-bed counts and policies are demo data.** The organizations listed
are real, but this project is not affiliated with or endorsed by them. See
[Where the data comes from](#where-the-data-comes-from).

This app now includes the data and features of the team's "Open Beds" MVP (the `open-beds-mvp`
branch): per-kind bed counts with HUD totals, staff sign-in, the 24-hour expiry, ZIP code search,
and Call and Directions on every listing. There is one app, one database and one row per place.

## Stack

- React 18 + Vite, plain CSS (`src/`)
- Express API (`server/index.js`, sign-in in `server/auth.js`)
- PostgreSQL through `pg` (`server/schema.sql`, `server/seed.sql`)

## Run it

Needs Node 20 or newer and Docker Compose (or a separately installed PostgreSQL server).

```bash
npm ci
cp .env.example .env    # Windows: copy .env.example .env
docker compose up -d db
```

In `.env`, fill in the two blank values:

- `SEED_STAFF_PASSWORD`: the password for every demo staff account. Without it nobody can sign in
  to the host console.
- `SESSION_SECRET`: a long random string that signs staff sessions, for example the output of
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Without it the
  server makes a new key on every start, so each restart signs staff out.

Wait for the database to report healthy with `docker compose ps`, then run:

```bash
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 and Vite proxies `/api` to it. On first start
the server creates the database if needed, creates its tables, and seeds the demo hosts. Compose
exposes PostgreSQL only on localhost and stores its data in the `postgres_data` volume. The sample
credentials are for local development only. For a separately installed PostgreSQL server, update
`PGHOST`, `PGPORT`, `PGUSER`, and `PGPASSWORD` in `.env`; the user needs permission to create a
database.

- `npm run reset-db` drops the tables and re-seeds them. Run it after pulling a change to
  `server/schema.sql` (the server only creates missing tables, it does not alter existing ones)
  and after changing `SEED_STAFF_PASSWORD`. It also resets every update time, so run it before a
  demo to get each freshness state on screen.
- `npm run build && npm start` serves the built app and the API together on one port (3001, or `PORT`).
- `.env` holds your passwords and is git-ignored. Each teammate makes their own.

## Demo script

1. Open `/` in one window and `/host` in another.
2. On `/host`, sign in as `staff@pathways-demo.example` and change a bed count. The browse page
   updates within a few seconds.
3. On `/`, pick "Woman with children", open Pathways Stepping Stones, and hold a family room. You
   get a code.
4. Back on `/host`, the hold shows under "On the way to you". Press "Check in".
5. On `/`, First Light shows "No recent update. Call to confirm." Sign in as
   `staff@firstlight-demo.example` and press "Counts are still right" to bring its count back.

## Demo logins

Each host has one made-up staff account. The password for all of them is the
`SEED_STAFF_PASSWORD` value in `.env`. An account can only see and change its own host.

| Host                                  | Demo staff email                    |
| ------------------------------------- | ----------------------------------- |
| Firehouse Shelter                     | `staff@firehouse-demo.example`      |
| Pathways Stepping Stones              | `staff@pathways-demo.example`       |
| Salvation Army Center of Hope         | `staff@salvationarmy-demo.example`  |
| First Light                           | `staff@firstlight-demo.example`     |
| Jimmie Hale Mission Men's Center      | `staff@jimmiehale-demo.example`     |
| Warming station (Jimmie Hale Mission) | `warming@jimmiehale-demo.example`   |
| Sample Community Host (demo)          | `staff@samplehost-demo.example`     |

Sign out of the host console before running `npm run reset-db`: it rebuilds the accounts.

## Pages

| Route        | What it is                                                            |
| ------------ | --------------------------------------------------------------------- |
| `/`          | Browse and filter places with open beds, sorted by ZIP code or location |
| `/place/:id` | One listing, with Call, Directions and the "Hold a bed" panel         |
| `/host`      | Host console, after sign-in: update counts, pause arrivals, check people in |

## API

| Method | Path                       | Who   | Purpose                                              |
| ------ | -------------------------- | ----- | ---------------------------------------------------- |
| GET    | `/api/hosts`               | Anyone | Verified hosts with their counts                    |
| GET    | `/api/hosts/:id`           | Anyone | One host                                            |
| GET    | `/api/zips/:zip`           | Anyone | Approximate center of a ZIP code                    |
| POST   | `/api/holds`               | Anyone | `{ host_id, count_id, people, minutes }` returns a code |
| POST   | `/api/holds/:code/release` | Anyone with the code | Cancel a hold                         |
| POST   | `/api/auth/login`          | Staff | `{ email, password }` returns `{ token }`            |
| GET    | `/api/staff/host`          | Staff | The signed-in account's own host                     |
| PATCH  | `/api/hosts/:id`           | Staff | `{ counts?: [{ id, open }], accepting? }`; an empty body confirms the counts |
| GET    | `/api/hosts/:id/holds`     | Staff | Live holds for the host                              |
| POST   | `/api/holds/:code/arrive`  | Staff | Check in: closes the hold, lowers that count         |

Staff calls send `Authorization: Bearer <token>`. A token lasts 8 hours and only works for its
own host: another host's id answers 403.

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
`placeKind()`, not stored separately. "Step-free access" is the `step_free` column (wheelchair
access) and "Pets allowed" is `pets`.

## Bed counts and holds

A host reports open beds per kind, one `bed_counts` row each: `men`, `women`, `family`, `youth`,
or `any` for beds not set aside for one group. A `family` count is in rooms; the rest are in beds.
Each count can carry a `capacity`, the host's total of that kind, and can never be set above it.

Each count comes back as `{ id, kind, open, capacity, held, available }`, where
`available = open - held` and `held` is what unexpired holds are tying up. Holds expire on their
own.

A search draws on one count per host, the first kind the host has:

| Search               | Uses                              |
| -------------------- | --------------------------------- |
| Man                  | `men`, else `any`                 |
| Woman                | `women`, else `any`               |
| Woman with children  | `family`, else `women`, else `any` |
| Family with children | `family`, else `any`              |
| Youth on their own   | `youth`, else `any`               |
| Anyone               | every count                       |

A hold is placed on one count. It ties up one bed per person, or one whole room for a `family`
count however many people are coming.

## Freshness

- Every listing shows when its counts were last changed or confirmed. The newest gets a
  "Most recently updated" tag.
- After 3 hours the time is flagged "may be out of date".
- After 24 hours the API stops returning the counts at all (`expired: true`, `counts: null`), the
  listing shows "No recent update. Call to confirm.", and beds there cannot be held. Staff bring
  the counts back by changing one or pressing "Counts are still right".

## Where the data comes from

| Field | Source |
| --- | --- |
| Names and total beds of First Light, Firehouse Shelter, Pathways Stepping Stones and Salvation Army Center of Hope | HUD 2025 Housing Inventory Count, CoC AL-500 (Birmingham/Jefferson, St. Clair, Shelby Counties), emergency shelter section. Family rooms use the report's family units. |
| Their addresses and phone numbers | Each organization's public listings, checked November 2026. Coordinates from the US Census geocoder. |
| The two Jimmie Hale Mission hosts | Real organization. Coordinates are **placeholders**, and no phone number or total is listed. |
| Sample Community Host | **Made up**, to show a community host. |
| Open-bed counts and update times | **Simulated.** |
| Who each host takes, step-free access and pets | **Placeholders.** Not confirmed with any host. |
| Tax IDs and staff accounts | **Placeholders.** The tax ID is format-checked only. |
| ZIP code centers | Approximate, for ten Birmingham ZIP codes. |

Left out on purpose:

- **Domestic violence shelters** (YWCA Family Violence Center, SafeHouse of Shelby County). Their
  locations are confidential and must not be shown on a public list.
- **Housing programs that are not walk-in shelters**: permanent supportive housing, rapid
  re-housing, and voucher programs.
- **Shelters whose current address or phone could not be confirmed** (YWCA Interfaith Hospitality
  House, Three Hots and a Cot), and programs with only a few beds.

## Privacy choices

- No names, photos, or health details are collected. A hold is a code and a head count.
- Device location is requested only when the user presses "Use my location". It is used in the
  browser to sort the list and is never sent to the server. Browsers only allow this over HTTPS
  or on `localhost`.
- A typed ZIP code is sent to the server, which answers with that ZIP's approximate center. The
  server keeps no request log.
- Staff passwords are stored as salted scrypt hashes. The seed file holds no password.

## Not built yet

- Host sign-up and the review step that verifies new hosts. Hosts and staff accounts are seeded.
- Editing a host's details, or adding a kind of bed, from the console. Those live in the seed file.
- Ride requests and a dispatch map for people who cannot get to the shelter themselves.
- Searching by a young person's age. `youth_max_age` is shown on the listing but not filtered on.
- A language filter. `languages` is stored and shown on the listing, but no demo host has any.
- Sign-in rate limiting.

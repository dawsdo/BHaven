# ShelterLink BHM

Find an open shelter bed in Birmingham, AL and hold it, Airbnb-style. Hosts (shelters, warming
stations, community spaces) keep their own bed counts current.

Built for ShiptHacks. **All bed counts and policies are demo data.** The organizations listed are
real, but this project is not affiliated with or endorsed by them.

## Stack

- React 18 + Vite, plain CSS (`src/`)
- Express API (`server/index.js`)
- PostgreSQL through `pg` (`server/schema.sql`, `server/seed.sql`)

## Run it

Needs Node 20 or newer and Docker Compose (or a separately installed PostgreSQL server).

```bash
npm ci
cp .env.example .env    # Windows: copy .env.example .env
docker compose up -d db
```

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
  `server/schema.sql`: the server only creates missing tables, it does not alter existing ones.
- `npm run build && npm start` serves the built app and the API together on one port (3001, or `PORT`).
- `.env` holds your password and is git-ignored. Each teammate makes their own.

## Demo script

1. Open `/` in one window and `/host` in another.
2. On `/host`, change a bed count. The browse page updates within a few seconds.
3. On `/`, pick who needs a place, open a listing, and hold a bed. You get a code.
4. Back on `/host`, the hold shows under "On the way to you". Press "Check in".

## Pages

| Route        | What it is                                                   |
| ------------ | ------------------------------------------------------------ |
| `/`          | Browse and filter places with open beds                      |
| `/place/:id` | One listing, with the "Hold a bed" panel                     |
| `/host`      | Host console: update the count, pause arrivals, check people in |

## API

| Method | Path                       | Purpose                                       |
| ------ | -------------------------- | --------------------------------------------- |
| GET    | `/api/hosts`               | Verified hosts (`?all=1` includes unverified) |
| GET    | `/api/hosts/:id`           | One host                                      |
| PATCH  | `/api/hosts/:id`           | `{ beds_open?, accepting? }`; empty body confirms the count |
| GET    | `/api/hosts/:id/holds`     | Live holds for a host                         |
| POST   | `/api/holds`               | `{ host_id, people, minutes }` returns a code |
| POST   | `/api/holds/:code/release` | Cancel a hold                                 |
| POST   | `/api/holds/:code/arrive`  | Check in: closes the hold, lowers the count   |

`beds_available = beds_open - people on unexpired holds`. Holds expire on their own.

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

## Not built yet

- Login for hosts. The host console lets anyone pick any host, which is fine for a demo only.
- "List a space" form and the review step that verifies new hosts.
- Ride requests and a dispatch map for people who cannot get to the shelter themselves.
- Per-group bed counts (men, women, women with children, families, youth) instead of one number
  per host.
- Searching by a young person's age. `youth_max_age` is shown on the listing but not filtered on.

# MVP Build Plan: Shelter Vacancy Board

Scope: `docs/mvp-scope.md`. Spec: `.plans/shelter-vacancy-spec.md`.
Time to demo: 2 hours. Slice estimates add up to about 2 hours 15 minutes, so the last slices are the ones to cut. Build with the `mvp-builder` agent, which runs on Fable 5.2.

## Stack
- **Client:** Expo (React Native, TypeScript). One app for phone and browser (`npx expo start --web`).
- **API:** Node 25 with Express and TypeScript, run with `tsx`. One process, no build step.
- **Database:** PostgreSQL 16 in Docker (`docker compose up -d`). `psql` is not installed locally, so the schema and seed load through a Node script.
- **Auth:** `bcryptjs` for password hashes, `jsonwebtoken` for the staff session. Clients send no auth.
- **Location:** `expo-location` for GPS. ZIP lookup uses a small seeded `zip_codes` table, so there is no external geocoding call. Distance uses the haversine formula in the API.
- **Freshness:** computed in the API from `updated_at` on each read.

## Folder tree
```
ShiptHacks/
  docker-compose.yml
  .env.example
  README.md
  api/
    package.json
    src/
      index.ts          # Express app, routes
      db.ts             # pg pool
      auth.ts           # login, JWT middleware
      shelters.ts       # list query, distance, freshness, filters
      seed.ts           # schema + demo data
  app/
    package.json
    app.json
    App.tsx             # switches between client and staff views
    src/
      api.ts            # fetch helpers, API base URL
      types.ts
      ShelterList.tsx
      ShelterCard.tsx
      Filters.tsx
      LocationBar.tsx
      StaffScreen.tsx
```

## Slices
Build in order. Each slice has a time limit. If it is not done at the limit, cut it and move on.

- [x] **1. Setup (15 min).** Create `docker-compose.yml`, `.env.example`, the `api/` Express skeleton, and the Expo app.
  - Files: `docker-compose.yml`, `.env.example`, `api/package.json`, `api/src/index.ts`, `api/src/db.ts`, `app/*`
  - Done: `GET /health` returns `{ ok: true }`, and the Expo app opens in a browser.

- [x] **2. Schema and seed (15 min).** Tables: `organizations`, `shelters`, `shelter_attributes`, `vacancy_counts`, `staff_users`, `zip_codes`. Seed 5 demo shelters in one city, with updates at under 2h, 3 to 23h, and over 24h ago. Seed one staff user per shelter, with the password read from an env var.
  - Files: `api/src/seed.ts`
  - Done: `npm run seed` runs twice without error, and a row count query shows 5 shelters.

- [x] **3. Shelter list API (20 min).** `GET /shelters?lat=&lng=&zip=&filters=`. Returns shelters sorted by distance, with counts per category, `updatedAt`, `hoursAgo`, `expired` (true past 24 hours, count omitted), and `mostRecent` on the newest.
  - Files: `api/src/shelters.ts`, `api/src/index.ts`
  - Done: `curl` returns 5 shelters, one with `expired: true` and no count, exactly one with `mostRecent: true`.

- [x] **4. Client list (20 min).** List of cards: name, distance, counts, "Updated X hours ago" badge, "Most recently updated" badge, and the "No recent update. Call to confirm." state. A "Demo data" label on the screen.
  - Files: `app/App.tsx`, `app/src/api.ts`, `app/src/types.ts`, `app/src/ShelterList.tsx`, `app/src/ShelterCard.tsx`
  - Done: the browser shows all 5 cards with the correct badges, checked against the `curl` output.

- [x] **5. Staff login and count update (25 min).** `POST /auth/login` returns a JWT. `PUT /shelters/:id/counts` requires the JWT and rejects a shelter the user is not linked to. Staff screen: login form, plus and minus per category, save.
  - Files: `api/src/auth.ts`, `api/src/index.ts`, `app/src/StaffScreen.tsx`, `app/App.tsx`
  - Done: a saved count shows on the client list with "Updated just now". A request for another shelter returns 403.

- [x] **6. Call and ZIP location (10 min).** Call button uses `Linking.openURL("tel:...")`. ZIP input re-sorts the list.
  - Files: `app/src/ShelterCard.tsx`, `app/src/LocationBar.tsx`
  - Done: typing a seeded ZIP changes the order, and Call opens the dialer on a phone.

- [x] **7. Filters (15 min).** Six toggles: women only, men only, co-ed, family, dog allowed, wheelchair access. Sent as the `filters` query parameter.
  - Files: `app/src/Filters.tsx`, `app/src/ShelterList.tsx`
  - Done: "women only" shows only the seeded women-only shelters.

- [x] **8. Device GPS (10 min).** "Use my location" button with `expo-location`. If permission is denied, show the ZIP input.
  - Files: `app/src/LocationBar.tsx`
  - Done: allowing location sorts the list, and denying it leaves the ZIP path working.

- [x] **9. Directions (5 min).** Button opens the map app with the shelter address.
  - Files: `app/src/ShelterCard.tsx`
  - Done: tapping Directions opens maps with the right address.

## Stubs and mocks
- Tax/Business ID: format check in the seed script only.
- Shelter approval: an `approved` column, set to true in the seed.
- ZIP lookup: seeded table of ZIP codes for the demo city only.
- No admin UI. Edit `seed.ts` to change attributes.

## Environment variables
```
DATABASE_URL=postgres://shelter:shelter@localhost:5432/shelter
JWT_SECRET=
SEED_STAFF_PASSWORD=
EXPO_PUBLIC_API_URL=http://localhost:4000
```
For a phone on the same Wi-Fi, set `EXPO_PUBLIC_API_URL` to the laptop's LAN address.

## Setup commands
```
docker compose up -d
cd api && npm install && npm run seed && npm run dev
cd app && npm install && npx expo start --web
```

## Checkpoint
At 45 minutes, slices 1 to 3 must be done. If they are not, skip slices 7 to 9 and go straight to slice 5 after slice 4.

## Build notes (what changed from this plan)
- All nine slices are built. Slices 1 to 7 were checked in a browser against the running API. Device GPS (slice 8) and the Call and Directions hand-offs (slices 6 and 9) are written but were not exercised on a phone.
- Navigation uses Expo Router, as the Expo template's project notes require. Screens are `app/src/app/index.tsx` (public list) and `app/src/app/staff.tsx`; components are in `app/src/components/`. There is no `App.tsx`.
- Shelter attributes are a `tags` text array on `shelters`, not a separate `shelter_attributes` table.
- Six demo shelters are seeded, not five: the sixth is full, so the "Full right now" state is on screen.
- Sort order: shelters with open beds first, then full ones, then expired ones. Inside each group, nearest first when a location is set.
- An unknown ZIP shows a message and falls back to the unsorted list.
- Demo data now uses four real Birmingham shelters from HUD's 2025 Housing Inventory Count (names and total beds), with public addresses and phones. Open-bed counts and amenity tags are simulated. The README lists each field's source and what was left out.
- Each count now carries the shelter's total beds. Staff cannot publish more open beds than the total.

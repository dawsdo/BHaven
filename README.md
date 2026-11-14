# Open Beds

Shelters post their live open beds in seconds, and people who need a bed see which shelters have space now, with no sign-up.

Hackathon MVP for Birmingham, AL. The four shelters in the app are real, but the open-bed counts are simulated. See "Where the data comes from" below.

## What it does

- **Public list (no account):** shelters sorted nearest first, open beds per category, and an "Updated X ago" badge on each card.
- **Freshness:** the newest update gets a "Most recently updated" badge. A count older than 24 hours is withheld and shows "No recent update. Call to confirm."
- **Location:** type a ZIP code or use device location. Location is used once to sort the list and is never saved or logged.
- **Filters:** women only, men only, co-ed, families, dogs allowed, wheelchair access.
- **Contact:** Call and Directions on every card.
- **Shelter staff:** sign in, set the open beds, publish. A staff account can only update its own shelter.

## Run it

Needs Node 20 or later and Docker.

```bash
cp .env.example .env        # then fill in JWT_SECRET and SEED_STAFF_PASSWORD
docker compose up -d
cd api && npm install && npm run seed && npm run dev
```

In a second terminal, for development with live reload:

```bash
cd app && npm install && npm run web
```

Open http://localhost:8081 for the public list and http://localhost:8081/staff for the staff screen.

### Demo mode: one address

For the demo, build the web app once and let the API server serve it. There is then one address for everything and no dev server to keep alive:

```bash
cd api && npm run demo      # builds the web app, reseeds, starts the server
```

Open http://localhost:4000 for the public list and http://localhost:4000/staff for the staff screen. Rebuild after any change to `app/`.

The public list refreshes every 5 seconds and whenever its tab comes back to the front, so a published count shows up almost at once. A staff member stays signed in while moving between the two screens and across a page reload, until the tab is closed.

If the list shows "Can't refresh right now", the server has lost the database. Check the server's terminal: it prints the command to fix it (`docker compose up -d` or `npm run seed`).

### On a phone

The phone has to be able to reach the laptop. Many venue and office Wi-Fi networks block devices from reaching each other, and phone browsers only allow location on an `https` address. A tunnel to port 4000 solves both; a phone hotspot solves only the first.

The iOS Simulator needs a full Xcode install, which this project does not otherwise require.

## Demo logins

Each shelter has one made-up staff account for the demo. The password for all of them is the `SEED_STAFF_PASSWORD` value in `.env`.

| Shelter | Demo staff email |
| --- | --- |
| Firehouse Shelter | `staff@firehouse-demo.example` |
| Pathways Stepping Stones | `staff@pathways-demo.example` |
| Salvation Army Center of Hope | `staff@salvationarmy-demo.example` |
| First Light | `staff@firstlight-demo.example` |

Run `npm run seed` in `api/` before a demo. It resets every count and makes the update times relative to now (20 minutes to 30 hours ago), so each badge state is on screen. Sign out of the staff screen first: reseeding rebuilds the accounts, and an old session can point at a different shelter.

## Where the data comes from

| Field | Source |
| --- | --- |
| Shelter names and total beds | HUD 2025 Housing Inventory Count, CoC AL-500 (Birmingham/Jefferson, St. Clair, Shelby Counties), emergency shelter section. Family rooms use the report's family units. |
| Addresses and phone numbers | Each organization's public listings, checked November 2026. Coordinates from the US Census geocoder. |
| Who each shelter serves | The HUD report's bed types and each organization's public description. |
| Open-bed counts and update times | **Simulated.** |
| "Dogs allowed" and "Wheelchair access" tags | **Simulated.** Not confirmed with any shelter. |
| Tax IDs and staff accounts | **Placeholders.** |

These organizations have not reviewed or taken part in this demo. The app labels itself "Demo: counts and amenities are simulated" on every screen.

Left out on purpose:

- **Domestic violence shelters** (YWCA Family Violence Center, SafeHouse of Shelby County). Their locations are confidential and must not be shown on a public list.
- **Housing programs that are not walk-in shelters**: permanent supportive housing, rapid re-housing, and voucher programs.
- **Shelters whose current address or phone could not be confirmed** (YWCA Interfaith Hospitality House, Three Hots and a Cot), and programs with only a few beds.

## What is real and what is mocked

| Real | Mocked for the hackathon |
| --- | --- |
| Live counts in PostgreSQL, read by the public list | Shelters are seeded and pre-approved; there is no shelter sign-up |
| Shelter names, addresses, phones, and total beds | Open-bed counts, update times, and the dog and wheelchair tags |
| 24-hour expiry enforced by the API | Tax/Business ID is format-checked only, not verified with a registry |
| Staff login (hashed passwords) limited to one shelter | ZIP lookup covers ten Birmingham ZIP codes with approximate centers |
| Distance sorting, filters, Call, Directions | No admin screen; shelter details are edited in the seed file |

## Layout

```
api/   Express + TypeScript API, all routes under /api (src/index.ts routes, src/shelters.ts queries, src/seed.ts demo data)
app/   Expo app for phone and browser (src/app screens, src/components)
docs/  MVP scope and build plan
.plans/ Product spec
```

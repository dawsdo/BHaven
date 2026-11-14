# MVP Scope: Shelter Vacancy Board

Source spec: `/Users/harshiladp/Documents/GitHub/ShiptHacks/.plans/shelter-vacancy-spec.md`
Time to demo: 2 hours (revised from an assumed 24).

## Time risk (read first)
Every must-have below is still in scope, as requested. Two hours is very tight for all of it: a backend, a database, an Expo client, a staff login and count screen, GPS, and the filters. Expect to cut from the bottom of the priority list in the next section if the build is not running within the first 45 minutes.

## One-line pitch
Shelters post their live open beds in seconds, and homeless clients see which shelters have space now, with no sign-up.

## Core journey
1. Client opens the app. The nearest shelters load with no login.
2. Client sets location, by device GPS or by typing a ZIP code.
3. Client filters by need: women only, men only, co-ed, family, dog allowed, wheelchair access.
4. Client sees each shelter's open count and an "Updated X hours ago" badge.
5. Client taps Call or Directions.
6. Shelter staff logs in and changes a count. The client list shows the new count on refresh.

## Must-haves
- [ ] Seeded data: at least 5 demo shelters in one city, labeled as demo data. Updates at under 2h, 3 to 23h, and over 24h ago.
- [ ] Client list, nearest first, with open count per category
- [ ] Freshness badge ("Updated X hours ago") on every card
- [ ] "Most recently updated" badge on the newest shelter
- [ ] Counts older than 24 hours hidden, replaced with "No recent update. Call to confirm."
- [ ] Location by device GPS, with a typed ZIP or city as the fallback
- [ ] Filters: women only, men only, co-ed, family, dog allowed, wheelchair access
- [ ] Call and Directions buttons on each card
- [ ] Staff email and password login, limited to one linked shelter
- [ ] Staff count screen: plus and minus per category, save
- [ ] Demo runs on one surface: one Expo app (phone and browser)

## Build priority if time runs short
Build in this order. If a step is not done at its time limit, cut it and move on, rather than leaving a broken feature in the demo.
1. Seed data and client list with count and freshness badge (must work first)
2. Staff login and count update (this is what makes the demo live)
3. 24-hour expiry and "Most recently updated" badge
4. Call button and ZIP location
5. Filters
6. Device GPS
7. Directions button

## Nice-to-haves (only after all must-haves pass)
- Language support filter
- Visible 30-second auto refresh
- Second web surface beyond the Expo app

## Cut list
- Shelter sign-up and admin approval screens (seeded data only)
- Admin screens for editing attributes (edit the seed file instead)
- Bed reservations or holds
- Client accounts, favorites, or history
- Report-a-problem button
- Registry checks on Tax/Business ID (format check only, in code)
- PostGIS (use a plain distance formula in code)
- Push notifications and shelter messaging
- Multi-language UI
- Next.js web app (replaced by the Expo app running in a browser)

## Demo storyline (about 90 seconds)
1. Open the client app on a phone. Show the list with the "Most recently updated" badge and one "No recent update" card.
2. Type a ZIP code, or use GPS. Show the nearest shelters first.
3. Filter to "women only" and show the result.
4. Tap Call on one shelter and Directions on another.
5. Switch to the staff login. Change a count, save, and switch back to the client view to show the new count.
6. Close on the pitch: this is live data, not a directory.

## Top risk and fallback
- **Risk:** the build is not running by the 45-minute mark, or the backend fails during the demo.
- **Fallback:** run the backend locally on the demo laptop with seeded data. If the live update fails, show the update on the staff screen and say so in the pitch. Keep a screen recording of the full flow as a backup.
- **Risk 2:** Directions or Call does not open on the demo device.
- **Fallback 2:** show the phone number and address as text on the card, and open the links only if they work during rehearsal.
- **Risk 3:** GPS permission is denied or slow on the demo device.
- **Fallback 3:** use the typed ZIP. The ZIP path must work before GPS is attempted.

## Assumptions
- Demo city is a single city, and all seeded shelters are in it.
- The demo laptop and phone are on the same network as the backend, or the backend is hosted.
- Seeded staff and admin credentials are set in environment variables, not committed.
- Tax/Business ID is format-checked only.
- Badges are computed from the last update time on read, not stored.

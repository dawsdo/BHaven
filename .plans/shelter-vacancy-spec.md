# Shelter Vacancy Board: Implementation Spec

Status: open questions resolved (see Decisions log). Ready for MVP scoping.

## Problem and target user
Homeless clients need to find shelter beds that are open right now. Shelters know their vacancies but have no fast, reliable way to publish them. Clients have no reliable place to check. The product lets shelters post live bed counts and lets clients browse those counts without signing in.

## Core user journey
1. A client opens the web or mobile app. No account or login is needed.
2. The client shares location (GPS) or enters a city or ZIP code.
3. The client sees nearby shelters with open counts, a "Updated X hours ago" badge, and accessibility or policy tags.
4. The client filters by need: women only, family, dog allowed, wheelchair access, mobility or medical support, language.
5. The client taps **Call** or **Directions**.
6. A shelter staff member updates the open count from the mobile or web app. The change appears for clients on the next refresh.

## Actors
- **Client (anonymous):** browses, calls, and gets directions. Stores nothing.
- **Shelter staff:** a seeded account tied to one shelter. Updates counts only.
- **Admin:** seeded account. Manages shelters and sets shelter attributes. Can suspend a shelter.

## Functional requirements

### FR-1 Shelter registry (pre-approved)
- Shelters exist only as seeded records for the demo. There is no public sign-up for shelters.
- Each shelter record has: legal name, Tax/Business ID, address, phone number, and approval status.
- The Tax/Business ID is format-checked when the record is created. It is not validated against a registry.
- **Acceptance:** a shelter with no approved record cannot post a count, and the API returns a clear error.

### FR-2 Staff account linked to shelter
- Staff sign in with email and password. Passwords are stored hashed.
- A staff account can update counts only for its linked shelter.
- The seeded staff email must match the shelter's admin domain.
- **Acceptance:** a staff login linked to Shelter A cannot update Shelter B's count.

### FR-3 Live vacancy counts and freshness
- Each shelter has a live open-bed count, and may define counts per category (for example, women's beds, family rooms).
- Only real-time counts are shown. There is no free-text vacancy listing.
- Each count shows an "Updated X hours ago" badge, computed from the last update time.
- A **Most recently updated** badge marks the shelter with the newest update in the current results.
- Counts expire 24 hours after their last update. An expired count is hidden and replaced with "No recent update. Call to confirm."
- **Acceptance:** after a staff update, the client view shows the new count and badge within 30 seconds. A count last updated 25 hours ago shows as expired.

### FR-4 Shelter attributes and filters
Attributes are set by the admin only. Clients filter on them.
- Population served: women only, family, men, mixed, dog allowed, pets allowed
- Accessibility: wheelchair access, mobility or medical support
- Language support: list of spoken languages

### FR-5 Location search
- Clients can share device location (permission asked each time, not stored) or type a city or ZIP.
- Results are sorted by distance from the chosen location.
- **Acceptance:** with a location set, the nearest shelter with open beds appears first.

### FR-6 Contact
- Each shelter card has a **Call** button that opens the phone dialer with the shelter's number.
- Each shelter card has a **Directions** button that opens the device map app with the shelter's address.

### FR-7 Public read API
- Clients read shelters and counts with no authentication.
- Write endpoints require a staff or admin session.
- Expired counts are filtered out by the API, not only by the client.

## UI and UX decisions
- Web (Next.js) and mobile (Expo / React Native) show the same live list. No account is needed on either.
- Default view: nearest first. The Most recently updated badge is visible on its card.
- Each shelter card shows: name, distance, open count per category, freshness badge, attribute tags, Call, and Directions.
- Staff use a simple count screen: plus and minus per category, with a save action.
- Plain language for filters and labels. Clients may be stressed, so avoid dense UI.

## Technical design
- **Database:** PostgreSQL. Tables: `organizations`, `shelters`, `staff_users`, `vacancy_counts` (with `updated_at`), `shelter_attributes`, `admin_actions`.
- **Auth:** email and password for staff and admin. Passwords hashed. Clients need no auth.
- **Apps:** one backend API. Next.js web app and Expo mobile app both call it. Share TypeScript types and API client code.
- **Location:** device GPS with a manual city or ZIP fallback. Distance computed in Postgres (PostGIS, or a lat/long distance query for the hackathon).
- **Freshness:** computed from `updated_at` on read. Badges are not stored.
- **Refresh:** clients poll the list every 30 seconds.
- **Demo data:** seed at least five fake shelters in one city, with varied counts, ages of update (some under 2h, some 3 to 23h, one over 24h), and attributes. Label all as demo data.
- **Mocks:** Tax/Business ID is format-checked only. Admin approval is the seeded registry.

## Decisions log (resolved open questions)
| # | Question | Decision | Source |
| --- | --- | --- | --- |
| 1 | Admin approval flow | Pre-approved demo shelters only. No shelter sign-up. | User |
| 2 | Directions link | Yes, Call and Directions on each card. | User |
| 3 | Staleness | "Updated X hours ago" badge, plus a Most recently updated badge. Counts expire after 24 hours. | User |
| 4 | Abuse and false counts | Not built for the hackathon. Listed as a known gap for the pitch. | Default |
| 5 | Attribute ownership | Admin sets shelter attributes. Staff update counts only. | Default |
| 6 | Location privacy | Location is never stored or logged. No analytics on location. | Default |
| 7 | Mobile stack | Expo / React Native, sharing TypeScript and API code with the Next.js web app. | User |

## Tradeoffs
| Decision | Tradeoff |
| --- | --- |
| Real-time counts only | Less detail, but less misleading free text |
| 24-hour expiry | Stops old counts from looking current. Risk: a count updated 23 hours ago can still be wrong |
| No client accounts | Lowest barrier to access. No saved favorites or reservations |
| Email and password for staff | Simple to build. Weaker than SSO |
| Pre-approved shelters | Fast for the demo, but not a real onboarding flow |
| Expo for both apps | Less native polish than separate apps, but one language and faster to ship |

## Out of scope for the hackathon
- Shelter sign-up and admin approval UI
- Bed reservations or holds
- Client accounts, saved favorites, or history
- Registry checks against government or tax databases
- Report-a-problem button for clients
- Multi-language UI (listing language support is in scope; translating the app is not)
- Push notifications
- Shelter messaging

## Remaining risks to confirm before build
1. **Expiry behavior:** this spec reads "auto expires" as hiding a count 24 hours after its last update. If you meant it should be removed from the database, tell me and I will update FR-3.
2. **Demo admin:** the seeded admin account credentials must be set in env vars, not committed.

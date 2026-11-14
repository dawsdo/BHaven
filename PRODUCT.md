# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two groups use the public shelter list, and both matter equally. Design for the first, and make sure it also works for the second.

- **A person who needs a bed tonight.** They have no housing and are looking on their own phone, in a browser, with no account.
- **A helper searching on someone's behalf.** Outreach workers, caseworkers, 211 operators, and volunteers use the same list, often many times a day, with the client next to them or on a call.

A third group keeps the list true:

- **Shelter staff.** One signed-in account per shelter. They set the number of open beds and publish it, usually between other tasks.

Assumed, not confirmed: the person needing a bed is often outdoors, under stress, and may be short on battery or mobile data.

## Product Purpose

Shelters know how many beds they have open, but people looking for a bed have no reliable place to check. This product lets each shelter publish its open beds in a few seconds, and lets anyone see which shelters have space right now.

Success means a person or helper can open the list, trust what it says, and reach a shelter that has a bed, by phone or by directions, without signing up for anything.

## Positioning

The counts are live and come from the shelters themselves. Every count shows when it was last updated, and a count older than 24 hours is withheld and replaced with "No recent update. Call to confirm."

A directory or a hotline list can say which shelters exist. It cannot say which ones have an open bed tonight, or how old that information is.

## Operating Context

- The public list is used in a phone browser, and on desktop by helpers. No sign-in.
- A person sets location by typing a ZIP code or by allowing device location. Location is used once to sort the list. It is never stored or logged.
- Each shelter card offers two actions: Call and Directions.
- Shelter staff use a separate screen at `/staff`: sign in, adjust the count per category with plus and minus, publish.
- The list refreshes every 5 seconds and when the tab returns to the front, so a published count appears almost at once.
- The current build is a hackathon MVP, demoed from a laptop browser. The demo city is Birmingham, AL.

## Capabilities and Constraints

Built and working:

- Public list sorted by availability, then by distance when a location is set.
- Counts per category: "Men's beds", "Women's beds", "Family rooms". Each shows the shelter's total next to the open count.
- Freshness: an "Updated X ago" badge on every card, and a "Most recently updated" badge on the newest.
- 24-hour expiry, enforced by the API, not only by the screen.
- Filters: Women only, Men only, Co-ed, Families, Dogs allowed, Wheelchair access.
- Staff sign-in limited to one shelter. Staff cannot publish more open beds than the shelter's total.

Terms to keep consistent: "open beds", "Updated X ago", "Most recently updated", "Full", "No recent update. Call to confirm.", "Publish".

Constraints:

- **Confidential locations are never listed.** Domestic violence shelters are left out because their locations must not appear on a public list.
- **No client accounts.** Nothing about the person looking is saved.
- One codebase (Expo with Expo Router) serves the web app. Native phone apps are not built.
- Data lives in PostgreSQL behind an Express API under `/api`.

Designed but not built:

- Shelter sign-up and verification (Tax or Business ID, plus a staff email on the organization's domain, plus admin approval). Shelters are pre-approved seed records today.
- Admin screens. Shelter details are edited in the seed file.

Not decided:

- **The product name.** See Brand Commitments.
- How a person reports a count that turned out to be wrong.
- Whether a "mobility or medical support" filter and a language filter are shown. Both were requested; neither is a filter today.
- An accessibility standard to test against.

## Brand Commitments

- **Name: undecided.** The team is still looking for a name. "Open Beds" is a working title in the code and on screen. Do not build an identity, logo, or wordmark around it.
- **Voice:** plain language. Short labels a stressed reader understands on the first pass. No jargon, no cheerfulness about a hard situation.
- No logo, brand colors, or other brand assets exist yet.

## Evidence on Hand

Real:

- Four Birmingham shelters with names and total beds from HUD's 2025 Housing Inventory Count for CoC AL-500 (Birmingham/Jefferson, St. Clair, Shelby Counties): Firehouse Shelter, Pathways Stepping Stones, Salvation Army Center of Hope, First Light.
- Their public addresses and phone numbers, checked in November 2026. Sources are listed in `README.md`.
- A running demo: `README.md` has the commands. The product spec is in `.plans/shelter-vacancy-spec.md`, the scope in `docs/mvp-scope.md`.

Simulated, and labelled on every screen as "Demo: counts and amenities are simulated":

- Open-bed counts and update times.
- The "Dogs allowed" and "Wheelchair access" tags.
- Staff accounts and tax IDs.

Absent. Future work must not invent any of these:

- No shelter has reviewed, endorsed, or used the product.
- No users, testimonials, partnerships, outcomes, or usage numbers.
- No pricing, funding, or launch claims.

## Product Principles

1. **A count is only as good as its age.** Always show when it was updated. Never show one older than 24 hours.
2. **Nothing stands between a person and the list.** No account, nothing saved about them, location used once.
3. **Say what is known, and stop there.** "Call to confirm" is better than a guess, and simulated data is labelled as simulated.
4. **Publishing takes seconds.** If updating a count is slow or fiddly for staff, the list goes stale and the product fails.
5. **Safety comes before coverage.** A shelter whose location is confidential is left off the list.

## Accessibility & Inclusion

- Accessibility and disability were named as a core need of the people looking for a bed. Wheelchair access is a filter today; mobility or medical support was requested and is not yet a filter.
- The list must work for someone who cannot or will not share location: the ZIP code path is always available.
- Motion, color, or an icon is never the only way a count's state (open, full, expired) is shown.
- A standard to test against, such as WCAG 2.2 AA, has not been chosen.

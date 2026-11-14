-- ShelterLink BHM schema (PostgreSQL). Times are Unix milliseconds stored as BIGINT.
-- Nothing here identifies the person who needs a bed: a hold is a code and a head count.
--
-- The server only creates missing tables; it does not alter existing ones. After a change
-- to this file, rebuild with: npm run reset-db

CREATE TABLE IF NOT EXISTS hosts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('shelter', 'warming', 'community')),
  -- NULL when the address is withheld or not known. Domestic violence shelters keep
  -- confidential locations by design: publishing one puts the people inside it at risk.
  address       TEXT,
  address_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  -- The only way to reach a host whose address is withheld, so it carries real weight.
  phone         TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  -- Who a host takes. takes_men / takes_women mean single adults. takes_families means any
  -- parent or parents with children, so it also covers a woman with children;
  -- takes_women_children alone does not cover other families. The app applies that rule
  -- in takes() in src/lib.js.
  takes_men            BOOLEAN NOT NULL DEFAULT FALSE,
  takes_women          BOOLEAN NOT NULL DEFAULT FALSE,
  takes_women_children BOOLEAN NOT NULL DEFAULT FALSE,
  takes_families       BOOLEAN NOT NULL DEFAULT FALSE,
  takes_youth          BOOLEAN NOT NULL DEFAULT FALSE,  -- unaccompanied young people
  youth_max_age        INTEGER CHECK (youth_max_age > 0),  -- NULL: no stated limit, or no youth
  step_free     BOOLEAN NOT NULL DEFAULT FALSE,  -- wheelchair access
  pets          BOOLEAN NOT NULL DEFAULT FALSE,
  languages     TEXT[]  NOT NULL DEFAULT '{}',   -- languages staff speak besides English
  accepting     BOOLEAN NOT NULL DEFAULT TRUE,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,  -- approved to appear in the list and post counts
  note          TEXT    NOT NULL DEFAULT '',
  -- When staff last changed or confirmed the counts. Counts older than 24 hours are withheld.
  updated_at    BIGINT  NOT NULL,
  -- A withheld location must actually be absent, not merely flagged. Without this a
  -- confidential row could still carry an address or coordinates that some future query leaks.
  CONSTRAINT hosts_confidential_has_no_location
    CHECK (NOT address_confidential OR (address IS NULL AND lat IS NULL AND lng IS NULL))
);

-- Open beds, one row per kind of bed a host has. 'any' is a bed not set aside for one group.
-- A 'family' row counts rooms (family units), every other kind counts beds.
-- capacity is the host's total of that kind (funded inventory from the HUD HIC), when
-- known. It is not vacancy. Open beds can never exceed it.
CREATE TABLE IF NOT EXISTS bed_counts (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id     INTEGER NOT NULL REFERENCES hosts (id),
  kind        TEXT    NOT NULL CHECK (kind IN ('men', 'women', 'family', 'youth', 'any')),
  beds_open   INTEGER NOT NULL DEFAULT 0 CHECK (beds_open >= 0),
  capacity    INTEGER CHECK (capacity IS NULL OR beds_open <= capacity),
  UNIQUE (host_id, kind)
);

CREATE TABLE IF NOT EXISTS holds (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  count_id    INTEGER NOT NULL REFERENCES bed_counts (id),
  code        TEXT    NOT NULL UNIQUE,
  people      INTEGER NOT NULL CHECK (people BETWEEN 1 AND 9),
  -- How much of the count this hold ties up: one bed per person, or one room for a family.
  beds        INTEGER NOT NULL CHECK (beds >= 1),
  status      TEXT    NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'arrived', 'released')),
  created_at  BIGINT  NOT NULL,
  expires_at  BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS holds_by_count ON holds (count_id, status, expires_at);

-- One sign-in per host. A NULL password_hash means the account cannot sign in yet.
CREATE TABLE IF NOT EXISTS staff_users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id       INTEGER NOT NULL REFERENCES hosts (id),
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT
);

-- Approximate ZIP code centers, so the list can be sorted by distance without a geocoding service.
CREATE TABLE IF NOT EXISTS zip_codes (
  zip   TEXT PRIMARY KEY,
  city  TEXT NOT NULL,
  lat   DOUBLE PRECISION NOT NULL,
  lng   DOUBLE PRECISION NOT NULL
);

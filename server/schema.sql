-- ShelterLink BHM schema (PostgreSQL). Times are Unix milliseconds stored as BIGINT.
-- Nothing here identifies the person who needs a bed: a hold is a code and a head count.

CREATE TABLE IF NOT EXISTS hosts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('shelter', 'warming', 'community')),
  -- NULL when the address is withheld. Domestic violence shelters keep confidential
  -- locations by design: publishing one puts the people inside it at risk.
  address       TEXT,
  address_confidential BOOLEAN NOT NULL DEFAULT FALSE,
  -- The only way to reach a host whose address is withheld, so it carries real weight.
  phone         TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  total_beds    INTEGER,  -- funded inventory (HUD HIC). Not vacancy; see beds_open.
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
  step_free     BOOLEAN NOT NULL DEFAULT FALSE,
  pets          BOOLEAN NOT NULL DEFAULT FALSE,
  beds_open     INTEGER NOT NULL DEFAULT 0 CHECK (beds_open >= 0),
  accepting     BOOLEAN NOT NULL DEFAULT TRUE,
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  note          TEXT    NOT NULL DEFAULT '',
  updated_at    BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS holds (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_id     INTEGER NOT NULL REFERENCES hosts (id),
  code        TEXT    NOT NULL UNIQUE,
  people      INTEGER NOT NULL CHECK (people BETWEEN 1 AND 9),
  status      TEXT    NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'arrived', 'released')),
  created_at  BIGINT  NOT NULL,
  expires_at  BIGINT  NOT NULL
);

CREATE INDEX IF NOT EXISTS holds_by_host ON holds (host_id, status, expires_at);

-- Migrations for databases created before these columns existed. All idempotent,
-- so this file stays safe to re-run on every start.
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS address_confidential BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS total_beds INTEGER;
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE hosts ALTER COLUMN address DROP NOT NULL;

-- A withheld address must actually be absent, not merely flagged. Without this a
-- confidential row could still carry a street address that some future query leaks.
ALTER TABLE hosts DROP CONSTRAINT IF EXISTS hosts_confidential_has_no_address;
ALTER TABLE hosts ADD CONSTRAINT hosts_confidential_has_no_address
  CHECK (NOT address_confidential OR address IS NULL);

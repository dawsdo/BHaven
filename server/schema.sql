-- ShelterLink BHM schema (PostgreSQL). Times are Unix milliseconds stored as BIGINT.
-- Nothing here identifies the person who needs a bed: a hold is a code and a head count.

CREATE TABLE IF NOT EXISTS hosts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('shelter', 'warming', 'community')),
  address       TEXT    NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  takes_men     BOOLEAN NOT NULL DEFAULT FALSE,
  takes_women   BOOLEAN NOT NULL DEFAULT FALSE,
  takes_family  BOOLEAN NOT NULL DEFAULT FALSE,
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

-- ShelterLink BHM schema (SQLite). Times are Unix milliseconds.
-- Nothing here identifies the person who needs a bed: a hold is a code and a head count.

CREATE TABLE IF NOT EXISTS hosts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK (type IN ('shelter', 'warming', 'community')),
  address       TEXT    NOT NULL,
  lat           REAL,
  lng           REAL,
  takes_men     INTEGER NOT NULL DEFAULT 0,
  takes_women   INTEGER NOT NULL DEFAULT 0,
  takes_family  INTEGER NOT NULL DEFAULT 0,
  step_free     INTEGER NOT NULL DEFAULT 0,
  pets          INTEGER NOT NULL DEFAULT 0,
  beds_open     INTEGER NOT NULL DEFAULT 0 CHECK (beds_open >= 0),
  accepting     INTEGER NOT NULL DEFAULT 1,
  verified      INTEGER NOT NULL DEFAULT 0,
  note          TEXT    NOT NULL DEFAULT '',
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS holds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id     INTEGER NOT NULL REFERENCES hosts(id),
  code        TEXT    NOT NULL UNIQUE,
  people      INTEGER NOT NULL CHECK (people BETWEEN 1 AND 9),
  status      TEXT    NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'arrived', 'released')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS holds_by_host ON holds (host_id, status, expires_at);

-- ShelterLink BHM schema (MySQL 8). Times are Unix milliseconds stored as BIGINT.
-- Nothing here identifies the person who needs a bed: a hold is a code and a head count.

CREATE TABLE IF NOT EXISTS hosts (
  id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  type          ENUM('shelter', 'warming', 'community') NOT NULL,
  address       VARCHAR(200) NOT NULL,
  lat           DOUBLE       NULL,
  lng           DOUBLE       NULL,
  takes_men     TINYINT(1)   NOT NULL DEFAULT 0,
  takes_women   TINYINT(1)   NOT NULL DEFAULT 0,
  takes_family  TINYINT(1)   NOT NULL DEFAULT 0,
  step_free     TINYINT(1)   NOT NULL DEFAULT 0,
  pets          TINYINT(1)   NOT NULL DEFAULT 0,
  beds_open     INT          NOT NULL DEFAULT 0,
  accepting     TINYINT(1)   NOT NULL DEFAULT 1,
  verified      TINYINT(1)   NOT NULL DEFAULT 0,
  note          VARCHAR(500) NOT NULL DEFAULT '',
  updated_at    BIGINT       NOT NULL,
  CONSTRAINT hosts_beds_not_negative CHECK (beds_open >= 0)
);

CREATE TABLE IF NOT EXISTS holds (
  id          INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  host_id     INT         NOT NULL,
  code        VARCHAR(16) NOT NULL UNIQUE,
  people      INT         NOT NULL,
  status      ENUM('held', 'arrived', 'released') NOT NULL DEFAULT 'held',
  created_at  BIGINT      NOT NULL,
  expires_at  BIGINT      NOT NULL,
  CONSTRAINT holds_people_range CHECK (people BETWEEN 1 AND 9),
  CONSTRAINT holds_host FOREIGN KEY (host_id) REFERENCES hosts (id),
  INDEX holds_by_host (host_id, status, expires_at)
);

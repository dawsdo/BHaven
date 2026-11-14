-- Reference data loaded with the list of places. The places themselves come from
-- data/organizations_seed.csv (see server/load-hic.js).

-- Approximate centers of Birmingham, AL ZIP codes, so the list can be sorted by distance
-- from a typed ZIP code without a geocoding service.
INSERT INTO zip_codes (zip, city, lat, lng) VALUES
  ('35203', 'Birmingham', 33.5186, -86.8104),
  ('35204', 'Birmingham', 33.5220, -86.8370),
  ('35205', 'Birmingham', 33.4950, -86.8080),
  ('35206', 'Birmingham', 33.5700, -86.7150),
  ('35209', 'Birmingham', 33.4650, -86.8080),
  ('35211', 'Birmingham', 33.4810, -86.8590),
  ('35212', 'Birmingham', 33.5420, -86.7520),
  ('35222', 'Birmingham', 33.5240, -86.7700),
  ('35233', 'Birmingham', 33.5080, -86.8010),
  ('35234', 'Birmingham', 33.5410, -86.8030);

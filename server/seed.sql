-- DEMO DATA. The organizations are real Birmingham providers, but the bed counts,
-- step-free and pet flags, and coordinates below are placeholders for the demo.
-- Confirm everything with each organization before showing this as live data.
--
-- Who each host takes is also a placeholder. The six columns after lng are:
--   men, women, women with children, families, youth, youth_max_age
-- No demo host takes unaccompanied youth, so youth_max_age is NULL throughout.

WITH t AS (SELECT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT AS now_ms)
INSERT INTO hosts
  (name, type, address, lat, lng, takes_men, takes_women, takes_women_children, takes_families, takes_youth, youth_max_age, step_free, pets, beds_open, accepting, verified, note, updated_at)
SELECT v.name, v.type, v.address, v.lat, v.lng, v.takes_men, v.takes_women,
       v.takes_women_children, v.takes_families, v.takes_youth, v.youth_max_age,
       v.step_free, v.pets, v.beds_open, v.accepting, TRUE, v.note, t.now_ms - v.mins_ago * 60000
FROM t, (VALUES
  ('First Light',                           'shelter',   'Downtown',            33.5185, -86.8050, FALSE, TRUE,  TRUE,  FALSE, FALSE, NULL::INTEGER, TRUE,  FALSE,  4, TRUE,  '',                              5),
  ('Firehouse Ministries',                  'shelter',   '626 2nd Ave N',       33.5120, -86.8230, TRUE,  FALSE, FALSE, FALSE, FALSE, NULL,          TRUE,  FALSE,  9, TRUE,  '',                             12),
  ('Jimmie Hale Mission Men''s Center',     'shelter',   '3420 2nd Ave N',      33.5250, -86.7830, TRUE,  FALSE, FALSE, FALSE, FALSE, NULL,          FALSE, FALSE, 12, TRUE,  '',                            200),
  ('Salvation Army Center of Hope',         'shelter',   '2015 26th Ave N',     33.5440, -86.8170, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  TRUE,   7, TRUE,  '',                              2),
  ('Pathways',                              'shelter',   'Downtown',            33.5180, -86.8080, FALSE, TRUE,  TRUE,  FALSE, FALSE, NULL,          TRUE,  FALSE,  0, TRUE,  '',                             40),
  ('Warming station (Jimmie Hale Mission)', 'warming',   '1569 Cooper Hill Rd', 33.5560, -86.6900, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  FALSE,  0, FALSE, 'Opens on freeze nights.',      60),
  ('Sample Community Host (demo)',          'community', '[ADDRESS]',           33.5070, -86.8000, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  FALSE,  6, TRUE,  'Side entrance. Ring the bell.', 20)
) AS v (name, type, address, lat, lng, takes_men, takes_women, takes_women_children, takes_families, takes_youth, youth_max_age, step_free, pets, beds_open, accepting, note, mins_ago);

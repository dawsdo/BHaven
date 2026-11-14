-- DEMO DATA. Every organization here is a real Birmingham provider, except the sample community host.
--
-- Real, for First Light, Firehouse Shelter, Pathways Stepping Stones and Salvation Army Center of Hope:
--   names and bed capacity from HUD's 2025 Housing Inventory Count for CoC AL-500
--   (Birmingham/Jefferson, St. Clair, Shelby Counties); family capacity is the report's family units.
--   Addresses and phone numbers from each organization's public listings, checked November 2026.
--   Coordinates from the US Census geocoder.
--
-- Placeholder or simulated, for every host: open-bed counts, update times, the step-free and pet
--   flags, who each host takes, tax IDs and staff accounts. For the two Jimmie Hale Mission
--   hosts and the sample host, coordinates are placeholders too and no phone number is listed.
--
-- These organizations have not reviewed or taken part in this demo. Confirm everything with
-- each one before showing this as live data.
--
-- Left out on purpose: domestic violence shelters (their locations are confidential and must
-- never appear on a public list), housing voucher programs, and shelters whose address or
-- phone could not be confirmed.

INSERT INTO organizations (legal_name, tax_id, email_domain) VALUES
  ('Firehouse Ministries',                     '00-0000001', 'firehouse-demo.example'),
  ('Pathways',                                 '00-0000002', 'pathways-demo.example'),
  ('The Salvation Army of Greater Birmingham', '00-0000003', 'salvationarmy-demo.example'),
  ('First Light',                              '00-0000004', 'firstlight-demo.example'),
  ('Jimmie Hale Mission',                      '00-0000005', 'jimmiehale-demo.example');

-- The six flags after lng are: men, women, women with children, families, youth, youth_max_age.
-- No demo host takes unaccompanied youth, so youth_max_age is NULL throughout.
-- First Light was last updated 30 hours ago on purpose, so the 24-hour expiry is on screen.
WITH t AS (SELECT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT AS now_ms)
INSERT INTO hosts
  (organization_id, name, type, address, phone, lat, lng,
   takes_men, takes_women, takes_women_children, takes_families, takes_youth, youth_max_age,
   step_free, pets, accepting, verified, note, updated_at)
SELECT (SELECT id FROM organizations WHERE tax_id = v.tax_id), v.name, v.type, v.address, v.phone, v.lat, v.lng,
       v.takes_men, v.takes_women, v.takes_women_children, v.takes_families, v.takes_youth, v.youth_max_age,
       v.step_free, v.pets, v.accepting, TRUE, v.note, t.now_ms - v.mins_ago * 60000
FROM t, (VALUES
  ('00-0000004', 'First Light',                           'shelter',   '2230 4th Ave N, Birmingham, AL 35203',                  '205-323-4277', 33.51877, -86.80436, FALSE, TRUE,  TRUE,  FALSE, FALSE, NULL::INTEGER, FALSE, FALSE, TRUE,  '',                              1800),
  ('00-0000001', 'Firehouse Shelter',                     'shelter',   '626 2nd Ave N, Birmingham, AL 35203',                   '205-252-9571', 33.50646, -86.82518, TRUE,  FALSE, FALSE, FALSE, FALSE, NULL,          TRUE,  FALSE, TRUE,  '',                                20),
  ('00-0000005', 'Jimmie Hale Mission Men''s Center',     'shelter',   '3420 2nd Ave N, Birmingham, AL',                        '',             33.52500, -86.78300, TRUE,  FALSE, FALSE, FALSE, FALSE, NULL,          FALSE, FALSE, TRUE,  '',                               200),
  ('00-0000003', 'Salvation Army Center of Hope',         'shelter',   '2015 26th Ave N, Birmingham, AL 35234',                 '205-328-2420', 33.54496, -86.82457, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  TRUE,  TRUE,  '',                               300),
  ('00-0000002', 'Pathways Stepping Stones',              'shelter',   '409 Richard Arrington Jr Blvd N, Birmingham, AL 35203', '205-322-6854', 33.51838, -86.80641, FALSE, TRUE,  TRUE,  FALSE, FALSE, NULL,          FALSE, FALSE, TRUE,  '',                                90),
  ('00-0000005', 'Warming station (Jimmie Hale Mission)', 'warming',   '1569 Cooper Hill Rd, Birmingham, AL',                   '',             33.55600, -86.69000, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  FALSE, FALSE, 'Opens on freeze nights.',         60),
  (NULL,         'Sample Community Host (demo)',          'community', '[ADDRESS]',                                             '',             33.50700, -86.80000, TRUE,  TRUE,  TRUE,  TRUE,  FALSE, NULL,          TRUE,  FALSE, TRUE,  'Side entrance. Ring the bell.',   20)
) AS v (tax_id, name, type, address, phone, lat, lng,
        takes_men, takes_women, takes_women_children, takes_families, takes_youth, youth_max_age,
        step_free, pets, accepting, note, mins_ago);

-- Open beds per kind. capacity is the HUD total where there is one; open counts are simulated.
INSERT INTO bed_counts (host_id, kind, beds_open, capacity)
SELECT h.id, v.kind, v.beds_open, v.capacity
FROM (VALUES
  ('First Light',                           'women',   4,  25),
  ('Firehouse Shelter',                     'men',    14, 100),
  ('Jimmie Hale Mission Men''s Center',     'men',    12, NULL),
  ('Salvation Army Center of Hope',         'men',     9,  85),
  ('Salvation Army Center of Hope',         'women',   6,  40),
  ('Salvation Army Center of Hope',         'family',  0,   8),
  ('Pathways Stepping Stones',              'women',   3,   8),
  ('Pathways Stepping Stones',              'family',  1,   5),
  ('Warming station (Jimmie Hale Mission)', 'any',     0, NULL),
  ('Sample Community Host (demo)',          'any',     6, NULL)
) AS v (host, kind, beds_open, capacity)
JOIN hosts h ON h.name = v.host;

-- One made-up staff account per host. The server sets every password to SEED_STAFF_PASSWORD.
INSERT INTO staff_users (host_id, email)
SELECT h.id, v.email
FROM (VALUES
  ('First Light',                           'staff@firstlight-demo.example'),
  ('Firehouse Shelter',                     'staff@firehouse-demo.example'),
  ('Jimmie Hale Mission Men''s Center',     'staff@jimmiehale-demo.example'),
  ('Salvation Army Center of Hope',         'staff@salvationarmy-demo.example'),
  ('Pathways Stepping Stones',              'staff@pathways-demo.example'),
  ('Warming station (Jimmie Hale Mission)', 'warming@jimmiehale-demo.example'),
  ('Sample Community Host (demo)',          'staff@samplehost-demo.example')
) AS v (host, email)
JOIN hosts h ON h.name = v.host;

-- Approximate centers of Birmingham, AL ZIP codes.
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

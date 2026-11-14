-- OPTIONAL, SIMULATED. Applied only by `npm run demo-db`, never on a normal start.
--
-- The real list loads with nothing reported, because nobody publishes vacancy and this
-- project does not invent it. For a walkthrough it helps to open with every state already
-- on screen, so this file pretends that the four shelters from the Open Beds MVP have
-- reported. Every number below is made up: the open beds, how long ago they were
-- reported, and the step-free and pets flags. Do not run this against a database that
-- real hosts are reporting into.
--
-- Hosts are matched by their demo staff email, which is unique per host.

-- Open beds per kind.
UPDATE bed_counts c
   SET beds_open = v.beds_open
  FROM (VALUES
    ('staff@firehouse-demo.example',       'men',    14),
    ('staff@pathways-demo.example',        'women',   3),
    ('staff@pathways-demo.example',        'family',  1),
    ('mens@salvationarmy-demo.example',    'men',     9),
    ('womens@salvationarmy-demo.example',  'women',   6),
    ('family@salvationarmy-demo.example',  'family',  0),
    ('staff@firstlight-demo.example',      'women',   4)
  ) AS v (email, kind, beds_open)
  JOIN staff_users s ON s.email = v.email
 WHERE c.host_id = s.host_id AND c.kind = v.kind;

-- When each "reported", and its amenity flags. First Light is 30 hours old on purpose,
-- so the 24-hour cutoff is on screen: its count is stored but withheld.
UPDATE hosts h
   SET updated_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT - v.mins_ago * 60000,
       step_free = v.step_free,
       pets = v.pets
  FROM (VALUES
    ('staff@firehouse-demo.example',         20, TRUE,  FALSE),
    ('staff@pathways-demo.example',          90, FALSE, FALSE),
    ('mens@salvationarmy-demo.example',     300, TRUE,  TRUE),
    ('womens@salvationarmy-demo.example',   300, TRUE,  TRUE),
    ('family@salvationarmy-demo.example',   300, TRUE,  TRUE),
    ('staff@firstlight-demo.example',      1800, FALSE, FALSE)
  ) AS v (email, mins_ago, step_free, pets)
  JOIN staff_users s ON s.email = v.email
 WHERE h.id = s.host_id;

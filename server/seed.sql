-- DEMO DATA. The organizations are real Birmingham providers, but the bed counts,
-- step-free and pet flags, and coordinates below are placeholders for the demo.
-- Confirm everything with each organization before showing this as live data.

INSERT INTO hosts
  (name, type, address, lat, lng, takes_men, takes_women, takes_family, step_free, pets, beds_open, accepting, verified, note, updated_at)
VALUES
  ('First Light', 'shelter', 'Downtown',
    33.5185, -86.8050, 0, 1, 1, 1, 0, 4, 1, 1, '', UNIX_TIMESTAMP() * 1000 - 5 * 60000),
  ('Firehouse Ministries', 'shelter', '626 2nd Ave N',
    33.5120, -86.8230, 1, 0, 0, 1, 0, 9, 1, 1, '', UNIX_TIMESTAMP() * 1000 - 12 * 60000),
  ('Jimmie Hale Mission Men''s Center', 'shelter', '3420 2nd Ave N',
    33.5250, -86.7830, 1, 0, 0, 0, 0, 12, 1, 1, '', UNIX_TIMESTAMP() * 1000 - 200 * 60000),
  ('Salvation Army Center of Hope', 'shelter', '2015 26th Ave N',
    33.5440, -86.8170, 1, 1, 1, 1, 1, 7, 1, 1, '', UNIX_TIMESTAMP() * 1000 - 2 * 60000),
  ('Pathways', 'shelter', 'Downtown',
    33.5180, -86.8080, 0, 1, 1, 1, 0, 0, 1, 1, '', UNIX_TIMESTAMP() * 1000 - 40 * 60000),
  ('Warming station (Jimmie Hale Mission)', 'warming', '1569 Cooper Hill Rd',
    33.5560, -86.6900, 1, 1, 1, 1, 0, 0, 0, 1, 'Opens on freeze nights.', UNIX_TIMESTAMP() * 1000 - 60 * 60000),
  ('Sample Community Host (demo)', 'community', '[ADDRESS]',
    33.5070, -86.8000, 1, 1, 1, 1, 0, 6, 1, 1, 'Side entrance. Ring the bell.', UNIX_TIMESTAMP() * 1000 - 20 * 60000);

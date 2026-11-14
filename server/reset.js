// Drops the tables and rebuilds them from data/organizations_seed.csv: npm run reset-db
// With --demo it also applies the simulated counts in demo.sql: npm run demo-db
import { dropTables, initDb, pool } from './db.js';

try {
  await dropTables();
  await initDb({ demo: process.argv.includes('--demo') });
  console.log('Database reset.');
} catch (err) {
  console.error('Reset failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

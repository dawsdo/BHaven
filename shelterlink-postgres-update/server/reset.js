// Drops and re-creates the demo tables with fresh seed data: npm run reset-db
import { dropTables, initDb, pool } from './db.js';

try {
  await dropTables();
  await initDb();
  console.log('Database reset.');
} catch (err) {
  console.error('Reset failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

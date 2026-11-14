import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_FILE = process.env.DB_FILE || path.join(here, 'data.db');

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

// Seed once, the first time the database file is created.
const { n } = db.prepare('SELECT COUNT(*) AS n FROM hosts').get();
if (n === 0) {
  db.exec(fs.readFileSync(path.join(here, 'seed.sql'), 'utf8'));
  console.log('Seeded demo hosts into', DB_FILE);
}

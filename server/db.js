import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Connection settings come from .env (copy .env.example and fill in your password).
const config = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || ''
};
export const DB_NAME = process.env.PGDATABASE || 'shelterlink';
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error('PGDATABASE may only contain letters, numbers and underscores');
}

export const pool = new pg.Pool({ ...config, database: DB_NAME, max: 10 });

// Without this handler, a dropped idle connection (for example Docker restarting) crashes the server.
pool.on('error', (err) => {
  console.error('Database connection dropped. It will reconnect on the next request.', err.message);
});

const readSql = (file) => fs.readFileSync(path.join(here, file), 'utf8');

// Creates the database if it is missing (connects to the built-in "postgres" database to do it).
async function ensureDatabase() {
  const admin = new pg.Client({ ...config, database: 'postgres' });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (found.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${DB_NAME}"`);
      console.log(`Created PostgreSQL database "${DB_NAME}"`);
    }
  } finally {
    await admin.end();
  }
}

// Creates the tables if they are missing, and seeds demo hosts once.
export async function initDb() {
  await ensureDatabase();
  await pool.query(readSql('schema.sql'));
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM hosts');
  if (Number(rows[0].n) === 0) {
    await pool.query(readSql('seed.sql'));
    console.log(`Seeded demo hosts into PostgreSQL database "${DB_NAME}"`);
    // The seed file creates the demo staff accounts without a password, so none is ever committed.
    const password = process.env.SEED_STAFF_PASSWORD;
    if (password) {
      await pool.query('UPDATE staff_users SET password_hash = $1', [await hashPassword(password)]);
    } else {
      console.log('SEED_STAFF_PASSWORD is not set, so no demo staff account can sign in.');
      console.log('Add it to .env, then run: npm run reset-db');
    }
  }
}

// Drops the demo tables. Used by: npm run reset-db
export async function dropTables() {
  await ensureDatabase();
  await pool.query('DROP TABLE IF EXISTS holds, staff_users, bed_counts, hosts, organizations, zip_codes');
}

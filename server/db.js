import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Hosted PostgreSQL (Supabase, Neon, RDS) requires TLS and will refuse a plain
// connection. Local Docker PostgreSQL does not offer TLS at all, so this stays
// off unless PGSSL=true.
const useSsl = /^(true|require|1)$/i.test(process.env.PGSSL || '');

// Connection settings come from .env (copy .env.example and fill in your password).
const config = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  // Managed providers terminate TLS with their own CA. We still encrypt; we just
  // do not pin the chain, which is standard for a connection string you were handed.
  ssl: useSsl ? { rejectUnauthorized: false } : undefined
};
export const DB_NAME = process.env.PGDATABASE || 'shelterlink';
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error('PGDATABASE may only contain letters, numbers and underscores');
}

// A blank PGHOST silently falls back to 127.0.0.1 and the only symptom is
// ECONNREFUSED on port 5432, which looks like a dead database rather than an
// unfilled .env. Say what is actually wrong instead.
if (useSsl) {
  const missing = ['PGHOST', 'PGUSER', 'PGPASSWORD'].filter((k) => !(process.env[k] || '').trim());
  if (missing.length) {
    console.error(
      `\n.env is incomplete: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} empty.\n\n` +
        'PGSSL=true means a hosted database, so these cannot be left blank.\n' +
        'Supabase: Project Settings -> Database -> Connection string -> Session pooler.\n' +
        'That string is postgresql://PGUSER:PGPASSWORD@PGHOST:5432/postgres\n\n' +
        'For a local Docker database instead, remove PGSSL and PGCREATE_DB from .env.\n'
    );
    process.exit(1);
  }
}

// A managed database already exists and the login usually cannot run CREATE DATABASE.
// Set PGCREATE_DB=false for Supabase and friends; leave it alone for local Docker.
const canCreateDatabase = !/^(false|0|no)$/i.test(process.env.PGCREATE_DB || '');

export const pool = new pg.Pool({ ...config, database: DB_NAME, max: 10 });

const readSql = (file) => fs.readFileSync(path.join(here, file), 'utf8');

// Creates the database if it is missing (connects to the built-in "postgres" database to do it).
// Skipped against a managed provider, where the database is already there.
async function ensureDatabase() {
  if (!canCreateDatabase) return;
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
  }
}

// Drops the demo tables. Used by: npm run reset-db
export async function dropTables() {
  await ensureDatabase();
  await pool.query('DROP TABLE IF EXISTS holds; DROP TABLE IF EXISTS hosts;');
}

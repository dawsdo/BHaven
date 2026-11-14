import 'dotenv/config';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Connection settings come from .env (copy .env.example and fill in your password).
const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || ''
};
export const DB_NAME = process.env.MYSQL_DATABASE || 'shelterlink';
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error('MYSQL_DATABASE may only contain letters, numbers and underscores');
}

export const pool = mysql.createPool({ ...config, database: DB_NAME, connectionLimit: 10 });

const readSql = (file) => fs.readFileSync(path.join(here, file), 'utf8');

// Creates the database and tables if they are missing, and seeds demo hosts once.
export async function initDb() {
  const admin = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`);
    await admin.query(`USE \`${DB_NAME}\``);
    await admin.query(readSql('schema.sql'));
    const [[{ n }]] = await admin.query('SELECT COUNT(*) AS n FROM hosts');
    if (Number(n) === 0) {
      await admin.query(readSql('seed.sql'));
      console.log(`Seeded demo hosts into MySQL database "${DB_NAME}"`);
    }
  } finally {
    await admin.end();
  }
}

// Drops the demo tables. Used by: npm run reset-db
export async function dropTables() {
  const admin = await mysql.createConnection({ ...config, multipleStatements: true });
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`);
    await admin.query(`USE \`${DB_NAME}\`; DROP TABLE IF EXISTS holds; DROP TABLE IF EXISTS hosts;`);
  } finally {
    await admin.end();
  }
}

// Wipes the demo database so the next start re-seeds it: npm run reset-db
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.env.DB_FILE || path.join(here, 'data.db');
for (const f of [file, file + '-wal', file + '-shm']) {
  if (fs.existsSync(f)) fs.rmSync(f);
}
console.log('Database removed. It will be re-seeded on the next start.');

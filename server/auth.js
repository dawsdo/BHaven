// Staff sign-in, built on Node's own crypto: scrypt for passwords, an HMAC-signed token for sessions.
import 'dotenv/config';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const SESSION_MS = 8 * 60 * 60000;
const HASH_BYTES = 64;

// With no SESSION_SECRET a fresh key is made on every start, so a restart signs all staff out.
const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, HASH_BYTES);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

export async function passwordMatches(password, stored) {
  const [salt, hash] = (stored || '').split(':');
  const want = Buffer.from(hash || '', 'hex');
  if (!salt || want.length !== HASH_BYTES) return false;
  const got = await scrypt(password, Buffer.from(salt, 'hex'), HASH_BYTES);
  return crypto.timingSafeEqual(got, want);
}

const sign = (body) => crypto.createHmac('sha256', secret).update(body).digest('base64url');

// A token is "<session as base64url JSON>.<signature>". `session` is { staffId, hostId }.
export function makeToken(session) {
  const body = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + SESSION_MS })).toString('base64url');
  return body + '.' + sign(body);
}

// Returns the session, or null when the token is missing, forged or expired.
export function readToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(signature);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  const session = JSON.parse(Buffer.from(body, 'base64url').toString());
  return session.exp > Date.now() ? session : null;
}

// Express middleware: lets the request through with req.staff set, or answers 401.
export function requireStaff(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to manage your place.' });
  req.staff = readToken(header.slice(7));
  if (!req.staff) return res.status(401).json({ error: 'Your session has ended. Sign in again.' });
  next();
}

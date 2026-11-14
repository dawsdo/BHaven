import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET is not set. Add a long random value to .env.");
}

export type StaffSession = { staffId: number; shelterId: number };

export async function login(email: string, password: string): Promise<string | null> {
  const { rows } = await pool.query(
    `select id, shelter_id, password_hash from staff_users where email = $1`,
    [email.trim().toLowerCase()],
  );
  if (rows.length === 0) return null;
  const ok = await bcrypt.compare(password, rows[0].password_hash);
  if (!ok) return null;
  const session: StaffSession = { staffId: rows[0].id, shelterId: rows[0].shelter_id };
  return jwt.sign(session, secret!, { expiresIn: "8h" });
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Sign in to update counts." });
    return;
  }
  try {
    const payload = jwt.verify(token, secret!) as StaffSession;
    res.locals.staff = { staffId: payload.staffId, shelterId: payload.shelterId };
    next();
  } catch {
    res.status(401).json({ error: "Your session has ended. Sign in again." });
  }
}

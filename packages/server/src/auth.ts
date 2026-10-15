import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { schema, type Db } from "./db";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };
export const SESSION_COOKIE = "tpc_session";
export const SESSION_DAYS = 7;
export const MIN_PASSWORD = 10;

export type Role = "admin" | "clinician" | "athlete";
export interface AuthUser { id: string; email: string; name: string; role: Role; athleteId: string | null }

declare module "express-serve-static-core" {
  interface Request { user?: AuthUser }
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(pw, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (/^(.)\1+$/.test(pw)) return "Password is too simple.";
  return null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const secureCookie = (req: Request) => process.env.NODE_ENV === "production" || req.header("x-forwarded-proto") === "https";

export async function startSession(db: Db, req: Request, res: Response, userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secureCookie(req) ? "; Secure" : ""}`);
}

export async function endSession(db: Db, req: Request, res: Response) {
  const token = parseCookies(req.header("cookie"))[SESSION_COOKIE];
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie(req) ? "; Secure" : ""}`);
}

export const randomId = () => randomUUID();

/** Loads the signed-in user (if any) from the session cookie. */
export const attachUser = (db: Db) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = parseCookies(req.header("cookie"))[SESSION_COOKIE];
    if (token) {
      const [row] = await db
        .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, athleteId: schema.users.athleteId, disabled: schema.users.disabled })
        .from(schema.sessions)
        .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
        .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
      if (row && !row.disabled) req.user = { id: row.id, email: row.email, name: row.name, role: row.role as Role, athleteId: row.athleteId };
    }
    next();
  } catch (e) { next(e); }
};

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message); }
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AuthError(401, "Sign in required."));
  if (!roles.includes(req.user.role)) return next(new AuthError(403, "You do not have access to this."));
  next();
};

/** CSRF defence for cookie auth: mutating requests must carry a custom header (cannot be sent cross-site without CORS). */
export const requireCsrfHeader = (req: Request, _res: Response, next: NextFunction) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.header("x-requested-with") !== "tpc") return next(new AuthError(403, "Missing CSRF header."));
  next();
};

/** Small in-memory limiter for login attempts (per key). Fine for a single instance. */
export function makeLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string): boolean {
      const now = Date.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) { hits.set(key, recent); return false; }
      recent.push(now); hits.set(key, recent); return true;
    },
    reset(key: string) { hits.delete(key); },
  };
}

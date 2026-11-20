import { db } from "@/lib/db";
import { cookies, headers } from "next/headers";
import crypto from "crypto";

// PROFNSI - Authentification professeur unique
// Identifiants par défaut configurables via variables d'environnement.
const DEFAULT_USERNAME = process.env.PROFNSI_USERNAME || "profnsi";
const DEFAULT_PASSWORD = process.env.PROFNSI_PASSWORD || "nsi2025";
export const SESSION_COOKIE = "profnsi_session";
const SESSION_SECRET =
  process.env.PROFNSI_SESSION_SECRET || "profnsi-local-dev-secret-change-me";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test));
}

function signToken(payload: string): string {
  const hmac = crypto.createHmac("sha256", SESSION_SECRET);
  hmac.update(payload);
  return `${payload}.${hmac.digest("hex")}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

/** S'assure qu'un compte professeur existe (créé à partir des vars d'env). */
export async function ensureTeacher() {
  const existing = await db.teacher.findUnique({ where: { id: "profnsi" } });
  if (!existing) {
    await db.teacher.create({
      data: {
        id: "profnsi",
        username: DEFAULT_USERNAME,
        passwordHash: hashPassword(DEFAULT_PASSWORD),
        email: "profnsi27@gmail.com",
      },
    });
  }
}

/** Tente une connexion. Retourne le jeton de session si OK, sinon null.
 *  Le jeton est aussi posé en cookie (SameSite=Lax) pour les contextes hors iframe. */
export async function login(
  username: string,
  password: string
): Promise<string | null> {
  await ensureTeacher();
  const teacher = await db.teacher.findUnique({ where: { id: "profnsi" } });
  if (!teacher) return null;
  if (
    teacher.username !== username ||
    !verifyPassword(password, teacher.passwordHash)
  ) {
    return null;
  }
  const payload = JSON.stringify({
    id: teacher.id,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  const token = signToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return token;
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Vérifie la session professeur côté serveur.
 *  Accepte le jeton via l'en-tête x-profnsi-token (stockage côté client,
 *  insensible au blocage des cookies tiers dans les iframes) ou via le cookie. */
export async function isTeacher(): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(SESSION_COOKIE)?.value;
  const h = await headers();
  const headerToken =
    h.get("x-profnsi-token") ||
    (h.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const token = headerToken || cookieToken;
  if (!token) return false;
  const payload = verifyToken(token);
  if (!payload) return false;
  try {
    const data = JSON.parse(payload);
    if (data.id !== "profnsi") return false;
    if (typeof data.exp === "number" && data.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/** Change le mot de passe professeur (depuis l'espace connecté). */
export async function changePassword(current: string, next: string) {
  await ensureTeacher();
  const teacher = await db.teacher.findUnique({ where: { id: "profnsi" } });
  if (!teacher) return false;
  if (!verifyPassword(current, teacher.passwordHash)) return false;
  await db.teacher.update({
    where: { id: "profnsi" },
    data: { passwordHash: hashPassword(next) },
  });
  return true;
}

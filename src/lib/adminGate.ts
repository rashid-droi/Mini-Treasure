import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

// Shared passcode gate for the whole /admin area. The access code is compared
// server-side only; the browser only ever holds an HMAC "unlocked" marker that
// reveals nothing about the code and can't be forged without JWT_SECRET.
export const ADMIN_GATE_COOKIE = "admin_gate";

const SECRET = process.env.JWT_SECRET || "super-secret-key-for-dev";

// Configure via ADMIN_ACCESS_CODE in .env. The fallback exists only so the gate
// still functions in a fresh checkout — override it for anything real.
export function getAdminCode(): string {
  return process.env.ADMIN_ACCESS_CODE || "MiniTreasure2026";
}

// Constant-time equality on two strings (hashed first to equalize length).
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function codeMatches(input: string): boolean {
  return safeEqual(input, getAdminCode());
}

// The value stored in the cookie: an HMAC of the current code. If the code is
// changed in .env, previously issued cookies stop matching automatically.
export function gateCookieValue(): string {
  return crypto.createHmac("sha256", SECRET).update(`admin-gate:${getAdminCode()}`).digest("hex");
}

export async function isAdminUnlocked(): Promise<boolean> {
  const cookie = (await cookies()).get(ADMIN_GATE_COOKIE)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, gateCookieValue());
}

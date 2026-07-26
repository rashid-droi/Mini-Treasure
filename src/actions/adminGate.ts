"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { codeMatches, gateCookieValue, ADMIN_GATE_COOKIE } from "@/lib/adminGate";

const MAX_AGE = 60 * 60 * 8; // stay unlocked for 8 hours

export async function unlockAdmin(prevState: unknown, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the access code." };
  if (!codeMatches(code)) return { error: "Incorrect access code." };

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_GATE_COOKIE, gateCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
  });

  redirect("/admin");
}

export async function lockAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_GATE_COOKIE);
  redirect("/admin");
}

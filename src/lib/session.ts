import "server-only";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Returns the acting user for organizer pages. If a valid token is present it
// uses that account; otherwise it falls back to an admin account so /admin
// opens without a login step. Returns null only if the database has
// no users at all.
export async function getSessionUser() {
  const token = (await cookies()).get("token")?.value;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (user) return user;
    }
  }

  // No / invalid token: fall back to an admin (login step removed), or any user.
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  return admin ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
}

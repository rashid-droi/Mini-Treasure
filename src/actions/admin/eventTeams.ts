"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";

// Per-team shareable code. Same alphabet/length as event join codes: no I, O, 0
// or 1 so codes stay unambiguous when read aloud or copied.
const TEAM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEAM_CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

function generateTeamCode() {
  let code = "";
  for (let i = 0; i < TEAM_CODE_LENGTH; i++) {
    code += TEAM_CODE_ALPHABET[randomInt(TEAM_CODE_ALPHABET.length)];
  }
  return code;
}

function isTeamCodeCollision(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes("code")
  );
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// Backfill: give every team in this event a shareable code. Older teams (and
// teams pre-created before codes existed) start with a null code, so the Teams
// & Scores page calls this to make sure there's always a code to hand out.
export async function ensureTeamCodes(eventId: string) {
  const teams = await prisma.team.findMany({
    where: { eventId, code: null },
    select: { id: true },
  });
  if (teams.length === 0) return;

  for (const team of teams) {
    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
      try {
        await prisma.team.update({
          where: { id: team.id },
          data: { code: generateTeamCode() },
        });
        break;
      } catch (error) {
        if (isTeamCodeCollision(error) && attempt < MAX_CODE_ATTEMPTS) continue;
        // Non-fatal: leave this team code-less rather than blocking the page.
        console.error("Failed to backfill team code:", error);
        break;
      }
    }
  }
}

export async function createTeamForEvent(eventId: string, rawName: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };

  const name = rawName.trim();
  if (!name) return { error: "Please enter a team name." };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { mode: true },
  });
  if (!event) return { error: "Event not found." };
  if (event.mode !== "TEAM") {
    return { error: "Teams can only be added to Team-mode events." };
  }

  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    try {
      await prisma.team.create({
        data: { name, eventId, code: generateTeamCode() },
      });
      revalidatePath(`/admin/events/${eventId}/teams`);
      return { success: true };
    } catch (error) {
      if (isTeamCodeCollision(error) && attempt < MAX_CODE_ATTEMPTS) continue;
      console.error("Failed to create team:", error);
      return { error: "Failed to create team." };
    }
  }
  return { error: "Failed to create team. Please try again." };
}

export async function renameTeamForEvent(teamId: string, eventId: string, rawName: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };

  const name = rawName.trim();
  if (!name) return { error: "Team name can't be empty." };

  try {
    await prisma.team.update({ where: { id: teamId }, data: { name } });
    revalidatePath(`/admin/events/${eventId}/teams`);
    return { success: true, name };
  } catch (error) {
    console.error("Failed to rename team:", error);
    return { error: "Failed to rename team." };
  }
}

export async function deleteTeamForEvent(teamId: string, eventId: string) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Unauthorized" };

  try {
    await prisma.team.delete({ where: { id: teamId } });
    revalidatePath(`/admin/events/${eventId}/teams`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete team:", error);
    return { error: "Failed to delete team." };
  }
}

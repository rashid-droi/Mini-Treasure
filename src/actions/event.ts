"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { EventStatus, Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";

// No I, O, 0 or 1 — avoids ambiguous characters when codes are shared verbally
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

function generateJoinCode() {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function isUniqueViolationOn(error: unknown, field: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}

export async function createEvent(prevState: unknown, formData: FormData) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const gameDurationStr = formData.get("gameDuration") as string;
  const maxTeamsStr = formData.get("maxTeams") as string;
  const maxTeamSizeStr = formData.get("maxTeamSize") as string;
  const modeStr = formData.get("mode") as string;
  const statusStr = formData.get("status") as EventStatus;
  const sceneId = formData.get("sceneId") as string;

  if (!name || !statusStr) {
    return { error: "Name and Status are required fields." };
  }

  if (!sceneId) {
    return { error: "Please select a scene for this event." };
  }

  const gameDuration = gameDurationStr ? parseInt(gameDurationStr, 10) : null;
  const maxTeams = maxTeamsStr ? parseInt(maxTeamsStr, 10) : null;
  const mode = modeStr === "TEAM" ? "TEAM" : "INDIVIDUAL";
  // Team size only applies to TEAM mode; ignored otherwise.
  const maxTeamSize = mode === "TEAM" && maxTeamSizeStr ? parseInt(maxTeamSizeStr, 10) : null;
  // TEAM mode: admin pre-creates this many teams, each with a shareable code
  // players type to join. Default to 4 if left blank; clamp to a sane range.
  const teamCountStr = formData.get("teamCount") as string;
  const teamCount = mode === "TEAM"
    ? Math.min(50, Math.max(1, teamCountStr ? parseInt(teamCountStr, 10) || 4 : 4))
    : 0;

  // Retry on the (unlikely) chance the generated join code collides with an existing event
  const MAX_CODE_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    try {
      await prisma.event.create({
        data: {
          name,
          description: description || null,
          joinCode: generateJoinCode(),
          gameDuration,
          maxTeams,
          maxTeamSize,
          mode,
          status: statusStr,
          sceneId,
          // Pre-create the teams (TEAM mode) so joining players can be auto-
          // assigned across them — no separate "pick a team" step.
          teams: teamCount > 0
            ? { create: Array.from({ length: teamCount }, (_, i) => ({ name: `Team ${i + 1}`, code: generateJoinCode() })) }
            : undefined,
        },
      });
      break;
    } catch (error) {
      if (isUniqueViolationOn(error, "joinCode") && attempt < MAX_CODE_ATTEMPTS) {
        continue;
      }
      console.error("Error creating event:", error);
      return { error: "Failed to create event. Scene might already be in use." };
    }
  }

  redirect("/admin/events");
}

"use server";

import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, signToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

// Players join individually: each player gets their own solo team named
// after them, so all team-scoped game mechanics keep working per-player.
// The typed name always wins. Player identity lives in a dedicated
// "player_token" cookie, separate from the account login cookie, so joining
// as a fresh player in the same browser never logs an admin out.

// Peek at an event by its join code so the join form can show the player what
// they're about to join (name + Team/Individual mode) before submitting. Only
// exposes non-sensitive fields, and only for events that are open to join.
export async function lookupEventByCode(code: string) {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (normalized.length < 6) return { found: false as const };

  try {
    // A code can be an event's join code (auto-assign) or a specific team's
    // code (join that team directly). Try the event code first, then teams.
    let event = await prisma.event.findUnique({
      where: { joinCode: normalized },
      select: { name: true, mode: true, status: true },
    });

    if (!event) {
      const team = await prisma.team.findUnique({
        where: { code: normalized },
        select: { event: { select: { name: true, mode: true, status: true } } },
      });
      event = team?.event ?? null;
    }

    if (!event || event.status === "DRAFT" || event.status === "COMPLETED") {
      return { found: false as const };
    }

    return { found: true as const, name: event.name, mode: event.mode };
  } catch {
    return { found: false as const };
  }
}

export async function joinEventByCode(prevState: unknown, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const username = String(formData.get("username") ?? "").trim();

  if (!code) {
    return { error: "Please enter a join code." };
  }
  if (!username) {
    return { error: "Please enter your name." };
  }

  const cookieStore = await cookies();
  const playerPayload = verifyToken(cookieStore.get("player_token")?.value ?? "");
  const accountPayload = verifyToken(cookieStore.get("token")?.value ?? "");

  // Reuse the identity whose name matches what was typed; otherwise a new
  // guest player is created below.
  let payload =
    playerPayload?.username === username ? playerPayload
    : accountPayload?.username === username ? accountPayload
    : null;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  };

  let eventId: string;

  try {
    // Resolve the code: an event join code auto-assigns the player to a team,
    // while a specific team's code joins that exact team.
    let event = await prisma.event.findUnique({
      where: { joinCode: code },
      include: { _count: { select: { teams: true } } },
    });
    let targetTeamId: string | null = null;

    if (!event) {
      const team = await prisma.team.findUnique({
        where: { code },
        include: { event: { include: { _count: { select: { teams: true } } } } },
      });
      if (team) {
        event = team.event;
        targetTeamId = team.id;
      }
    }

    if (!event) {
      return { error: "No event found with that code. Double-check and try again." };
    }
    if (event.status === "DRAFT") {
      return { error: "This event is not open for joining yet." };
    }
    if (event.status === "COMPLETED") {
      return { error: "This event has already finished." };
    }
    if (!event.sceneId) {
      return { error: "This event is not ready yet — the host must assign a scene in the admin panel before players can join." };
    }

    eventId = event.id;
    const isTeamMode = event.mode === "TEAM";
    // In INDIVIDUAL mode maxTeams effectively caps the number of players (one
    // team each). TEAM-mode capacity is enforced per team (maxTeamSize) below.
    const isFull = !isTeamMode && Boolean(event.maxTeams && event._count.teams >= event.maxTeams);

    // --- Establish the player's identity -------------------------------------
    if (payload) {
      if (payload === accountPayload && playerPayload) {
        // Rejoining under the signed-in account name: clear the stale guest
        // cookie so the waiting room resolves to the right identity.
        cookieStore.delete("player_token");
      }
    } else {
      const existingUser = await prisma.user.findUnique({ where: { username } });

      if (existingUser) {
        // The name is already registered. Guest names (created by earlier joins)
        // are reusable — the player just resumes that guest identity, whether
        // they're returning to THIS event or bringing the same name into a new
        // one. A name that belongs to a real (non-guest) account is still
        // protected, so players can't hijack an organiser's name.
        const isGuest = existingUser.email.endsWith("@guest.local");
        if (!isGuest) {
          const existingParticipant = await prisma.participant.findFirst({
            where: { userId: existingUser.id, team: { eventId: event.id } },
          });
          if (!existingParticipant) {
            return { error: "That name is already taken. Please pick another." };
          }
        }
        payload = { id: existingUser.id, email: existingUser.email, username: existingUser.username, role: existingUser.role };
        cookieStore.set("player_token", signToken(payload), cookieOptions);
      } else {
        // Brand-new player: create a lightweight guest account and store it in
        // the player cookie (the account login cookie is left untouched).
        const guest = await prisma.user.create({
          data: {
            username,
            email: `guest-${randomUUID()}@guest.local`,
            password: randomUUID(), // random placeholder; guests never log in with a password
          },
        });
        payload = { id: guest.id, email: guest.email, username: guest.username, role: guest.role };
        cookieStore.set("player_token", signToken(payload), cookieOptions);
      }
    }

    // --- Join the event if not already in it ---------------------------------
    const existing = await prisma.participant.findFirst({
      where: { userId: payload.id, team: { eventId: event.id } },
    });

    if (!existing) {
      if (isTeamMode) {
        // A team code joins that exact team; an event code auto-assigns to the
        // emptiest team so players spread evenly with no team-picking step.
        const err = targetTeamId
          ? await joinSpecificTeam(targetTeamId, payload.id, event.maxTeamSize)
          : await autoAssignToTeam(event.id, payload.id, event.maxTeams, event.maxTeamSize);
        if (err) return { error: err };
      } else {
        // A returning identity that hasn't joined yet is still subject to capacity.
        if (isFull) {
          return { error: "This event is full." };
        }
        await createSoloTeamAndParticipant(event.id, payload.id, payload.username);
      }
    }
  } catch (error) {
    console.error("Failed to join event:", error);
    return { error: "Something went wrong while joining. Please try again." };
  }

  redirect(`/play/${eventId}/waiting`);
}

// TEAM mode: drop the player into the emptiest shared team that still has room.
// If every team is full, create another one (unless the event's maxTeams cap is
// reached, in which case the event is full). Returns an error string, or null.
async function autoAssignToTeam(
  eventId: string,
  userId: string,
  maxTeams: number | null,
  maxTeamSize: number | null,
): Promise<string | null> {
  const teams = await prisma.team.findMany({
    where: { eventId },
    include: { _count: { select: { participants: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Prefer existing teams with spare capacity, emptiest first (balanced fill).
  const withRoom = teams
    .filter(t => !maxTeamSize || t._count.participants < maxTeamSize)
    .sort((a, b) => a._count.participants - b._count.participants);

  if (withRoom.length > 0) {
    await prisma.participant.create({ data: { userId, teamId: withRoom[0].id } });
    return null;
  }

  // No team has room. Add one if we're still under the team cap.
  if (maxTeams && teams.length >= maxTeams) {
    return "This event is full — every team has reached its size limit.";
  }
  const newTeam = await prisma.team.create({
    data: { name: `Team ${teams.length + 1}`, eventId },
  });
  await prisma.participant.create({ data: { userId, teamId: newTeam.id } });
  return null;
}

// TEAM mode: join the exact team the code belongs to, respecting its size cap.
// Returns an error string, or null on success.
async function joinSpecificTeam(
  teamId: string,
  userId: string,
  maxTeamSize: number | null,
): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { _count: { select: { participants: true } } },
  });

  if (!team) return "That team no longer exists.";
  if (maxTeamSize && team._count.participants >= maxTeamSize) {
    return "That team is full — ask your host for another team's code.";
  }

  await prisma.participant.create({ data: { userId, teamId } });
  return null;
}

async function createSoloTeamAndParticipant(eventId: string, userId: string, username: string) {
  const team = await prisma.team.create({
    data: { name: username, eventId },
  });
  await prisma.participant.create({
    data: { userId, teamId: team.id },
  });
}


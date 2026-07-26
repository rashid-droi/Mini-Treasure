"use server";

import prisma from "@/lib/prisma";
import type { Prisma, Clue, Event, Team } from "@prisma/client";

export async function getNextClue(teamId: string, eventId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch the team and event
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: { activeClue: true }
      });

      if (!team) return { error: "Team not found" };

      // If the team already has an active clue, return it so all players see the
      // same thing — but only if it hasn't already been solved. A stale pointer
      // to a solved clue (e.g. clues edited/removed, or a completion that didn't
      // clear it) would otherwise be served forever: it's unsubmittable ("already
      // solved") and has no clickable hotspot (it's in the found set). When that
      // happens, fall through to pick the next unsolved clue or finish the hunt.
      if (team.activeClue) {
        const alreadySolved = await tx.teamAnswer.findFirst({
          where: { teamId, eventId, clueId: team.activeClue.id, isCorrect: true },
          select: { id: true },
        });
        if (!alreadySolved) {
          return { success: true, clue: team.activeClue, completed: false, hintsUsed: team.activeClueHints };
        }
      }

      const event = await tx.event.findUnique({
        where: { id: eventId }
      });

      if (!event || !event.sceneId) return { error: "Event or Scene not found" };

      // 2. Fetch all possible clues for this scene
      const allClues = await tx.clue.findMany({
        where: { sceneId: event.sceneId }
      });

      // 3. Fetch clues the team has already answered correctly
      const answers = await tx.teamAnswer.findMany({
        where: { teamId, eventId, isCorrect: true },
        select: { clueId: true }
      });
      const answeredClueIds = new Set(answers.map(a => a.clueId));

      // 4. Filter out answered clues
      const remainingClues = allClues.filter(c => !answeredClueIds.has(c.id));

      if (remainingClues.length === 0) {
        // Clear any lingering active pointer so the state reflects completion.
        if (team.activeClueId) {
          await tx.team.update({ where: { id: teamId }, data: { activeClueId: null } });
        }
        return { success: true, completed: true };
      }

      // 5. Pick the next clue in defined order (lowest `order`, stable by id)
      const nextClue = pickNextClue(remainingClues);

      // 6. Lock it in as the active clue for the team
      await tx.team.update({
        where: { id: teamId },
        data: { activeClueId: nextClue.id }
      });

      return { success: true, clue: nextClue, completed: false, hintsUsed: 0 };
    });
  } catch (error) {
    console.error("Failed to fetch next clue:", error);
    return { error: "Database error" };
  }
}

// Picks the clue to serve next: the one with the lowest `order`, breaking ties
// deterministically by id so every player on a team sees the same sequence.
function pickNextClue(clues: Clue[]): Clue {
  return [...clues].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))[0];
}

// Records a wrong attempt against the team.
async function registerWrongAttempt(tx: Prisma.TransactionClient, teamId: string) {
  await tx.team.update({
    where: { id: teamId },
    data: { wrongAttempts: { increment: 1 } }
  });
  return { status: "wrong" as const };
}

// Shared flow once a clue is solved (by scene click or dropdown answer):
// records the answer, awards points, picks the next clue, and settles
// endgame bonuses when the hunt is complete.
async function lockCorrectAnswer(
  tx: Prisma.TransactionClient,
  team: Team,
  event: Event,
  activeClue: Clue,
  userId?: string
) {
  const teamId = team.id;
  const eventId = event.id;

  // Speed ranking: how many teams have ALREADY solved this clue (counted before
  // we record this team's answer, so it excludes us). The fastest team is rank
  // 1. Each clue is its own race, so ranks are per-clue.
  const priorSolves = await tx.teamAnswer.count({
    where: { eventId, clueId: activeClue.id, isCorrect: true },
  });
  const rank = priorSolves + 1; // 1 = fastest

  // 1. Create TeamAnswer
  try {
    await tx.teamAnswer.create({
      data: {
        teamId,
        eventId,
        clueId: activeClue.id,
        userId,
        isCorrect: true
      }
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return { error: "Already solved by a teammate!" };
    }
    throw e;
  }

  // 2. Award points scaled by speed rank: full value for the fastest team, then
  // −10% of the base per rank (100% → 90% → 80% …), floored at 10% so late
  // finishers still score. Rounded to whole points.
  const speedFactor = Math.max(0.1, 1 - 0.1 * (rank - 1));
  const POINTS_FOR_CORRECT = Math.round(activeClue.points * speedFactor);

  await tx.leaderboard.upsert({
    where: { eventId_teamId: { eventId, teamId } },
    update: { score: { increment: POINTS_FOR_CORRECT } },
    create: { eventId, teamId, score: POINTS_FOR_CORRECT }
  });

  // 3. Find Next Clue
  const allClues = await tx.clue.findMany({ where: { sceneId: event.sceneId! } });
  const answers = await tx.teamAnswer.findMany({
    where: { teamId, eventId, isCorrect: true },
    select: { clueId: true }
  });
  const answeredClueIds = new Set(answers.map(a => a.clueId));

  const remainingClues = allClues.filter(c => !answeredClueIds.has(c.id));

  let nextClue = null;
  let isCompleted = false;

  if (remainingClues.length > 0) {
    nextClue = pickNextClue(remainingClues);

    await tx.team.update({
      where: { id: teamId },
      data: { activeClueId: nextClue.id, activeClueHints: 0 }
    });
  } else {
    isCompleted = true;
    await tx.team.update({
      where: { id: teamId },
      data: { activeClueId: null, activeClueHints: 0 }
    });
  }

  // 4. Check for Endgame (If they solved all clues)
  let bonusAwarded = 0;

  if (isCompleted) {
    // GAME OVER - Calculate Bonuses
    let timeBonus = 0;
    let accuracyBonus = 0;
    const now = Date.now();
    const completionTimeMs = event.startTime ? now - event.startTime.getTime() : now - team.createdAt.getTime();

    // Time Bonus: 5 points per remaining minute
    if (event.endTime) {
      const remainingMs = event.endTime.getTime() - now;
      if (remainingMs > 0) {
        const remainingMinutes = Math.floor(remainingMs / 60000);
        timeBonus = remainingMinutes * 5;
      }
    }

    // Accuracy Bonus: Max 50, -5 per wrong attempt
    accuracyBonus = Math.max(0, 50 - (team.wrongAttempts * 5));

    bonusAwarded = timeBonus + accuracyBonus;

    await tx.leaderboard.update({
      where: { eventId_teamId: { eventId, teamId } },
      data: {
        bonusPoints: { increment: bonusAwarded },
        completionTimeMs
      }
    });
  }

  return {
    status: "correct" as const,
    pointsAwarded: POINTS_FOR_CORRECT + bonusAwarded,
    nextClue: nextClue,
    completed: isCompleted,
    clueId: activeClue.id
  };
}

export async function validateClick(teamId: string, eventId: string, clickX: number, clickY: number, userId?: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: { activeClue: { include: { scene: true } } }
      });
      const event = await tx.event.findUnique({ where: { id: eventId } });

      if (!team || !event) throw new Error("Event or Team not found");

      const activeClue = team.activeClue;
      if (!activeClue) {
        return { error: "No active clue to solve." };
      }

      if (activeClue.type === "QUESTION") {
        return { error: "This clue is answered with the dropdown, not by clicking the scene." };
      }

      // Hit test: the object's own hotspot radius wins; otherwise the
      // scene-wide default click tolerance applies. SQUARE hotspots use a
      // bounding box (radius = half-size); CIRCLE uses straight-line distance.
      const tolerance = activeClue.radius ?? activeClue.scene.clickTolerance;
      const dx = Math.abs(clickX - activeClue.targetX);
      const dy = Math.abs(clickY - activeClue.targetY);
      const inside = activeClue.shape === "SQUARE"
        ? dx <= tolerance && dy <= tolerance
        : Math.hypot(dx, dy) <= tolerance;

      if (!inside) {
        return await registerWrongAttempt(tx, teamId);
      }

      return await lockCorrectAnswer(tx, team, event, activeClue, userId);
    });
  } catch (error) {
    console.error("Failed to submit answer:", error);
    return { error: error instanceof Error ? error.message : "Database error" };
  }
}

// QUESTION clues: the player picks an answer from the dropdown and submits it.
export async function submitAnswer(teamId: string, eventId: string, answer: string, userId?: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: { activeClue: true }
      });
      const event = await tx.event.findUnique({ where: { id: eventId } });

      if (!team || !event) throw new Error("Event or Team not found");

      const activeClue = team.activeClue;
      if (!activeClue) {
        return { error: "No active clue to solve." };
      }

      // QUESTION clues match the configured correct answer; every other clue
      // type is an object hunt, answered by picking the object's name.
      const expected =
        activeClue.type === "QUESTION" ? activeClue.correctAnswer : activeClue.name;

      if (activeClue.type === "QUESTION" && !activeClue.correctAnswer) {
        return { error: "This question clue has no correct answer configured." };
      }

      const isCorrect =
        answer.trim().toLowerCase() === (expected ?? "").trim().toLowerCase();

      if (!isCorrect) {
        return await registerWrongAttempt(tx, teamId);
      }

      return await lockCorrectAnswer(tx, team, event, activeClue, userId);
    });
  } catch (error) {
    console.error("Failed to submit answer:", error);
    return { error: error instanceof Error ? error.message : "Database error" };
  }
}

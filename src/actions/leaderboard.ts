"use server";

import prisma from "@/lib/prisma";

export async function getEventLeaderboard(eventId: string) {
  try {
    // Start from every team in the event (not just teams that already have a
    // Leaderboard row) so the standings show all teams immediately — teams that
    // haven't scored yet appear at 0 instead of the board looking empty.
    const teams = await prisma.team.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        participants: { select: { user: { select: { username: true } } } },
        leaderboards: {
          where: { eventId },
          select: { id: true, score: true, bonusPoints: true, completionTimeMs: true, updatedAt: true },
          take: 1,
        },
      },
    });

    const leaderboards = teams.map((t) => {
      const lb = t.leaderboards[0];
      return {
        id: lb?.id ?? t.id,
        team: { id: t.id, name: t.name, participants: t.participants },
        score: lb?.score ?? 0,
        bonusPoints: lb?.bonusPoints ?? 0,
        completionTimeMs: lb?.completionTimeMs ?? null,
        // When the team last submitted (last score change). null = never scored.
        submittedAt: lb?.updatedAt ?? null,
        updatedAt: lb?.updatedAt ?? new Date(0),
      };
    });

    // Custom sorting:
    // 1. score (DESC)
    // 2. bonusPoints (DESC)
    // 3. completionTimeMs (ASC, nulls last)
    // 4. updatedAt (ASC, earlier to reach score is better)
    leaderboards.sort((a, b) => {
      // 1. Score
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // 2. Bonus Points
      if (a.bonusPoints !== b.bonusPoints) {
        return b.bonusPoints - a.bonusPoints;
      }

      // 3. Faster Completion Time
      if (a.completionTimeMs !== null && b.completionTimeMs !== null) {
        if (a.completionTimeMs !== b.completionTimeMs) {
          return a.completionTimeMs - b.completionTimeMs; // Ascending (faster is better)
        }
      } else if (a.completionTimeMs !== null) {
        return -1; // A finished, B didn't. A wins.
      } else if (b.completionTimeMs !== null) {
        return 1; // B finished, A didn't. B wins.
      }

      // 4. Earliest Finish
      return a.updatedAt.getTime() - b.updatedAt.getTime(); 
    });

    // The event start powers the live "time so far" clock for teams that
    // haven't finished yet (they have no fixed completionTimeMs).
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { startTime: true },
    });

    return { success: true, data: leaderboards, startTime: event?.startTime ?? null };
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    return { error: "Failed to load leaderboard" };
  }
}

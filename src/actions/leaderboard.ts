"use server";

import prisma from "@/lib/prisma";

export async function getEventLeaderboard(eventId: string) {
  try {
    const leaderboards = await prisma.leaderboard.findMany({
      where: { eventId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            participants: {
              select: {
                user: { select: { username: true } }
              }
            }
          }
        }
      }
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

    return { success: true, data: leaderboards };
  } catch (error: any) {
    console.error("Error fetching leaderboard:", error);
    return { error: "Failed to load leaderboard" };
  }
}

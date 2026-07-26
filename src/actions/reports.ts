"use server";

import prisma from "@/lib/prisma";

function formatMs(timeMs: number | null | undefined) {
  if (!timeMs || timeMs <= 0) return "—";
  const totalSeconds = Math.floor(timeMs / 1000);
  return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
}

// Aggregates analytics across EVERY event: overview totals, a per-event
// summary, the global team leaderboard, and the most active players.
export async function generateGlobalReport() {
  try {
    const [
      totalEvents,
      activeEvents,
      completedEvents,
      totalTeams,
      totalPlayers,
      totalAnswers,
      teamAggregate,
      events,
      allLeaderboards,
      playerActivity,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { status: "ACTIVE" } }),
      prisma.event.count({ where: { status: "COMPLETED" } }),
      prisma.team.count(),
      prisma.user.count({ where: { role: "PARTICIPANT" } }),
      prisma.teamAnswer.count({ where: { isCorrect: true } }),
      prisma.team.aggregate({ _sum: { totalHintsUsed: true, wrongAttempts: true } }),
      prisma.event.findMany({
        orderBy: { createdAt: "desc" },
        include: { scene: { select: { name: true } }, _count: { select: { teams: true } } },
      }),
      prisma.leaderboard.findMany({
        orderBy: [{ score: "desc" }, { completionTimeMs: "asc" }],
        include: { team: { select: { name: true } }, event: { select: { name: true } } },
      }),
      prisma.teamAnswer.groupBy({
        by: ["userId"],
        where: { isCorrect: true, userId: { not: null } },
        _count: { clueId: true },
        orderBy: { _count: { clueId: "desc" } },
        take: 10,
      }),
    ]);

    // Per-event summary rows (players + solved answers + clue count + winner).
    const perEvent = await Promise.all(
      events.map(async (e) => {
        const [totalClues, solved, players] = await Promise.all([
          e.sceneId ? prisma.clue.count({ where: { sceneId: e.sceneId } }) : Promise.resolve(0),
          prisma.teamAnswer.count({ where: { eventId: e.id, isCorrect: true } }),
          prisma.participant.count({ where: { team: { eventId: e.id } } }),
        ]);
        const winner = allLeaderboards.find((lb) => lb.eventId === e.id);
        return {
          id: e.id,
          name: e.name,
          status: e.status,
          scene: e.scene?.name ?? "No Scene",
          teams: e._count.teams,
          players,
          totalClues,
          solved,
          winner: winner?.team.name ?? null,
          winnerScore: winner?.score ?? 0,
        };
      })
    );

    const teamLeaderboard = allLeaderboards.slice(0, 10).map((lb, i) => ({
      rank: i + 1,
      team: lb.team.name,
      event: lb.event.name,
      score: lb.score,
      time: formatMs(lb.completionTimeMs),
    }));

    // Resolve usernames for the most-active players.
    const userIds = playerActivity.map((p) => p.userId).filter((id): id is string => !!id);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.username]));
    const topPlayers = playerActivity.map((p, i) => ({
      rank: i + 1,
      username: (p.userId && userMap.get(p.userId)) || "Unknown",
      cluesFound: p._count.clueId,
    }));

    return {
      success: true as const,
      overview: {
        totalEvents,
        activeEvents,
        completedEvents,
        totalTeams,
        totalPlayers,
        totalAnswers,
        totalHints: teamAggregate._sum.totalHintsUsed ?? 0,
        totalWrong: teamAggregate._sum.wrongAttempts ?? 0,
      },
      perEvent,
      teamLeaderboard,
      topPlayers,
    };
  } catch (error) {
    console.error("Failed to generate global report:", error);
    return { error: "Database error" };
  }
}

export async function generateEventReport(eventId: string) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) return { error: "Event not found" };

    const totalClues = await prisma.clue.count({
      where: { sceneId: event.sceneId! }
    });

    const teams = await prisma.team.findMany({
      where: { eventId },
      include: {
        leaderboards: {
          where: { eventId }
        },
        _count: {
          select: {
            answers: {
              where: { isCorrect: true, eventId }
            }
          }
        },
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    // Fetch player activity
    const playerActivity = await prisma.teamAnswer.groupBy({
      by: ['userId', 'teamId'],
      where: { eventId, isCorrect: true, userId: { not: null } },
      _count: {
        clueId: true
      },
      orderBy: {
        _count: {
          clueId: 'desc'
        }
      }
    });

    // Map player IDs to Usernames
    const userIds = playerActivity
      .map(p => p.userId)
      .filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    });
    const userMap = new Map(users.map(u => [u.id, u.username]));

    const teamReports = teams.map(team => {
      const solvedClues = team._count.answers;
      const completionPercent = totalClues > 0 ? (solvedClues / totalClues) * 100 : 0;
      
      const totalAttempts = solvedClues + team.wrongAttempts;
      const accuracy = totalAttempts > 0 ? (solvedClues / totalAttempts) * 100 : 0;
      
      const lb = team.leaderboards[0];
      const timeMs = lb?.completionTimeMs || 0;
      
      // Calculate time taken in a readable format
      let formattedTime = "DNF (Did Not Finish)";
      if (timeMs > 0) {
        const totalSeconds = Math.floor(timeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        formattedTime = `${minutes}m ${seconds}s`;
      }

      // Filter activity for this team
      const topPlayers = playerActivity
        .filter(p => p.teamId === team.id && p.userId)
        .map(p => ({
          username: (p.userId && userMap.get(p.userId)) || "Unknown",
          cluesFound: p._count.clueId
        }));

      return {
        id: team.id,
        name: team.name,
        score: lb ? lb.score : 0,
        bonusPoints: lb ? lb.bonusPoints : 0,
        completionTimeMs: lb ? lb.completionTimeMs : null,
        updatedAt: lb ? lb.updatedAt : team.createdAt,
        solvedClues,
        wrongAttempts: team.wrongAttempts,
        hintsUsed: team.totalHintsUsed,
        completionPercent: Math.round(completionPercent),
        accuracy: Math.round(accuracy),
        timeTaken: formattedTime,
        topPlayers
      };
    });

    // Custom sorting:
    // 1. score (DESC)
    // 2. bonusPoints (DESC)
    // 3. completionTimeMs (ASC, nulls last)
    // 4. updatedAt (ASC, earlier to reach score is better)
    teamReports.sort((a, b) => {
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

    return { 
      success: true, 
      event: { 
        id: event.id, 
        name: event.name 
      },
      totalClues,
      teams: teamReports
    };
  } catch (error) {
    console.error("Failed to generate event report:", error);
    return { error: "Database error" };
  }
}

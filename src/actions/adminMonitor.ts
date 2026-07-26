"use server";

import prisma from "@/lib/prisma";

export async function getAdminMonitorState(eventId: string) {
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
        }
      }
    });

    // Structure it for the monitor
    const monitorData = teams.map(team => ({
      id: team.id,
      name: team.name,
      wrongAttempts: team.wrongAttempts,
      score: team.leaderboards[0]?.score || 0,
      solvedClues: team._count.answers,
      totalClues
    }));

    return { 
      success: true, 
      event: { 
        id: event.id, 
        name: event.name, 
        endTime: event.endTime?.toISOString() 
      },
      teams: monitorData
    };
  } catch (error: any) {
    console.error("Failed to fetch admin monitor state:", error);
    return { error: "Database error" };
  }
}

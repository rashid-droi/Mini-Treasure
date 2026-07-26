"use server";

import prisma from "@/lib/prisma";
import { getPlayerFromCookies } from "@/lib/playerSession";

export async function getWaitingRoomState(eventId: string) {
  const payload = await getPlayerFromCookies();
  if (!payload) return { error: "Unauthorized" };

  try {
    const participant = await prisma.participant.findFirst({
      where: { userId: payload.id, team: { eventId } },
      include: {
        team: {
          include: {
            participants: {
              include: { user: { select: { id: true, username: true } } }
            }
          }
        }
      }
    });

    if (!participant) return { error: "Not part of a team in this event." };

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, description: true, status: true, scene: { select: { name: true } } }
    });

    // Everyone who has joined the event, across all teams
    const players = await prisma.participant.findMany({
      where: { team: { eventId } },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { joinedAt: 'asc' }
    });

    // Event-wide chat (teamId null = message to the whole event room)
    const chatHistory = await prisma.chat.findMany({
      where: { eventId, teamId: null },
      orderBy: { timestamp: 'asc' },
      include: { sender: { select: { username: true } } },
      take: 50 // last 50 messages
    });

    // When the room started gathering: the earliest join across all teams. Used
    // for the shared "time in room" clock so every player sees the same value.
    const lobbyStartedAt = players[0]?.joinedAt ?? null;

    return {
      success: true,
      data: {
        event,
        team: participant.team,
        roster: participant.team.participants,
        players,
        chat: chatHistory,
        userId: payload.id,
        lobbyStartedAt
      }
    };
  } catch (error) {
    console.error("Failed to fetch state:", error);
    return { error: "Database error" };
  }
}

"use server";

import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function moveParticipant(userId: string, newTeamId: string | null, eventId: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { error: "Unauthorized" };

  try {
    // First, find if this user already has a participant record for ANY team in this event
    const existingParticipant = await prisma.participant.findFirst({
      where: {
        userId,
        team: {
          eventId: eventId
        }
      }
    });

    if (newTeamId === null) {
      // Move to Unassigned Pool -> delete their participant record for this event
      if (existingParticipant) {
        await prisma.participant.delete({
          where: { id: existingParticipant.id }
        });
      }
      return { success: true };
    }

    // Moving to a Team
    if (existingParticipant) {
      // Update their team
      await prisma.participant.update({
        where: { id: existingParticipant.id },
        data: { teamId: newTeamId }
      });
    } else {
      // Create new participant record
      await prisma.participant.create({
        data: {
          userId,
          teamId: newTeamId,
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to move participant:", error);
    return { error: "Database error" };
  }
}

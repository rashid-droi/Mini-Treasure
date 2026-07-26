"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getEvents() {
  try {
    const events = await prisma.event.findMany({
      include: {
        scene: true,
        _count: {
          select: { teams: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: events };
  } catch (err) {
    return { error: "Failed to fetch events." };
  }
}

export async function createEvent(data: { name: string, description?: string, joinCode: string, sceneId: string, gameDuration?: number }) {
  try {
    const event = await prisma.event.create({ data });
    revalidatePath("/admin/events");
    return { success: true, data: event };
  } catch (err) {
    return { error: "Failed to create event." };
  }
}

export async function updateEventStatus(id: string, status: any) {
  try {
    const data: { status: any; startTime?: Date; endTime?: Date | null } = { status };

    // Stamp the clock the first time an event goes ACTIVE: startTime drives the
    // in-game timer, and endTime gives it a countdown target when a duration is
    // set. Only set once so re-activating never resets a running game.
    if (status === "ACTIVE") {
      const existing = await prisma.event.findUnique({
        where: { id },
        select: { startTime: true, gameDuration: true },
      });
      if (existing && !existing.startTime) {
        const now = new Date();
        data.startTime = now;
        data.endTime = existing.gameDuration
          ? new Date(now.getTime() + existing.gameDuration * 60_000)
          : null;
      }
    }

    const event = await prisma.event.update({ where: { id }, data });
    revalidatePath("/admin/events");
    return { success: true, data: event };
  } catch (err) {
    return { error: "Failed to update event status." };
  }
}

export async function deleteEvent(id: string) {
  try {
    await prisma.event.delete({ where: { id } });
    revalidatePath("/admin/events");
    return { success: true };
  } catch (err) {
    return { error: "Failed to delete event." };
  }
}

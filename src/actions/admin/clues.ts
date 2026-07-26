"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createClue(sceneId: string, data: { name: string, description: string, type: any, points: number, targetX: number, targetY: number, radius?: number | null, shape?: "CIRCLE" | "SQUARE", options?: string[], correctAnswer?: string | null }) {
  try {
    if (data.type === "QUESTION") {
      const options = (data.options ?? []).map(o => o.trim()).filter(Boolean);
      const correctAnswer = data.correctAnswer?.trim();
      if (options.length < 2) return { error: "Question clues need at least 2 answer options." };
      if (!correctAnswer || !options.includes(correctAnswer)) {
        return { error: "The correct answer must be one of the options." };
      }
      data = { ...data, options, correctAnswer };
    } else {
      data = { ...data, options: [], correctAnswer: null };
    }

    const clue = await prisma.clue.create({
      data: { ...data, sceneId }
    });
    revalidatePath(`/admin/scenes/${sceneId}`);
    return { success: true, data: clue };
  } catch (err) {
    return { error: "Failed to create clue." };
  }
}

export async function updateClue(id: string, data: { name: string, description: string, type: any, points: number, radius?: number | null, shape?: "CIRCLE" | "SQUARE", options?: string[], correctAnswer?: string | null }) {
  try {
    let payload: any = {
      name: data.name,
      description: data.description,
      type: data.type,
      points: data.points,
      // undefined => leave unchanged; null => clear (fall back to scene tolerance)
      ...(data.radius !== undefined ? { radius: data.radius } : {}),
      ...(data.shape !== undefined ? { shape: data.shape } : {}),
    };

    if (data.type === "QUESTION") {
      const options = (data.options ?? []).map(o => o.trim()).filter(Boolean);
      const correctAnswer = data.correctAnswer?.trim();
      if (options.length < 2) return { error: "Question clues need at least 2 answer options." };
      if (!correctAnswer || !options.includes(correctAnswer)) {
        return { error: "The correct answer must be one of the options." };
      }
      payload = { ...payload, options, correctAnswer };
    } else {
      payload = { ...payload, options: [], correctAnswer: null };
    }

    const clue = await prisma.clue.update({
      where: { id },
      data: payload
    });
    revalidatePath(`/admin/scenes/${clue.sceneId}`);
    return { success: true, data: clue };
  } catch (err: any) {
    // P2025 = record to update not found (e.g. a stale editor tab open from
    // before the clue was deleted/replaced elsewhere).
    if (err?.code === "P2025") {
      return { error: "This clue no longer exists — reload the page and try again." };
    }
    return { error: "Failed to update clue." };
  }
}

export async function updateClueLocation(id: string, targetX: number, targetY: number) {
  try {
    const clue = await prisma.clue.update({
      where: { id },
      data: { targetX, targetY }
    });
    revalidatePath(`/admin/scenes/${clue.sceneId}`);
    return { success: true, data: clue };
  } catch (err) {
    return { error: "Failed to update clue location." };
  }
}

export async function deleteClue(id: string) {
  try {
    const clue = await prisma.clue.delete({ where: { id } });
    revalidatePath(`/admin/scenes/${clue.sceneId}`);
    return { success: true };
  } catch (err) {
    return { error: "Failed to delete clue." };
  }
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getTeams() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        event: true,
        _count: { select: { participants: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: teams };
  } catch (err) {
    return { error: "Failed to fetch teams." };
  }
}

export async function deleteTeam(id: string) {
  try {
    await prisma.team.delete({ where: { id } });
    revalidatePath("/admin/teams");
    return { success: true };
  } catch (err) {
    return { error: "Failed to delete team." };
  }
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        participants: {
          select: { team: { select: { event: { select: { name: true } } } } }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: users };
  } catch (err) {
    return { error: "Failed to fetch users." };
  }
}

export async function updateUserRole(id: string, role: any) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role }
    });
    revalidatePath("/admin/players");
    return { success: true, data: user };
  } catch (err) {
    return { error: "Failed to update role." };
  }
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/players");
    return { success: true };
  } catch (err) {
    return { error: "Failed to delete user." };
  }
}

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";

const TILES_DIR = path.join(process.cwd(), "public", "tiles");

// Tile folders in /public/tiles that have a base tile but no Scene row yet
export async function getUnimportedTileScenes() {
  try {
    if (!fs.existsSync(TILES_DIR)) return { success: true, data: [] };
    const folders = fs.readdirSync(TILES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .filter(name => fs.existsSync(path.join(TILES_DIR, name, "0", "0", "0.jpg")));
    const existing = await prisma.scene.findMany({
      where: { id: { in: folders } },
      select: { id: true }
    });
    const existingIds = new Set(existing.map(s => s.id));
    return { success: true, data: folders.filter(f => !existingIds.has(f)) };
  } catch (err) {
    return { error: "Failed to scan tile folders." };
  }
}

// Create a Scene row for an existing tile folder. The scene id must equal the
// folder name because tiles are served from /tiles/{sceneId}/{z}/{y}/{x}.jpg.
export async function importTileScene(folderId: string) {
  try {
    const safe = path.basename(folderId);
    if (!fs.existsSync(path.join(TILES_DIR, safe, "0", "0", "0.jpg"))) {
      return { error: "Tile folder not found." };
    }
    const name = safe.replace(/[-_]+/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
    const scene = await prisma.scene.create({
      data: {
        id: safe,
        name,
        imageUrl: `/tiles/${safe}/0/0/0.jpg`,
        clickTolerance: 5,
      }
    });
    revalidatePath("/admin/scenes");
    return { success: true, data: scene };
  } catch (err) {
    return { error: "Failed to import scene." };
  }
}

export async function getScenes() {
  try {
    const scenes = await prisma.scene.findMany({
      include: {
        _count: {
          select: { clues: true, events: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: scenes };
  } catch (err) {
    return { error: "Failed to fetch scenes." };
  }
}

export async function getSceneById(id: string) {
  try {
    const scene = await prisma.scene.findUnique({
      where: { id },
      include: {
        clues: { orderBy: { name: 'asc' } }
      }
    });
    return { success: true, data: scene };
  } catch (err) {
    return { error: "Failed to fetch scene." };
  }
}

// Upload a scene photo: generates the deep-zoom tile pyramid under
// /public/tiles/{sceneId}/ (google layout, as the viewers expect) plus the
// transparent blank.png fallback tile, then creates the Scene row.
export async function createSceneFromUpload(formData: FormData) {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const clickTolerance = Number(formData.get("clickTolerance") ?? 5) || 5;
    const file = formData.get("image");

    if (!name) return { error: "Scene name is required." };
    if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image file." };
    if (!file.type.startsWith("image/")) return { error: "The selected file is not an image." };

    // Tile URLs are /tiles/{sceneId}/{z}/{y}/{x}.jpg, so the scene id doubles
    // as the folder name. Slug + timestamp keeps it unique and readable.
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scene";
    const id = `${slug}-${Date.now().toString(36)}`;
    const outputDir = path.join(TILES_DIR, id);
    fs.mkdirSync(outputDir, { recursive: true });

    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Downscale oversized uploads before tiling. The deep-zoom viewer never
    // needs more than ~6000px on the long edge, and huge images (e.g. a 50MB
    // photo) make tiling slow and produce enormous pyramids. Never upscales.
    const MAX_EDGE = 6000;
    const meta = await sharp(buffer).metadata();
    let img = sharp(buffer).rotate(); // honor EXIF orientation
    if (meta.width && meta.height && Math.max(meta.width, meta.height) > MAX_EDGE) {
      img = img.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
    }

    // Tile from an in-memory JPEG so we can record the EXACT tiled dimensions in
    // meta.json — the viewer reads it to crop the white edge-padding the google
    // layout adds, giving a pixel-perfect fit with no probing.
    const { data: jpegBuffer, info } = await img.jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
    await sharp(jpegBuffer).tile({ size: 256, layout: "google" }).toFile(outputDir);
    fs.writeFileSync(path.join(outputDir, "meta.json"), JSON.stringify({ width: info.width, height: info.height }));

    await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toFile(path.join(outputDir, "blank.png"));

    const scene = await prisma.scene.create({
      data: { id, name, imageUrl: `/tiles/${id}/0/0/0.jpg`, clickTolerance }
    });
    revalidatePath("/admin/scenes");
    return { success: true, data: scene };
  } catch (err) {
    console.error("Scene upload failed:", err);
    return { error: "Failed to upload scene. Check the server logs." };
  }
}

export async function createScene(data: { name: string, imageUrl: string, clickTolerance: number }) {
  try {
    const scene = await prisma.scene.create({ data });
    revalidatePath("/admin/scenes");
    return { success: true, data: scene };
  } catch (err) {
    return { error: "Failed to create scene." };
  }
}

export async function deleteScene(id: string) {
  try {
    await prisma.scene.delete({ where: { id } });
    revalidatePath("/admin/scenes");
    return { success: true };
  } catch (err) {
    return { error: "Failed to delete scene." };
  }
}

export async function updateSceneClickTolerance(id: string, clickTolerance: number) {
  try {
    const value = Math.round(Math.max(2, Math.min(120, clickTolerance)));
    const scene = await prisma.scene.update({
      where: { id },
      data: { clickTolerance: value },
    });
    revalidatePath(`/admin/scenes/${id}`);
    revalidatePath("/admin/scenes");
    return { success: true, data: scene };
  } catch (err) {
    return { error: "Failed to update hotspot size." };
  }
}

// Set the scene default and clear per-clue overrides so every object uses it.
export async function applyHotspotSizeToAllClues(sceneId: string, clickTolerance: number) {
  try {
    const value = Math.round(Math.max(2, Math.min(120, clickTolerance)));
    const [, updated] = await prisma.$transaction([
      prisma.scene.update({
        where: { id: sceneId },
        data: { clickTolerance: value },
      }),
      prisma.clue.updateMany({
        where: { sceneId },
        data: { radius: null },
      }),
    ]);
    revalidatePath(`/admin/scenes/${sceneId}`);
    revalidatePath("/admin/scenes");
    return { success: true, data: { clickTolerance: value, cluesUpdated: updated.count } };
  } catch (err) {
    return { error: "Failed to apply hotspot size to all objects." };
  }
}

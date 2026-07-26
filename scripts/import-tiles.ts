import "dotenv/config";
import prisma from "../src/lib/prisma";
import fs from "fs";
import path from "path";

const TILES_DIR = path.join(process.cwd(), "public", "tiles");

async function main() {
  const folders = fs.readdirSync(TILES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(TILES_DIR, name, "0", "0", "0.jpg")));

  const existing = await prisma.scene.findMany({ select: { id: true, name: true } });
  const existingIds = new Set(existing.map(s => s.id));
  console.log("Existing scenes:", existing.map(s => `${s.id} (${s.name})`).join(", "));

  const unimported = folders.filter(f => !existingIds.has(f));
  console.log("Unimported tile folders:", unimported.join(", ") || "(none)");

  for (const folderId of unimported) {
    const safe = path.basename(folderId);
    const name = safe.replace(/[-_]+/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
    const scene = await prisma.scene.create({
      data: { id: safe, name, imageUrl: `/tiles/${safe}/0/0/0.jpg` }
    });
    console.log(`Imported: ${scene.id} -> "${scene.name}"`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

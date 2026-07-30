// Applies calibrated hotspot coordinates to Scene 1 & Scene 2 clues in the database.
// Run: npx tsx scripts/apply-scene-hotspots.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { mapCoords, SCENE1_CLUES, SCENE2_CLUES } from "./scene-hotspot-coords";

const SCENE1_IDS = ["scene-1-ms7sqgvc", "scene-01-jpg-ms5v547c", "scene1"];
const SCENE2_IDS = ["scene-2-ms7sr9ew", "scene-02-jpg-ms5v5ky9", "scene2"];

async function resolveSceneId(candidates: string[], nameHint: string) {
  for (const id of candidates) {
    const scene = await prisma.scene.findUnique({ where: { id } });
    if (scene) return scene;
  }
  return prisma.scene.findFirst({
    where: { name: { contains: nameHint, mode: "insensitive" } },
  });
}

async function applyClues(
  sceneId: string,
  clues: [number, string, string, number, number][],
) {
  const existing = await prisma.clue.findMany({
    where: { sceneId },
    orderBy: { order: "asc" },
  });

  if (existing.length === 0) {
    console.log(`  No clues on ${sceneId} — run seed script first.`);
    return 0;
  }

  let updated = 0;
  for (const [order, name, description, px, py] of clues) {
    const clue =
      existing.find((c) => c.order === order) ??
      existing.find((c) => c.name === name);
    if (!clue) {
      console.warn(`  Missing clue #${order} "${name}" on ${sceneId}`);
      continue;
    }
    const { targetX, targetY } = mapCoords(px, py);
    await prisma.clue.update({
      where: { id: clue.id },
      data: { name, description, targetX, targetY, order },
    });
    updated++;
  }
  return updated;
}

async function main() {
  const scene1 = await resolveSceneId(SCENE1_IDS, "scene 1");
  const scene2 = await resolveSceneId(SCENE2_IDS, "scene 2");
  if (!scene1) throw new Error("Scene 1 not found.");
  if (!scene2) throw new Error("Scene 2 not found.");

  await prisma.scene.updateMany({
    where: { id: { in: [scene1.id, scene2.id] } },
    data: { clickTolerance: 5 },
  });

  console.log(`Updating hotspots for "${scene1.name}" (${scene1.id})…`);
  const n1 = await applyClues(scene1.id, SCENE1_CLUES);
  console.log(`  ${n1}/${SCENE1_CLUES.length} clues updated.`);

  console.log(`Updating hotspots for "${scene2.name}" (${scene2.id})…`);
  const n2 = await applyClues(scene2.id, SCENE2_CLUES);
  console.log(`  ${n2}/${SCENE2_CLUES.length} clues updated.`);

  console.log("Done. Open /admin/scenes/[sceneId] to verify pin placement.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

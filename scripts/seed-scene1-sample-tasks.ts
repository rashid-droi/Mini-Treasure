// Seeds Scene 1 with the curated "Sample tasks" clue list (55 find-the-object prompts).
// Coordinates: 6000×3346 source px, map units = px / 32 (maxZoom=5).
//
// Run: npx tsx scripts/seed-scene1-sample-tasks.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { mapCoords, SCENE1_CLUES } from "./scene-hotspot-coords";

const CLICK_TOLERANCE = 5;
const POINTS = 100;
const SCENE_CANDIDATES = ["scene-1-ms7sqgvc", "scene-01-jpg-ms5v547c", "scene1"];

async function resolveSceneId() {
  for (const id of SCENE_CANDIDATES) {
    const scene = await prisma.scene.findUnique({ where: { id } });
    if (scene) return scene;
  }
  const byName = await prisma.scene.findFirst({
    where: { name: { contains: "scene 1", mode: "insensitive" } },
  });
  if (byName) return byName;
  throw new Error(`No Scene 1 found. Tried ids: ${SCENE_CANDIDATES.join(", ")}`);
}

async function main() {
  const scene = await resolveSceneId();
  await prisma.scene.update({
    where: { id: scene.id },
    data: { clickTolerance: CLICK_TOLERANCE },
  });
  console.log(`Scene "${scene.name}" (${scene.id}) ready.`);

  const removed = await prisma.clue.deleteMany({ where: { sceneId: scene.id } });
  console.log(`Removed ${removed.count} existing clues.`);

  for (const [order, name, description, px, py] of SCENE1_CLUES) {
    const { targetX, targetY } = mapCoords(px, py);
    await prisma.clue.create({
      data: {
        sceneId: scene.id,
        name,
        description,
        type: "OBJECT",
        order,
        targetX,
        targetY,
        points: POINTS,
      },
    });
  }

  console.log(`Seeded ${SCENE1_CLUES.length} sample-task clues for Scene 1.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

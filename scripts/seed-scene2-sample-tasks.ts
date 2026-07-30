// Seeds Scene 2 with the curated 38 "find" hidden-object prompts.
// Coordinates: 6000×3346 source px, map units = px / 32 (maxZoom=5).
//
// Run: npx tsx scripts/seed-scene2-sample-tasks.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { mapCoords, SCENE2_CLUES } from "./scene-hotspot-coords";

const CLICK_TOLERANCE = 5;
const POINTS = 100;
const SCENE_CANDIDATES = ["scene-2-ms7sr9ew", "scene-02-jpg-ms5v5ky9", "scene2"];

async function resolveSceneId() {
  for (const id of SCENE_CANDIDATES) {
    const scene = await prisma.scene.findUnique({ where: { id } });
    if (scene) return scene;
  }
  const byName = await prisma.scene.findFirst({
    where: { name: { contains: "scene 2", mode: "insensitive" } },
  });
  if (byName) return byName;
  throw new Error(`No Scene 2 found. Tried ids: ${SCENE_CANDIDATES.join(", ")}`);
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

  for (const [order, name, description, px, py] of SCENE2_CLUES) {
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

  console.log(`Seeded ${SCENE2_CLUES.length} sample-task clues for Scene 2.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

// Seeds one realistic sample Event wired to an existing scene.
// Idempotent: keyed on joinCode, so re-running updates the same event
// instead of creating duplicates.
//
// Run: npx tsx scripts/seed-sample-event.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

// Attach to a scene that already has clues so the event is playable.
const SCENE_ID = "scene1";
const JOIN_CODE = "SAMPLE";

async function main() {
  const scene = await prisma.scene.findUnique({ where: { id: SCENE_ID } });
  if (!scene) {
    throw new Error(
      `Scene "${SCENE_ID}" not found. Run the base seed first (npx tsx prisma/seed.ts).`
    );
  }

  const data = {
    name: "Mini Treasure Hunt — Sample",
    description:
      "A sample treasure hunt event. Find every hidden object in the scene before the timer runs out!",
    sceneId: scene.id,
    status: "UPCOMING" as const,
    mode: "INDIVIDUAL" as const,
    gameDuration: 30, // minutes
    maxTeams: 20,
    startTime: new Date(Date.now() + 60 * 60 * 1000), // starts in 1 hour
  };

  const event = await prisma.event.upsert({
    where: { joinCode: JOIN_CODE },
    update: data,
    create: { ...data, joinCode: JOIN_CODE },
  });

  console.log("Sample event ready:");
  console.log(`  id:        ${event.id}`);
  console.log(`  name:      ${event.name}`);
  console.log(`  joinCode:  ${event.joinCode}`);
  console.log(`  scene:     ${scene.name} (${scene.id})`);
  console.log(`  status:    ${event.status}`);
  console.log(`  mode:      ${event.mode}`);
  console.log(`  duration:  ${event.gameDuration} min`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

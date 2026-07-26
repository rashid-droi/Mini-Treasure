// Seeds scene1 with dropdown-answer QUESTION clues (answered via the
// select + Submit UI in the game room, not by clicking the scene).
// Target coordinates point at the area the question is about, so admin
// pins land somewhere sensible; players never click these.
//
// Run: npx tsx scripts/seed-question-clues.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const SCENE_ID = "scene1";

// [name/question, options, correctAnswer, sourcePxX, sourcePxY]
const QUESTIONS: [string, string[], string, number, number][] = [
  ["How many camels can you see?", ["0", "1", "2", "3", "4"], "2", 1072, 335],
  ["What colour is the sports car?", ["Blue", "Red", "Green", "Yellow"], "Red", 681, 205],
  ["How many drones are flying in the sky?", ["0", "1", "2", "3"], "1", 598, 52],
];

async function main() {
  const existing = await prisma.clue.findMany({
    where: { sceneId: SCENE_ID },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

  let created = 0, skipped = 0;
  for (const [name, options, correctAnswer, px, py] of QUESTIONS) {
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    await prisma.clue.create({
      data: {
        sceneId: SCENE_ID,
        name,
        description: name,
        type: "QUESTION",
        options,
        correctAnswer,
        targetX: px / 8,
        targetY: -py / 8,
        points: 20,
      },
    });
    created++;
  }
  console.log(`Created ${created} question clues, skipped ${skipped} already-existing names.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

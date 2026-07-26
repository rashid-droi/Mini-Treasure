// Replaces scene1's clues with the curated 30-question hunt, asked in order.
// Each clue is an OBJECT clue: players find it on the image and tap its dot.
// Coordinates reuse the scene1 pixel map (source 1248x698): map units = px / 8,
// targetY negative (CRS.Simple, image top = 0, downward = negative).
//
// Run: npx tsx scripts/seed-scene1-quiz.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const SCENE_ID = "scene1";
const CLICK_TOLERANCE = 5; // map units (= 40px hit radius in the photo)
const POINTS = 100;

// [order, name (short label / marker text), question (shown to players), px, py]
// FLAG comments mark spots to verify/reposition in the admin editor: the source
// map had a single "Two camels" point, so the two camel clues and a couple of
// "closest to X" clues are best-effort positions.
const QUIZ: [number, string, string, number, number][] = [
  [1, "Falcon", "Find the falcon perched on a person's arm.", 85, 320],
  [2, "Red sports car", "Find the red sports car.", 681, 205],
  [3, "Bicycle", "Find the bicycle near the market.", 566, 270],
  [4, "Food truck", "Find the colorful food truck.", 671, 270],
  [5, "Hot air balloon", "Find the hot air balloon.", 1109, 40],
  [6, "Kite", "Find the flying kite.", 927, 77],
  [7, "Drone", "Find the drone in the sky.", 598, 52],
  [8, "UAE flag", "Find the UAE flag.", 763, 324],
  [9, "Barbecue grill", "Find the barbecue grill.", 496, 629],
  [10, "Football", "Find the football.", 892, 561],
  [11, "Chef", "Find the chef cooking food.", 501, 539],
  [12, "Police officer", "Find the police officer.", 400, 564],
  [13, "Camel near the food truck", "Find the camel standing near the food truck.", 800, 288], // FLAG: verify camel position
  [14, "Camel near the tent", "Find the second camel resting near the tent.", 1072, 335], // from "Two camels"
  [15, "Horse with rider", "Find the horse with its rider.", 1082, 155],
  [16, "Large Bedouin tent", "Find the large Bedouin tent.", 1027, 280],
  [17, "Outdoor majlis seating", "Find the outdoor majlis seating area.", 1132, 424],
  [18, "Arabic coffee pot", "Find the largest Arabic coffee pot.", 796, 444],
  [19, "Model dhow boat", "Find the model dhow boat.", 370, 439],
  [20, "Oud", "Find the oud (Arabic musical instrument).", 182, 421],
  [21, "Treasure chest", "Find the treasure chest.", 1215, 605],
  [22, "Lantern", "Find the lantern hanging beside the market.", 115, 549],
  [23, "Basket of dates", "Find the basket filled with dates.", 195, 459],
  [24, "Incense burner", "Find the incense burner.", 215, 449],
  [25, "Balloons", "Find the balloons.", 783, 584],
  [26, "Tourist with map", "Find the tourist holding a map.", 932, 398],
  [27, "Little girl", "Find the little girl holding an adult's hand.", 631, 589], // FLAG: mapped from "Family walking"
  [28, "Runner", "Find the runner in the red shirt.", 508, 414],
  [29, "Palm tree by the gate", "Find the palm tree closest to the gate.", 100, 75], // FLAG: mapped from "Palm trees"
  [30, "Burj Khalifa", "Find the Burj Khalifa in the skyline.", 443, 65],
];

async function main() {
  const scene = await prisma.scene.upsert({
    where: { id: SCENE_ID },
    create: {
      id: SCENE_ID,
      name: "Scene 1",
      imageUrl: `/tiles/${SCENE_ID}/0/0/0.jpg`,
      clickTolerance: CLICK_TOLERANCE,
    },
    update: { clickTolerance: CLICK_TOLERANCE },
  });
  console.log(`Scene "${scene.name}" ready (clickTolerance=${scene.clickTolerance} map units).`);

  // Reset: remove the existing scene1 clues so only these 30 remain. This
  // cascades their TeamAnswers and nulls any team's active clue.
  const removed = await prisma.clue.deleteMany({ where: { sceneId: SCENE_ID } });
  console.log(`Removed ${removed.count} existing scene1 clues.`);

  for (const [order, name, question, px, py] of QUIZ) {
    await prisma.clue.create({
      data: {
        sceneId: SCENE_ID,
        name,
        description: question,
        type: "OBJECT",
        order,
        targetX: px / 8,
        targetY: -py / 8,
        points: POINTS,
      },
    });
  }
  console.log(`Seeded ${QUIZ.length} ordered quiz clues for scene1.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

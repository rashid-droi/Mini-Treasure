// Seeds Scene 1 with the curated "Sample tasks" clue list (55 find-the-object prompts).
// Coordinates map from the source screenshot (1248x698): map units = px / 8,
// targetY negative (Leaflet CRS.Simple).
//
// Run: npx tsx scripts/seed-scene1-sample-tasks.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const CLICK_TOLERANCE = 5;
const POINTS = 100;

// Prefer the uploaded tile scene; fall back to legacy scene1 id.
const SCENE_CANDIDATES = ["scene-1-ms7sqgvc", "scene-01-jpg-ms5v547c", "scene1"];

// [order, marker label, player prompt, sourcePxX, sourcePxY]
const CLUES: [number, string, string, number, number][] = [
  [1, "Falcon", "Find a falcon.", 85, 320],
  [2, "Man running", "Find a man running.", 508, 414],
  [3, "Date fruit", "Find a date fruit.", 60, 155],
  [4, "Girl drinking Arabic coffee", "Find a girl drinking Arabic coffee.", 880, 600],
  [5, "Camel sitting down", "Find a camel sitting down.", 1072, 335],
  [6, "Camel standing up", "Find a camel standing up.", 800, 288],
  [7, "Boy holding UAE flag", "Find a boy holding a UAE flag.", 772, 333],
  [8, "Woman carrying coffee pot", "Find a woman carrying a coffee pot.", 638, 401],
  [9, "Dallah coffee pot", "Find a dallah coffee pot.", 796, 444],
  [10, "Cup of gahwa", "Find a cup of gahwa.", 776, 507],
  [11, "Basket of dates", "Find a basket of dates.", 195, 459],
  [12, "Pearl necklace", "Find a pearl necklace.", 85, 464],
  [13, "Small oud instrument", "Find a small oud instrument.", 182, 421],
  [14, "Man taking a selfie", "Find a man taking a selfie.", 884, 407],
  [15, "Girl wearing sunglasses", "Find a girl wearing sunglasses.", 661, 521],
  [16, "Tourist holding a map", "Find a tourist holding a map.", 932, 398],
  [17, "Child flying a kite", "Find a child flying a kite.", 854, 160],
  [18, "Desert fox", "Find a desert fox.", 1059, 207],
  [19, "Hidden lizard", "Find a hidden lizard.", 1152, 240],
  [20, "Palm tree with dates", "Find a palm tree with dates.", 100, 75],
  [21, "Henna artist", "Find a henna artist.", 245, 626],
  [22, "Woman with henna on hand", "Find a woman with henna on her hand.", 290, 524],
  [23, "Man wearing a kandura", "Find a man wearing a kandura.", 215, 295],
  [24, "Woman wearing an abaya", "Find a woman wearing an abaya.", 290, 524],
  [25, "Security guard", "Find a security guard.", 400, 564],
  [26, "Chef grilling food", "Find a chef grilling food.", 501, 539],
  [27, "Plate of luqaimat", "Find a plate of luqaimat.", 466, 652],
  [28, "Cup of karak tea", "Find a cup of karak tea.", 1124, 511],
  [29, "Food truck", "Find a food truck.", 671, 270],
  [30, "Bicycle", "Find a bicycle.", 566, 270],
  [31, "Red sports car", "Find a red sports car.", 681, 205],
  [32, "Camel saddle", "Find a camel saddle.", 1050, 320],
  [33, "Traditional lantern", "Find a traditional lantern.", 115, 549],
  [34, "Golden teapot", "Find a golden teapot.", 796, 444],
  [35, "Small treasure chest", "Find a small treasure chest.", 1215, 605],
  [36, "Child holding balloons", "Find a child holding balloons.", 783, 584],
  [37, "Man reading a newspaper", "Find a man reading a newspaper.", 255, 456],
  [38, "Woman taking a photo", "Find a woman taking a photo.", 608, 569],
  [39, "Group doing a team activity", "Find a group doing a team activity.", 760, 217],
  [40, "Hidden sand timer", "Find a hidden sand timer.", 1202, 649],
  [41, "Pair of binoculars", "Find a pair of binoculars.", 932, 398],
  [42, "Backpack", "Find a backpack.", 876, 418],
  [43, "Drone in the sky", "Find a drone in the sky.", 598, 52],
  [44, "Hot-air balloon", "Find a hot-air balloon in the distance.", 1109, 40],
  [45, "Luxury resort entrance", "Find a luxury resort entrance.", 225, 200],
  [46, "Tent with cushions", "Find a tent with cushions.", 1027, 280],
  [47, "Majlis seating area", "Find a majlis seating area.", 1132, 424],
  [48, "Falcon glove", "Find a falcon glove.", 85, 320],
  [49, "Horse in the background", "Find a horse in the background.", 1082, 155],
  [50, "Boat model", "Find a boat model.", 370, 439],
  [51, "Shopping bag", "Find a shopping bag.", 608, 569],
  [52, "Football", "Find a football.", 892, 561],
  [53, "Child eating ice cream", "Find a child eating ice cream.", 671, 270],
  [54, "Man carrying luggage", "Find a man carrying luggage.", 999, 644],
  [55, "Small golden key", "Find a small golden key.", 1215, 605],
];

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

  for (const [order, name, description, px, py] of CLUES) {
    await prisma.clue.create({
      data: {
        sceneId: scene.id,
        name,
        description,
        type: "OBJECT",
        order,
        targetX: px / 8,
        targetY: -py / 8,
        points: POINTS,
      },
    });
  }

  console.log(`Seeded ${CLUES.length} sample-task clues for Scene 1.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

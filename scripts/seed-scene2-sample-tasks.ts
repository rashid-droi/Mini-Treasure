// Seeds Scene 2 with the curated 38 "find" hidden-object prompts.
// Coordinates are in map units (= source px / 8). targetY is negative (CRS.Simple).
// Items marked with known-good coords reuse scene2 editor positions; others are
// starter spots — drag them into place in /admin/scenes/[sceneId].
//
// Run: npx tsx scripts/seed-scene2-sample-tasks.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const CLICK_TOLERANCE = 5;
const POINTS = 100;

const SCENE_CANDIDATES = ["scene-2-ms7sr9ew", "scene-02-jpg-ms5v5ky9", "scene2"];

// [order, marker label, player prompt, targetX, targetY]
const CLUES: [number, string, string, number, number][] = [
  [1, "Falcon on a Stand", "Find a falcon perched on a stand.", 9.375, -25],
  [2, "Camel Sitting", "Find a camel sitting on the sand.", 33.75, -28.75],
  [3, "Camel Near Market", "Find a camel standing near the market.", 60, -30],
  [4, "Camel with Saddle", "Find a camel wearing a decorative saddle.", 75, -31],
  [5, "Horse in Background", "Find a horse in the background.", 148.75, -29.375],
  [6, "Small Desert Fox", "Find a small desert fox.", 130, -33],
  [7, "Man Running", "Find a man running in the desert.", 100, -40],
  [8, "Child Flying a Kite", "Find a child flying a kite.", 55, -15],
  [9, "Drone", "Find a drone in the sky.", 43.75, -5.625],
  [10, "Hot-Air Balloon", "Find a hot-air balloon.", 114.375, -4.375],
  [11, "Red Sports Car", "Find a red sports car.", 100, -21.25],
  [12, "Colourful Food Truck", "Find a colourful food truck.", 86.25, -24.375],
  [13, "Bicycle by Palm Tree", "Find a bicycle near a palm tree.", 88, -14],
  [14, "Football", "Find a football on the ground.", 116.875, -54],
  [15, "Child Holding Balloons", "Find a child holding balloons.", 108, -12],
  [16, "Boy with UAE Flag", "Find a boy holding a UAE flag.", 70, -45],
  [17, "Flag on a Building", "Find a UAE flag displayed on a building.", 30, -18],
  [18, "Security Guard", "Find a security guard.", 12, -45],
  [19, "Chef Grilling", "Find a chef grilling food.", 95, -60],
  [20, "Plate of Luqaimat", "Find a plate filled with luqaimat.", 89.375, -65],
  [21, "Man Reading Newspaper", "Find a man reading a newspaper.", 25, -55],
  [22, "Man Taking a Selfie", "Find a man taking a selfie.", 105, -48],
  [23, "Woman Photographing", "Find a woman taking a photograph.", 130, -55],
  [24, "Tourist with a Map", "Find a tourist holding a map.", 118.375, -47.875],
  [25, "Man Carrying Luggage", "Find a man carrying luggage.", 140, -60],
  [26, "Person Pulling Suitcase", "Find a person pulling a suitcase.", 145, -68],
  [27, "Woman with Shopping Bags", "Find a woman carrying shopping bags.", 60, -50],
  [28, "Girl with Sunglasses", "Find a girl wearing sunglasses.", 78, -50],
  [29, "Woman with Blue Handbag", "Find a woman holding a blue handbag.", 85, -52],
  [30, "Child Eating Ice Cream", "Find a child eating ice cream.", 96, -30],
  [31, "Two Children with a Ball", "Find two children playing with a ball.", 120, -58],
  [32, "Desert Activity Group", "Find a group taking part in a desert activity.", 135, -36],
  [33, "Man in Kandura (Red Ghutra)", "Find a man wearing a white kandura and red head covering.", 61.25, -57.5],
  [34, "Woman in Black Abaya", "Find a woman wearing a black abaya.", 70.625, -60],
  [35, "Woman in Green Abaya", "Find a woman wearing a green abaya.", 54, -62],
  [36, "Henna Artist in Tent", "Find a henna artist working inside a tent.", 18.75, -73.75],
  [37, "Woman Showing Henna", "Find a woman showing henna on her hand.", 31, -72],
  [38, "Woman Drinking Coffee", "Find a woman drinking Arabic coffee.", 51.25, -73.75],
];

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

  for (const [order, name, description, targetX, targetY] of CLUES) {
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

  console.log(`Seeded ${CLUES.length} sample-task clues for Scene 2.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

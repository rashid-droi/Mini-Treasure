// Seeds Scene 2 with the canonical 38 "find" hidden-object clues.
//
// Coordinates are in map units (= source px / 8, matching scene1). targetY is
// negative (CRS.Simple: image top = 0, downward = negative). Items that map to
// an object already placed on scene2 reuse its known-good coordinate; the rest
// get spread-out STARTER coordinates — open the Scene Editor
// (/admin/scenes/scene2) and drag those markers onto the real objects.
//
// Safe to re-run: it clears scene2's existing clues first. No events currently
// reference scene2, so nothing downstream is affected.
//
// Run: npx tsx scripts/seed-scene2-objects.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const SCENE_ID = "scene2";

// [order, name, question text (description), targetX, targetY, placed]
// placed=true  -> reused a known-good coordinate from an existing scene2 clue
// placed=false -> STARTER coordinate; drag it into place in the editor
const CLUES: [number, string, string, number, number, boolean][] = [
  [1,  "Falcon on a Stand",        "Find a falcon perched on a stand.",                              9.375,  -25,     true],
  [2,  "Camel Sitting",            "Find a camel sitting on the sand.",                              33.75,  -28.75,  true],
  [3,  "Camel Near Market",        "Find a camel standing near the market.",                         60,     -30,     false],
  [4,  "Camel with Saddle",        "Find a camel wearing a decorative saddle.",                      75,     -31,     false],
  [5,  "Horse in Background",      "Find a horse in the background.",                                148.75, -29.375, true],
  [6,  "Small Desert Fox",         "Find a small desert fox.",                                       130,    -33,     false],
  [7,  "Man Running",              "Find a man running in the desert.",                              100,    -40,     false],
  [8,  "Child Flying a Kite",      "Find a child flying a kite.",                                    55,     -15,     false],
  [9,  "Drone",                    "Find a drone in the sky.",                                       43.75,  -5.625,  true],
  [10, "Hot-Air Balloon",          "Find a hot-air balloon.",                                        114.375,-4.375,  true],
  [11, "Red Sports Car",           "Find a red sports car.",                                         100,    -21.25,  true],
  [12, "Colourful Food Truck",     "Find a colourful food truck.",                                   86.25,  -24.375, true],
  [13, "Bicycle by Palm Tree",     "Find a bicycle near a palm tree.",                               88,     -14,     false],
  [14, "Football",                 "Find a football on the ground.",                                 116.875,-54,     true],
  [15, "Child Holding Balloons",   "Find a child holding balloons.",                                 108,    -12,     false],
  [16, "Boy with UAE Flag",        "Find a boy holding a UAE flag.",                                 70,     -45,     false],
  [17, "Flag on a Building",       "Find a UAE flag displayed on a building.",                       30,     -18,     false],
  [18, "Security Guard",           "Find a security guard.",                                         12,     -45,     false],
  [19, "Chef Grilling",            "Find a chef grilling food.",                                     95,     -60,     false],
  [20, "Plate of Luqaimat",        "Find a plate filled with luqaimat.",                             89.375, -65,     true],
  [21, "Man Reading Newspaper",    "Find a man reading a newspaper.",                                25,     -55,     false],
  [22, "Man Taking a Selfie",      "Find a man taking a selfie.",                                    105,    -48,     false],
  [23, "Woman Photographing",      "Find a woman taking a photograph.",                              130,    -55,     false],
  [24, "Tourist with a Map",       "Find a tourist holding a map.",                                  118.375,-47.875, true],
  [25, "Man Carrying Luggage",     "Find a man carrying luggage.",                                   140,    -60,     false],
  [26, "Person Pulling Suitcase",  "Find a person pulling a suitcase.",                              145,    -68,     false],
  [27, "Woman with Shopping Bags", "Find a woman carrying shopping bags.",                           60,     -50,     false],
  [28, "Girl with Sunglasses",     "Find a girl wearing sunglasses.",                                78,     -50,     false],
  [29, "Woman with Blue Handbag",  "Find a woman holding a blue handbag.",                           85,     -52,     false],
  [30, "Child Eating Ice Cream",   "Find a child eating ice cream.",                                 96,     -30,     false],
  [31, "Two Children with a Ball", "Find two children playing with a ball.",                         120,    -58,     false],
  [32, "Desert Activity Group",    "Find a group taking part in a desert activity.",                 135,    -36,     false],
  [33, "Man in Kandura (Red Ghutra)","Find a man wearing a white kandura and red head covering.",    61.25,  -57.5,   true],
  [34, "Woman in Black Abaya",     "Find a woman wearing a black abaya.",                            70.625, -60,     true],
  [35, "Woman in Green Abaya",     "Find a woman wearing a green abaya.",                            54,     -62,     false],
  [36, "Henna Artist in Tent",     "Find a henna artist working inside a tent.",                     18.75,  -73.75,  true],
  [37, "Woman Showing Henna",      "Find a woman showing henna on her hand.",                        31,     -72,     false],
  [38, "Woman Drinking Coffee",    "Find a woman drinking Arabic coffee.",                           51.25,  -73.75,  true],
];

async function main() {
  const scene = await prisma.scene.findUnique({ where: { id: SCENE_ID } });
  if (!scene) {
    throw new Error(`Scene "${SCENE_ID}" not found. Create it (with its tiles) first.`);
  }

  const removed = await prisma.clue.deleteMany({ where: { sceneId: SCENE_ID } });
  console.log(`Cleared ${removed.count} existing clue(s) from ${SCENE_ID}.`);

  let placed = 0, starter = 0;
  for (const [order, name, description, targetX, targetY, isPlaced] of CLUES) {
    await prisma.clue.create({
      data: {
        sceneId: SCENE_ID,
        name,
        description,
        type: "OBJECT",
        order,
        targetX,
        targetY,
        points: 100,
      },
    });
    isPlaced ? placed++ : starter++;
  }

  console.log(`Seeded ${CLUES.length} clues on ${SCENE_ID}.`);
  console.log(`  ${placed} reuse known-good coordinates.`);
  console.log(`  ${starter} have STARTER coordinates — drag them into place at /admin/scenes/${SCENE_ID}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

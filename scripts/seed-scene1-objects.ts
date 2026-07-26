// Seeds scene1 with hidden-object clues for every object visible in the
// image. Coordinates were mapped from the source screenshot (1248x698):
// map units = source pixels / 8 (zoom-3 tiles are the native resolution),
// targetY is negative (CRS.Simple, image top = 0, downward = negative).
//
// Run: npx tsx scripts/seed-scene1-objects.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const SCENE_ID = "scene1";
// In map units (= source px / 8). 5 units = 40px hit radius in the photo.
const CLICK_TOLERANCE = 5;

// [name, category, sourcePxX, sourcePxY]
const OBJECTS: [string, string, number, number][] = [
  // Nature & Landscape
  ["Sun", "Nature & Landscape", 736, 70],
  ["Desert sand dunes", "Nature & Landscape", 1047, 100],
  ["Palm trees", "Nature & Landscape", 100, 75],
  ["Oasis vegetation", "Nature & Landscape", 531, 170],
  ["Rocks", "Nature & Landscape", 1132, 250],
  ["Sky", "Nature & Landscape", 250, 40],
  ["Clouds", "Nature & Landscape", 310, 25],
  // Buildings & Structures
  ["Dubai skyline", "Buildings & Structures", 325, 80],
  ["Burj Khalifa", "Buildings & Structures", 443, 65],
  ["Traditional fort walls", "Buildings & Structures", 90, 232],
  ["Large entrance gate", "Buildings & Structures", 225, 200],
  ["Traditional buildings", "Buildings & Structures", 451, 140],
  ["Market stalls", "Buildings & Structures", 476, 270],
  ["Food truck / ice cream truck", "Buildings & Structures", 671, 270],
  ["Large Bedouin tent", "Buildings & Structures", 1027, 280],
  ["Outdoor majlis seating tent", "Buildings & Structures", 1132, 424],
  ["Tables", "Buildings & Structures", 783, 517],
  ["Wooden display counters", "Buildings & Structures", 150, 484],
  // Animals
  ["Falcon", "Animals", 85, 320],
  ["Two camels", "Animals", 1072, 335],
  ["Horse with rider", "Animals", 1082, 155],
  ["Lizard", "Animals", 1152, 240],
  ["Small desert fox", "Animals", 1059, 207],
  ["Gecko on the sand", "Animals", 982, 202],
  // Vehicles
  ["Red sports car", "Vehicles", 681, 205],
  ["Bicycle", "Vehicles", 566, 270],
  ["Drone", "Vehicles", 598, 52],
  // Flying Objects
  ["Kite", "Flying Objects", 927, 77],
  ["Hot air balloon", "Flying Objects", 1109, 40],
  // People & Activities
  ["Men in kandura", "People & Activities", 215, 295],
  ["Women in abaya", "People & Activities", 290, 524],
  ["Children", "People & Activities", 887, 325],
  ["Tourists", "People & Activities", 884, 407],
  ["Chef", "People & Activities", 501, 539],
  ["Police officer", "People & Activities", 400, 564],
  ["Runner", "People & Activities", 508, 414],
  ["Camel handler", "People & Activities", 800, 288],
  ["Horse rider", "People & Activities", 1090, 146],
  ["Food vendor", "People & Activities", 145, 399],
  ["Coffee server", "People & Activities", 638, 401],
  ["Balloon seller", "People & Activities", 771, 641],
  ["Tourist reading map", "People & Activities", 932, 398],
  ["People sitting in majlis", "People & Activities", 1042, 484],
  ["Children playing football", "People & Activities", 760, 217],
  ["Family walking", "People & Activities", 631, 589],
  ["People shopping", "People & Activities", 255, 456],
  ["People eating", "People & Activities", 563, 534],
  ["People drinking coffee", "People & Activities", 880, 600],
  ["Person waving UAE flag", "People & Activities", 772, 333],
  ["Person flying kite", "People & Activities", 854, 160],
  // Traditional UAE Objects
  ["Dallah (Arabic coffee pot)", "Traditional UAE Objects", 796, 444],
  ["Incense burner", "Traditional UAE Objects", 215, 449],
  ["Lanterns", "Traditional UAE Objects", 115, 549],
  ["Dates", "Traditional UAE Objects", 60, 155],
  ["Arabic carpets", "Traditional UAE Objects", 1077, 544],
  ["Cushions", "Traditional UAE Objects", 1087, 566],
  ["Traditional majlis sofas", "Traditional UAE Objects", 1032, 489],
  ["Decorative chests", "Traditional UAE Objects", 1202, 649],
  ["Pottery", "Traditional UAE Objects", 436, 494],
  ["Traditional coffee cups", "Traditional UAE Objects", 776, 507],
  ["Serving trays", "Traditional UAE Objects", 708, 469],
  // Market Items
  ["Fruits (dates)", "Market Items", 150, 461],
  ["Baskets", "Market Items", 195, 459],
  ["Wooden bowls", "Market Items", 452, 502],
  ["Model dhow boats", "Market Items", 370, 439],
  ["Oud (musical instrument)", "Market Items", 182, 421],
  ["Hanging lamps", "Market Items", 395, 260],
  ["Hanging pottery", "Market Items", 380, 272],
  ["Bottles", "Market Items", 108, 665],
  ["Handicrafts", "Market Items", 85, 464],
  ["Henna display", "Market Items", 245, 626],
  // Food & Cooking
  ["Barbecue grill", "Food & Cooking", 496, 629],
  ["Skewers", "Food & Cooking", 541, 609],
  ["Plates of food", "Food & Cooking", 466, 652],
  ["Tea set", "Food & Cooking", 1124, 511],
  ["Coffee cups", "Food & Cooking", 859, 499],
  ["Cooking utensils", "Food & Cooking", 531, 584],
  // Furniture
  ["Chairs", "Furniture", 959, 619],
  ["Sofas", "Furniture", 50, 634],
  ["Rugs", "Furniture", 1127, 644],
  ["Wooden crates", "Furniture", 195, 524],
  // Toys & Recreation
  ["Football (soccer ball)", "Toys & Recreation", 892, 561],
  ["Balloons", "Toys & Recreation", 783, 584],
  // Clothing & Accessories
  ["Kanduras", "Clothing & Accessories", 290, 277],
  ["Abayas", "Clothing & Accessories", 350, 300],
  ["Headscarves", "Clothing & Accessories", 713, 544],
  ["Sunglasses", "Clothing & Accessories", 661, 521],
  ["Backpack", "Clothing & Accessories", 876, 418],
  ["Handbag", "Clothing & Accessories", 608, 569],
  ["Briefcase", "Clothing & Accessories", 999, 644],
  // Small Decorative Objects
  ["Hanging ornaments", "Small Decorative Objects", 1057, 416],
  ["Treasure chest", "Small Decorative Objects", 1215, 605],
  ["Water bottles", "Small Decorative Objects", 877, 589],
  ["Cups", "Small Decorative Objects", 137, 669],
  ["Plates", "Small Decorative Objects", 788, 515],
  ["Serving tray", "Small Decorative Objects", 120, 668],
  ["Rope decorations", "Small Decorative Objects", 997, 396],
  // Flags
  ["UAE flag", "Flags", 763, 324],
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

  const existing = await prisma.clue.findMany({
    where: { sceneId: SCENE_ID },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()));

  let created = 0, skipped = 0;
  for (const [name, category, px, py] of OBJECTS) {
    if (existingNames.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    await prisma.clue.create({
      data: {
        sceneId: SCENE_ID,
        name,
        description: `Can you find the ${name.toLowerCase()}? (${category})`,
        type: "OBJECT",
        targetX: px / 8,
        targetY: -py / 8,
        points: 100,
      },
    });
    created++;
  }
  console.log(`Created ${created} clues, skipped ${skipped} already-existing names.`);
  console.log(`Scene1 now has ${existing.length + created} clues total.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

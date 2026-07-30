import { ClueType } from "@prisma/client";
import prisma from "../src/lib/prisma";

const CLUE_NAMES = [
  "Falcon", "Camel", "Horse", "Tourist", "Kandura", "Abaya", "Tent", 
  "Majlis", "Coffee", "Lantern", "Sports Car", "Food Truck", "Treasure Chest", 
  "Drone", "Balloon", "Palm Tree", "Dates", "Henna", "Football", "Map", 
  "Karak", "Luqaimat", "Boat", "Oud", "Pearls", "Golden Key"
];

const CLUE_TYPES: ClueType[] = ["TEXT", "IMAGE", "RIDDLE", "LOCATION", "OBJECT"];

async function main() {
  console.log("Seeding database...");

  // 1. Create the Scenes
  const scene1 = await prisma.scene.upsert({
    where: { id: "scene1" },
    update: { clickTolerance: 50 },
    create: {
      id: "scene1",
      name: "Scene 1",
      imageUrl: "/placeholder1.jpg",
      clickTolerance: 50
    }
  });

  const scene2 = await prisma.scene.upsert({
    where: { id: "scene2" },
    update: { clickTolerance: 5 },
    create: {
      id: "scene2",
      name: "Scene 2",
      imageUrl: "/placeholder2.jpg",
      clickTolerance: 5
    }
  });

  console.log(`Created Scenes: ${scene1.name}, ${scene2.name}`);

  // 2. Create the 26 Clues, split between the two scenes
  let clueCount = 0;
  for (let i = 0; i < CLUE_NAMES.length; i++) {
    const name = CLUE_NAMES[i];
    const type = CLUE_TYPES[Math.floor(Math.random() * CLUE_TYPES.length)];
    const description = `Can you find the ${name} hidden in the scene?`;
    const sceneId = i % 2 === 0 ? scene1.id : scene2.id;

    await prisma.clue.create({
      data: {
        sceneId,
        name,
        description,
        type,
        targetX: Math.floor(Math.random() * 1000) + 100, // random X inside the map bounds
        targetY: -Math.floor(Math.random() * 500) - 100, // Leaflet Simple CRS Y is negative
        points: Math.floor(Math.random() * 5) * 10 + 10 
      }
    });
    clueCount++;
  }

  // 3. Dropdown-answer QUESTION clues (answered via select + Submit, not by clicking)
  const QUESTION_CLUES = [
    {
      name: "How many people are clearly running?",
      options: ["0", "1", "2", "3", "4"],
      correctAnswer: "1"
    },
    {
      name: "What colour is the postbox?",
      options: ["Blue", "Red", "Green", "Yellow"],
      correctAnswer: "Red"
    }
  ];

  for (let i = 0; i < QUESTION_CLUES.length; i++) {
    const q = QUESTION_CLUES[i];
    for (const sceneId of [scene1.id, scene2.id]) {
      await prisma.clue.create({
        data: {
          sceneId,
          name: q.name,
          description: q.name,
          type: "QUESTION",
          options: q.options,
          correctAnswer: q.correctAnswer,
          targetX: Math.floor(Math.random() * 1000) + 100,
          targetY: -Math.floor(Math.random() * 500) - 100,
          points: 20
        }
      });
      clueCount++;
    }
  }

  console.log(`Created ${clueCount} clues across the scenes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const CLUE_NAMES = [
  "Falcon", "Camel", "Horse", "Tourist", "Kandura", "Abaya", "Tent", 
  "Majlis", "Coffee", "Lantern", "Sports Car", "Food Truck", "Treasure Chest", 
  "Drone", "Balloon", "Palm Tree", "Dates", "Henna", "Football", "Map", 
  "Karak", "Luqaimat", "Boat", "Oud", "Pearls", "Golden Key"
];

const CLUE_TYPES: any[] = ["TEXT", "IMAGE", "RIDDLE", "LOCATION", "OBJECT"];

export async function GET() {
  try {
    // 1. Create the Scenes
    const scene1 = await prisma.scene.create({
      data: {
        id: "scene1",
        name: "Scene 1",
        imageUrl: "/placeholder1.jpg"
      }
    });
  
    const scene2 = await prisma.scene.create({
      data: {
        id: "scene2",
        name: "Scene 2",
        imageUrl: "/placeholder2.jpg"
      }
    });

    // 2. Create the 26 Clues for this scene
    let clueCount = 0;
    for (let i = 0; i < CLUE_NAMES.length; i++) {
      const name = CLUE_NAMES[i];
      const type = CLUE_TYPES[Math.floor(Math.random() * CLUE_TYPES.length)];
      const targetX = Math.floor(Math.random() * 1000) + 100;
      const targetY = -Math.floor(Math.random() * 500) - 100;
      const description = `Can you find the ${name} hidden in the scene?`;
      const sceneId = i % 2 === 0 ? scene1.id : scene2.id;

      await prisma.clue.create({
        data: {
          sceneId,
          name,
          description,
          type,
          targetX,
          targetY,
          points: Math.floor(Math.random() * 5) * 10 + 10 
        }
      });
      clueCount++;
    }

    return NextResponse.json({ success: true, message: `Created Scenes ${scene1.name}, ${scene2.name} and ${clueCount} clues.` });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

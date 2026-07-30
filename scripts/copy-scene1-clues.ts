// Copies every clue from scene1 into scene-01-jpg-ms5v547c with identical
// coordinates and properties (same clue, same place). New clue rows get fresh
// ids and the destination sceneId; everything else is copied verbatim.
//
// Idempotent: deletes existing clues in the destination scene first, so
// re-running produces a clean 1:1 copy instead of duplicates.
//
// Run: npx tsx scripts/copy-scene1-clues.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";

const SRC_SCENE_ID = "scene1";
const DST_SCENE_ID = "scene-01-jpg-ms5v547c";

async function main() {
  const [src, dst] = await Promise.all([
    prisma.scene.findUnique({ where: { id: SRC_SCENE_ID } }),
    prisma.scene.findUnique({ where: { id: DST_SCENE_ID } }),
  ]);
  if (!src) throw new Error(`Source scene "${SRC_SCENE_ID}" not found.`);
  if (!dst) throw new Error(`Destination scene "${DST_SCENE_ID}" not found.`);

  const srcClues = await prisma.clue.findMany({
    where: { sceneId: SRC_SCENE_ID },
    orderBy: { order: "asc" },
  });
  console.log(`Found ${srcClues.length} clues in "${src.name}".`);

  const result = await prisma.$transaction(async (tx) => {
    // Clear destination so a re-run is a clean copy (cascades any answers
    // tied to the old destination clues).
    const deleted = await tx.clue.deleteMany({ where: { sceneId: DST_SCENE_ID } });

    const created = await tx.clue.createMany({
      data: srcClues.map((c) => ({
        sceneId: DST_SCENE_ID,
        name: c.name,
        description: c.description,
        type: c.type,
        mediaUrl: c.mediaUrl,
        points: c.points,
        order: c.order,
        targetX: c.targetX,
        targetY: c.targetY,
        radius: c.radius,
        shape: c.shape,
        options: c.options,
        correctAnswer: c.correctAnswer,
      })),
    });

    return { deleted: deleted.count, created: created.count };
  });

  console.log(`Removed ${result.deleted} existing clue(s) from "${dst.name}".`);
  console.log(`Copied ${result.created} clue(s) into "${dst.name}" (${DST_SCENE_ID}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

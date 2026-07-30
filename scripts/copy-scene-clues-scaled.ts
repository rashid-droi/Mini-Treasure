// Copies every clue from a source scene into a destination scene, rescaling
// coordinates so each clue lands on the SAME object/area in the destination.
//
// Why rescale: clue coords are stored in "map units" = source_px / 2^maxZoom.
// A high-res re-upload has more zoom levels (bigger divisor), so the same object
// sits at a different map-unit value. We convert via relative position:
//   X_dst = X_src * (dstWidthPx / dstScale) / (srcWidthPx / srcScale)
// (map-unit width = px / scale), and likewise for Y and the hotspot radius.
//
// Idempotent: clears the destination scene's clues first, so re-running is a
// clean 1:1 copy instead of duplicates.
//
// Run: npx tsx scripts/copy-scene-clues-scaled.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../src/lib/prisma";

const SRC_SCENE_ID = "scene2";
const DST_SCENE_ID = "scene-02-jpg-ms5v5ky9";

const TILES_DIR = path.join(process.cwd(), "public", "tiles");

// Deepest zoom level directory present for a scene's tiles (0,1,2,...).
function maxZoomLevel(sceneId: string): number {
  const dir = path.join(TILES_DIR, sceneId);
  const levels = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => Number(e.name));
  if (levels.length === 0) throw new Error(`No zoom-level tiles found for "${sceneId}".`);
  return Math.max(...levels);
}

// Exact source dimensions from the tiler's meta.json.
function imageSize(sceneId: string): { width: number; height: number } {
  const metaPath = path.join(TILES_DIR, sceneId, "meta.json");
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (!meta?.width || !meta?.height) throw new Error(`meta.json for "${sceneId}" missing width/height.`);
  return { width: meta.width, height: meta.height };
}

// Map-unit extent of a scene = px / 2^maxZoom.
function mapUnitSize(sceneId: string) {
  const { width, height } = imageSize(sceneId);
  const scale = Math.pow(2, maxZoomLevel(sceneId));
  return { w: width / scale, h: height / scale };
}

async function main() {
  const [src, dst] = await Promise.all([
    prisma.scene.findUnique({ where: { id: SRC_SCENE_ID } }),
    prisma.scene.findUnique({ where: { id: DST_SCENE_ID } }),
  ]);
  if (!src) throw new Error(`Source scene "${SRC_SCENE_ID}" not found.`);
  if (!dst) throw new Error(`Destination scene "${DST_SCENE_ID}" not found.`);

  const srcMap = mapUnitSize(SRC_SCENE_ID);
  const dstMap = mapUnitSize(DST_SCENE_ID);
  const fx = dstMap.w / srcMap.w; // X scale factor
  const fy = dstMap.h / srcMap.h; // Y scale factor
  const fr = (fx + fy) / 2; // radius: single value, use the average

  console.log(`Source map units: ${srcMap.w.toFixed(2)} x ${srcMap.h.toFixed(2)}`);
  console.log(`Dest   map units: ${dstMap.w.toFixed(2)} x ${dstMap.h.toFixed(2)}`);
  console.log(`Scale factors -> x: ${fx.toFixed(4)}, y: ${fy.toFixed(4)}, radius: ${fr.toFixed(4)}`);

  const srcClues = await prisma.clue.findMany({
    where: { sceneId: SRC_SCENE_ID },
    orderBy: { order: "asc" },
  });
  console.log(`Found ${srcClues.length} clues in "${src.name}".`);

  const result = await prisma.$transaction(async (tx) => {
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
        targetX: c.targetX * fx,
        targetY: c.targetY * fy, // negative values scale the same way
        radius: c.radius == null ? null : Math.round(c.radius * fr),
        shape: c.shape,
        options: c.options,
        correctAnswer: c.correctAnswer,
      })),
    });
    return { deleted: deleted.count, created: created.count };
  });

  console.log(`Removed ${result.deleted} existing clue(s) from "${dst.name}".`);
  console.log(`Copied ${result.created} clue(s) into "${dst.name}" (${DST_SCENE_ID}), coordinates rescaled.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

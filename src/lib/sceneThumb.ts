import "server-only";
import fs from "node:fs";
import path from "node:path";

// The zoom-0 overview tile (`/tiles/<id>/0/0/0.jpg`) is the source image scaled
// to 1/2^levels and pinned to the TOP-LEFT of a 256px square, with white
// padding filling the rest (right + bottom). This returns the fraction of the
// tile the real image occupies, so a thumbnail can crop out that padding.
// Falls back to { fx: 1, fy: 1 } (whole tile) when no meta.json is available.
export type OverviewCrop = { fx: number; fy: number };

function folderFromImageUrl(imageUrl?: string | null): string | null {
  const m = imageUrl?.match(/\/tiles\/([^/]+)\//);
  return m ? m[1] : null;
}

export function overviewCrop(imageUrl?: string | null): OverviewCrop {
  const folder = folderFromImageUrl(imageUrl);
  if (!folder) return { fx: 1, fy: 1 };
  try {
    const metaPath = path.join(process.cwd(), "public", "tiles", folder, "meta.json");
    const { width, height } = JSON.parse(fs.readFileSync(metaPath, "utf8")) as {
      width?: number;
      height?: number;
    };
    if (!width || !height) return { fx: 1, fy: 1 };
    // Levels the tiler produced = ceil(log2(maxDim / 256)); the zoom-0 tile then
    // represents a 256 * 2^levels source-pixel square (the padded overview).
    const levels = Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / 256)));
    const virtualSize = 256 * Math.pow(2, levels);
    return { fx: Math.min(width / virtualSize, 1), fy: Math.min(height / virtualSize, 1) };
  } catch {
    return { fx: 1, fy: 1 };
  }
}

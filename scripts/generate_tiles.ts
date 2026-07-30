import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function generateTiles(inputFile: string, outputDir: string) {
  console.log(`Generating tiles for ${inputFile} into ${outputDir}...`);

  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Record the true source dimensions before tiling. The 'google' layout pads
    // edge tiles to a full 256px square with a white background, so the viewers
    // read meta.json to crop that padding out of view (no white right/bottom
    // margin). Written alongside the tiles as /tiles/<scene>/meta.json.
    const { width, height } = await sharp(inputFile).metadata();

    await sharp(inputFile)
      .jpeg({ quality: 92, mozjpeg: true })
      .tile({
        size: 256,
        layout: 'google' // Output Slippy map XYZ tiles ({z}/{x}/{y})
      })
      .toFile(outputDir);

    if (width && height) {
      fs.writeFileSync(
        path.join(outputDir, 'meta.json'),
        JSON.stringify({ width, height })
      );
    }

    console.log(`Successfully generated tiles in ${outputDir} (${width}x${height})`);
  } catch (error) {
    console.error(`Error generating tiles for ${inputFile}:`, error);
  }
}

async function main() {
  // Be careful with the non-breaking space in the filename
  const scene1Path = path.join(process.cwd(), 'src', 'Screenshot 2026-07-15 at 10.30.18\u202FAM.png');
  const scene2Path = path.join(process.cwd(), 'src', 'Screenshot 2026-07-15 at 10.30.35\u202FAM.png');
  
  const scene1OutputDir = path.join(process.cwd(), 'public/tiles/scene1');
  const scene2OutputDir = path.join(process.cwd(), 'public/tiles/scene2');

  await generateTiles(scene1Path, scene1OutputDir);
  await generateTiles(scene2Path, scene2OutputDir);
}

main().catch(console.error);

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { finished } = require('stream/promises');

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`unexpected response ${res.statusText}`);
  const fileStream = fs.createWriteStream(dest, { flags: 'wx' });
  await finished(Readable.fromWeb(res.body).pipe(fileStream));
}

async function generateTiles() {
  const sceneId = "demo-scene";
  const outputDir = path.join(__dirname, '..', 'public', 'tiles', sceneId);
  const tempImagePath = path.join(__dirname, 'temp-image.jpg');

  // Create public/tiles directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear temp file if it stuck around
  if (fs.existsSync(tempImagePath)) {
    fs.unlinkSync(tempImagePath);
  }

  console.log("Downloading test image...");
  // Use a direct image URL (e.g. Wikimedia Commons) to avoid Unsplash redirect issues
  const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/e/e0/Large_Scaled_Forest_Lizard.jpg";
  await downloadImage(imageUrl, tempImagePath);

  console.log("Generating tiles with Sharp...");
  
  try {
    await sharp(tempImagePath)
      .jpeg({ quality: 80 })
      .tile({
        size: 256,
        layout: 'google'
      })
      .toFile(outputDir);
    
    console.log(`Tiles generated successfully in ${outputDir}`);
  } catch (err) {
    console.error("Error generating tiles:", err);
  } finally {
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
  }
}

generateTiles();

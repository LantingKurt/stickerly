import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));

// Rasterize the 64-unit viewBox far above target size, then downscale for clean edges.
const DENSITY = 384;

for (const size of [16, 32]) {
  await sharp(svg, { density: DENSITY })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, `favicon-${size}.png`));
}

// iOS flattens transparency, so the touch icon gets a solid pastel tile.
const sticker = await sharp(svg, { density: DENSITY }).resize(144, 144).png().toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: "#b3b8fb" },
})
  .composite([{ input: sticker, gravity: "center" }])
  .png()
  .toFile(join(publicDir, "apple-touch-icon.png"));

console.log("icons written to public/");

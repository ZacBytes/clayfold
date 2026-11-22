import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { fontCatalog, packFont } from "../js/font-export.mjs";
import { bitmapSize } from "../js/color-font.mjs";
import { getSprite } from "../integrations/static.mjs";
import { zipSync } from "../vendor/fflate-0.8.2.mjs";

if (!process.argv[2]) throw new Error("Pass an output directory for the font and sprite ZIPs.");
const output = resolve(process.argv[2]);
const read = path => readFile(new URL(path, import.meta.url));
const license = await read("../ARTWORK-LICENSE.md");
const { icons } = JSON.parse(await read("../catalog.json"));
const catalog = fontCatalog(icons);
const glyphs = [];
for (let index = 0; index < catalog.length; index += 8) {
  const batch = catalog.slice(index, index + 8);
  glyphs.push(...await Promise.all(batch.map(async ({id, ligature: name}) => ({
    name,
    png: await sharp(await read(`../assets/${id}.webp`)).resize(bitmapSize, bitmapSize).png().toBuffer(),
  }))));
}

const sprite = getSprite(catalog.map(icon => icon.id));
const readme = `# Clayfold SVG sprite

Serve clayfold-sprite.svg from your app’s own origin. Each symbol uses the stable icon ID from catalog.json.

\`\`\`html
<svg width="48" height="48" role="img" aria-label="Bookmark">
  <use href="/assets/clayfold-sprite.svg#bookmark"></use>
</svg>
\`\`\`

You can also include the sprite inline once and reference symbols by their IDs. See ARTWORK-LICENSE.md for the artwork terms.
`;
const encoder = new TextEncoder();
await mkdir(output, { recursive: true });
await writeFile(resolve(output, "clayfold-font.zip"), packFont(catalog, glyphs, license));
await writeFile(resolve(output, "clayfold-sprite.zip"), zipSync({
  "clayfold-sprite.svg": encoder.encode(sprite),
  "README.md": encoder.encode(readme),
  "ARTWORK-LICENSE.md": license,
}, { level: 1 }));
console.log(`Built the color font and SVG sprite for ${catalog.length} icons.`);

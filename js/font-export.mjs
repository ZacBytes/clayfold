import { buildColorFonts, bitmapSize } from "./color-font.mjs";
import { zipSync } from "../vendor/fflate-0.8.2.mjs";

const fontsCss = `@font-face {
  font-family: "Clayfold Icons";
  src: url("./clayfold-cbdt.ttf") format("truetype") tech(color-cbdt),
       url("./clayfold-sbix.ttf") format("truetype") tech(color-sbix);
  font-style: normal;
  font-weight: 400;
  font-display: block;
}

.clayfold-icons {
  display: inline-block;
  font: 400 var(--clayfold-icon-size, 1.5rem)/1 "Clayfold Icons", sans-serif;
  font-feature-settings: "liga" 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  direction: ltr;
  unicode-bidi: isolate;
}
`;

async function loadBitmap(icon, context) {
  const response = await fetch(new URL(`../assets/${icon.id}.png`, import.meta.url));
  if (!response.ok) throw new Error(`The artwork for ${icon.label} couldn’t be loaded.`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    context.clearRect(0, 0, bitmapSize, bitmapSize);
    context.drawImage(bitmap, 0, 0, bitmapSize, bitmapSize);
    // toBlob snapshots the canvas before returning, so each resize can reuse it.
    const resized = await new Promise(resolve => context.canvas.toBlob(resolve, "image/png"));
    if (!resized) throw new Error(`The artwork for ${icon.label} couldn’t be exported.`);
    return { name: icon.ligature, png: new Uint8Array(await resized.arrayBuffer()) };
  } finally {
    bitmap.close();
  }
}

export async function exportFontZip(icons, reportProgress) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = bitmapSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Two-dimensional drawing is unavailable in this browser.");
  context.imageSmoothingQuality = "high";
  const glyphs = [];
  const catalog = icons.map(({id, label}) => ({id, label, ligature: id.replaceAll("-", "_")}));
  const batchSize = 8;
  for (let index = 0; index < catalog.length; index += batchSize) {
    glyphs.push(...await Promise.all(catalog.slice(index, index + batchSize).map(icon => loadBitmap(icon, context))));
    reportProgress(`Preparing artwork (${glyphs.length} of ${catalog.length})…`);
  }
  const response = await fetch(new URL("../ARTWORK-LICENSE.md", import.meta.url));
  if (!response.ok) throw new Error("The artwork license couldn’t be loaded.");
  const license = new Uint8Array(await response.arrayBuffer());
  reportProgress("Building the font ZIP…");
  // Give the layout a frame to show the last status before writing the binary files.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const first = catalog[0];
  const label = first.label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const notes = `# Clayfold icon font

This subset contains ${catalog.length} ${catalog.length === 1 ? "icon" : "icons"} with ${bitmapSize} × ${bitmapSize} color artwork.

Keep both TTFs beside clayfold-icons.css and copy them into your app’s published assets. Link the stylesheet and use the ligature listed in icons.json:

\`\`\`html
<link rel="stylesheet" href="./clayfold-icons.css">
<span class="clayfold-icons" role="img" aria-label="${label}">${first.ligature}</span>
\`\`\`

Set --clayfold-icon-size to change display size. When switching a meaningful icon’s name, update its accessible label too. Use aria-hidden="true" for decorative icons that already have a text label next to them.

The stylesheet selects a color font format supported by the browser. Use the image files from the catalog when your target environment requires an image fallback.

Artwork by [Clayfold](https://zacbytes.github.io/clayfold/). See [ARTWORK-LICENSE.md](./ARTWORK-LICENSE.md) for credit, license terms, and rules that may apply to national flags.
`;
  const encoder = new TextEncoder();
  return new Blob([zipSync({
    ...buildColorFonts(glyphs),
    "clayfold-icons.css": encoder.encode(fontsCss),
    "icons.json": encoder.encode(JSON.stringify(catalog, null, 2) + "\n"),
    "ARTWORK-LICENSE.md": license,
    "README.md": encoder.encode(notes),
  }, { level: 0 })], { type: "application/zip" });
}

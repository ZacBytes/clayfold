import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const { icons, size } = JSON.parse(await readFile(new URL("catalog.json", root), "utf8"));
for (const { id, label } of icons) {
  const png = await readFile(new URL(`assets/${id}.png`, root));
  const title = label.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img"><title>${title}</title><image width="${size}" height="${size}" href="data:image/png;base64,${png.toString("base64")}"/></svg>\n`;
  await writeFile(new URL(`assets/${id}.svg`, root), svg);
}

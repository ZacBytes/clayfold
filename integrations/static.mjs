import { readFileSync } from "node:fs";
import { iconUrl } from "./web.mjs";

function image(name) {
  const url = new URL(iconUrl(name, { baseUrl: new URL("../assets/", import.meta.url).href }));
  const content = readFileSync(url, "base64");
  return `<image width="256" height="256" href="data:image/webp;base64,${content}"/>`;
}

export function getSvg(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${image(name)}</svg>`;
}

export function getSprite(names) {
  const symbols = [...new Set(names)].map(name => {
    const art = image(name);
    return `<symbol id="${name}" viewBox="0 0 256 256">${art}</symbol>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join("\n")}\n</svg>\n`;
}

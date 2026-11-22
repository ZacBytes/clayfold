const hostedAssets = "https://zacbytes.github.io/clayfold/assets/";
const formats = new Set(["webp", "png", "svg"]);

export function iconUrl(name, { format = "webp", baseUrl = hostedAssets } = {}) {
  if (typeof name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new TypeError("Use an icon ID from the Clayfold catalog.");
  }
  if (!formats.has(format)) throw new TypeError("Choose WebP, PNG, or SVG.");
  return `${String(baseUrl).replace(/\/+$/, "")}/${name}.${format}`;
}

export function renderIcons(root = document, options = {}) {
  const images = root.querySelectorAll("img[data-clayfold]");
  for (const image of images) {
    try {
      image.src = iconUrl(image.dataset.clayfold, options);
      if (!image.hasAttribute("alt")) image.alt = "";
    } catch {
      // Leave the original image in place when the ID or format is invalid.
    }
  }
}

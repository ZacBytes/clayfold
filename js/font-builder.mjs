import { prepareSearch, searchIcons } from "./search.mjs";

const byId = id => document.getElementById(id);
const query = byId("font-query");
const category = byId("font-category");
const grid = byId("font-grid");
const selectedList = byId("selected-icons");
const selectedCount = byId("selected-count");
const resultCount = byId("font-count");
const selectResults = byId("select-results");
const clear = byId("clear-selected");
const more = byId("more-font-icons");
const download = byId("export-font");
const status = byId("export-status");
const selected = new Set();
const pageSize = 48;
let limit = pageSize;
let catalog;
let iconsById;
let visible = [];
let exporting = false;
let archiveUrl;

function updateSelection() {
  const count = selected.size;
  selectedCount.textContent = `${count} ${count === 1 ? "icon" : "icons"} selected`;
  selectedList.hidden = !count;
  clear.disabled = !count;
  download.disabled = !count || exporting;
  selectResults.disabled = !visible.some(icon => !selected.has(icon.id));
  for (const button of grid.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(selected.has(button.dataset.icon)));
  }
  const items = [...selected].map(id => {
    const icon = iconsById.get(id);
    const item = document.createElement("li");
    const image = document.createElement("img");
    image.src = `./assets/${id}.webp`;
    image.width = image.height = 28;
    image.alt = "";
    image.loading = "lazy";
    const name = document.createElement("span");
    name.textContent = icon.label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "font-remove";
    remove.dataset.remove = id;
    remove.setAttribute("aria-label", `Remove ${icon.label}`);
    remove.textContent = "×";
    item.append(image, name, remove);
    return item;
  });
  selectedList.replaceChildren(...items);
}

function appendCards(reveal = false) {
  const fragment = document.createDocumentFragment();
  const start = grid.childElementCount;
  for (const [index, icon] of visible.slice(start, limit).entries()) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card font-tile";
    if (reveal && index < 8) card.classList.add("card-reveal");
    card.dataset.icon = icon.id;
    card.setAttribute("aria-pressed", String(selected.has(icon.id)));
    const art = document.createElement("span");
    art.className = "card-art";
    const image = document.createElement("img");
    image.src = `./assets/${icon.id}.webp`;
    image.alt = "";
    image.width = image.height = 66;
    image.loading = "lazy";
    image.decoding = "async";
    const name = document.createElement("span");
    name.className = "card-label";
    name.textContent = icon.label;
    art.append(image);
    card.append(art, name);
    fragment.append(card);
  }
  grid.append(fragment);
  more.hidden = grid.childElementCount >= visible.length;
}

function renderResults(reveal = false) {
  if (!catalog) return;
  const scope = category.value ? catalog.filter(icon => icon.category === category.value) : catalog;
  visible = searchIcons(scope, query.value);
  limit = pageSize;
  resultCount.textContent = visible.length
    ? `${visible.length} ${visible.length === 1 ? "icon" : "icons"}`
    : "No matching icons";
  selectResults.disabled = !visible.some(icon => !selected.has(icon.id));
  grid.replaceChildren();
  appendCards(reveal);
}

query.addEventListener("input", () => renderResults());
category.addEventListener("change", () => renderResults(true));
more.addEventListener("click", () => {
  const firstNew = grid.childElementCount;
  limit += pageSize;
  appendCards(true);
  grid.children[firstNew]?.focus();
});
grid.addEventListener("click", event => {
  const button = event.target.closest("[data-icon]");
  if (!button) return;
  const id = button.dataset.icon;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  updateSelection();
});
selectResults.addEventListener("click", () => {
  for (const icon of visible) selected.add(icon.id);
  updateSelection();
  download.focus({preventScroll: true});
});
clear.addEventListener("click", () => {
  selected.clear();
  updateSelection();
  query.focus({preventScroll: true});
});
selectedList.addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const item = button.closest("li");
  const index = [...selectedList.children].indexOf(item);
  selected.delete(button.dataset.remove);
  updateSelection();
  const next = selectedList.children[Math.min(index, selectedList.children.length - 1)];
  (next?.querySelector("button") ?? query).focus({preventScroll: true});
});

download.addEventListener("click", async () => {
  if (exporting || !selected.size) return;
  const icons = [...selected].map(id => iconsById.get(id));
  exporting = download.disabled = true;
  status.textContent = "Loading selected artwork…";
  if (archiveUrl) URL.revokeObjectURL(archiveUrl);
  try {
    const { exportFontZip } = await import("./font-export.mjs");
    const archive = await exportFontZip(icons, message => { status.textContent = message; });
    archiveUrl = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = archiveUrl;
    link.download = "clayfold-font.zip";
    link.textContent = "Download again";
    status.replaceChildren(`Font ZIP ready with ${icons.length} ${icons.length === 1 ? "icon" : "icons"}. `);
    status.append(link);
    link.click();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "The font couldn’t be built. Try again.";
  } finally {
    exporting = false;
    download.disabled = !selected.size;
  }
});

async function loadCatalog() {
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error("Catalog unavailable");
    const payload = await response.json();
    catalog = prepareSearch(payload.icons);
    iconsById = new Map(catalog.map(icon => [icon.id, icon]));
    for (const [id, label] of Object.entries(payload.categories)) {
      category.add(new Option(label, id));
    }
    renderResults();
  } catch {
    resultCount.textContent = "The catalog couldn’t be loaded. Refresh to try again.";
  }
}

loadCatalog();

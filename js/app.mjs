import { prepareSearch, searchIcons } from "./search.mjs";

const byId = id => document.getElementById(id);
const grid = byId("icon-grid");
const categories = byId("categories");
const interfaceGroups = byId("interface-groups");
const queryInput = byId("query");
const clearSearch = byId("clear-search");
const shortcut = byId("search-shortcut");
const detail = byId("icon-detail");
const copy = byId("copy-svg");
const copyStatus = byId("copy-status");
const copySource = byId("copy-source");
const asset = (icon, extension) => `./assets/${icon.id}.${extension}`;

let category = "all";
let interfaceGroup = "all";
let catalog;
let icons = [];
let currentIcon;
let semanticScores;
let worker;
let queryId = 0;
let searchTimer;
let statusTimer;
let waitingForMeaning = false;
let semanticUnavailable = false;
let previousQuery;
let copyRequest = 0;
let lastTrigger;
let detailHash;

function renderCategories() {
  const options = Object.entries({ all: "All icons", ...catalog.categories });
  const counts = new Map();
  for (const { category } of icons) counts.set(category, (counts.get(category) ?? 0) + 1);
  for (const [id, label] of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category";
    button.dataset.filter = id;
    button.setAttribute("aria-pressed", String(id === category));
    button.setAttribute("aria-controls", "icon-grid");
    const name = document.createElement("span");
    name.textContent = label;
    const count = document.createElement("span");
    count.className = "category-count";
    count.setAttribute("aria-hidden", "true");
    count.textContent = id === "all" ? icons.length : counts.get(id) ?? 0;
    button.append(name, count);
    categories.append(button);
  }
}

function renderInterfaceGroups() {
  const groups = Object.entries({ all: "All types", ...catalog.interfaceGroups });
  for (const [id, label] of groups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "interface-group";
    button.dataset.group = id;
    button.textContent = label;
    button.setAttribute("aria-controls", "icon-grid");
    interfaceGroups.append(button);
  }
}

function render() {
  if (!catalog) return;
  const query = queryInput.value.trim();
  const isInterface = category === "interface";
  const scope = category === "all" ? icons : icons.filter(icon => icon.category === category
    && (!isInterface || interfaceGroup === "all" || icon.group === interfaceGroup));
  const matches = searchIcons(scope, query, semanticScores);
  interfaceGroups.hidden = !isInterface;
  for (const button of interfaceGroups.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.group === interfaceGroup));
  }
  for (const button of categories.querySelectorAll(".category")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === category));
  }
  byId("collection-title").textContent = catalog.categories[category] ?? (query ? "Search results" : "All icons");
  const searching = waitingForMeaning && !matches.length;
  byId("results-count").textContent = searching
    ? "Searching by meaning…"
    : `${matches.length} ${matches.length === 1 ? "icon" : "icons"}`;
  byId("empty").hidden = matches.length !== 0 || searching;

  const focusedId = grid.contains(document.activeElement) ? document.activeElement.dataset.icon : null;
  const cards = document.createDocumentFragment();
  let focusedCard;
  for (const [index, icon] of matches.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.icon = icon.id;
    button.dataset.category = icon.category;
    button.setAttribute("aria-haspopup", "dialog");
    const art = document.createElement("span");
    art.className = "card-art";
    const image = document.createElement("img");
    image.alt = "";
    image.width = 87;
    image.height = 87;
    image.loading = index < 12 ? "eager" : "lazy";
    image.decoding = "async";
    image.src = asset(icon, "webp");
    const label = document.createElement("span");
    label.className = "card-label";
    label.textContent = icon.label;
    art.append(image);
    button.append(art, label);
    cards.append(button);
    if (icon.id === focusedId) focusedCard = button;
  }
  grid.replaceChildren(cards);
  if (focusedId) (focusedCard ?? queryInput).focus({ preventScroll: true });
}

function updateQuery() {
  const query = queryInput.value.trim();
  clearSearch.hidden = !queryInput.value;
  shortcut.hidden = Boolean(queryInput.value);
  if (query === previousQuery) return;
  previousQuery = query;
  semanticScores = undefined;
  clearTimeout(searchTimer);
  clearTimeout(statusTimer);
  const id = ++queryId;
  const exactName = icons.some(icon => icon.label.toLowerCase() === query.toLowerCase());
  waitingForMeaning = Boolean(query.length >= 3 && !exactName && !semanticUnavailable && window.Worker);
  render();
  if (!waitingForMeaning) return;
  statusTimer = setTimeout(finishSemanticSearch, 6000);
  searchTimer = setTimeout(() => {
    try {
      if (!worker) {
        worker = new Worker(new URL("./semantic-worker.mjs", import.meta.url), { type: "module" });
        worker.addEventListener("message", ({ data }) => {
          if (data.id !== queryId) return;
          semanticUnavailable = Boolean(data.unavailable);
          semanticScores = data.scores;
          finishSemanticSearch();
        });
        worker.addEventListener("error", disableSemanticSearch);
      }
      worker.postMessage({ id, query });
    } catch {
      disableSemanticSearch();
    }
  }, 250);
}

function finishSemanticSearch() {
  clearTimeout(statusTimer);
  waitingForMeaning = false;
  render();
}

function disableSemanticSearch() {
  semanticUnavailable = true;
  finishSemanticSearch();
}

function resetSearch() {
  category = "all";
  queryInput.value = "";
  if (previousQuery) updateQuery();
  else render();
  queryInput.focus();
}

function showIcon(icon, addHash = true) {
  currentIcon = icon;
  detailHash = "#icon=" + icon.id;
  if (addHash) {
    history.pushState({ kilnfieldIcon: true }, "", detailHash);
  }
  byId("detail-category").textContent = catalog.interfaceGroups?.[icon.group] ?? catalog.categories[icon.category];
  byId("detail-title").textContent = icon.label;
  byId("detail-description").textContent = icon.description || icon.subject;
  byId("detail-art").dataset.category = icon.category;
  byId("detail-preview").alt = icon.label;
  byId("detail-preview").src = asset(icon, "svg");
  for (const format of ["svg", "png", "webp"]) {
    const link = byId("download-" + format);
    link.href = asset(icon, format);
    link.download = icon.id + "." + format;
  }
  copyStatus.textContent = "";
  copySource.hidden = true;
  copy.disabled = false;
  ++copyRequest;
  if (!detail.open) detail.showModal();
}

function syncHash() {
  const id = location.hash.match(/^#icon=([a-z0-9-]+)$/)?.[1];
  const icon = icons.find(item => item.id === id);
  if (icon && icon !== currentIcon) showIcon(icon, false);
  if (!icon && detail.open) detail.close();
}

detail.addEventListener("close", () => {
  if (location.hash === detailHash) {
    if (history.state?.kilnfieldIcon) history.back();
    else history.replaceState(null, "", location.pathname + location.search + "#catalog");
  }
  currentIcon = null;
  ++copyRequest;
  copySource.value = "";
  const trigger = lastTrigger && grid.querySelector(`[data-icon="${lastTrigger}"]`);
  if (trigger) trigger.focus({ preventScroll: true });
  lastTrigger = null;
});
detail.addEventListener("click", event => {
  if (event.target === detail) detail.close();
});
window.addEventListener("hashchange", syncHash);

copy.addEventListener("click", async () => {
  const request = ++copyRequest;
  copy.disabled = true;
  copyStatus.textContent = "";
  copySource.hidden = true;
  try {
    const svg = fetch(asset(currentIcon, "svg")).then(response => {
      if (!response.ok) throw new Error("SVG unavailable");
      return response.text();
    });
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        const content = svg.then(source => new Blob([source], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": content })]);
      } else {
        const source = await svg;
        if (copyRequest !== request) return;
        await navigator.clipboard.writeText(source);
      }
      if (copyRequest === request) copyStatus.textContent = "SVG copied.";
    } catch {
      const source = await svg;
      if (copyRequest !== request) return;
      copyStatus.textContent = "SVG selected. Use your device’s copy command.";
      copySource.value = source;
      copySource.hidden = false;
      copySource.focus();
      copySource.select();
    }
  } catch {
    if (copyRequest === request) copyStatus.textContent = "SVG couldn’t be loaded. Try again.";
  } finally {
    if (copyRequest === request) copy.disabled = false;
  }
});

grid.addEventListener("click", event => {
  const card = event.target.closest(".card");
  if (!card) return;
  lastTrigger = card.dataset.icon;
  const icon = icons.find(item => item.id === lastTrigger);
  showIcon(icon);
});

categories.addEventListener("click", event => {
  const button = event.target.closest(".category");
  if (!button) return;
  if (category !== button.dataset.filter) interfaceGroup = "all";
  category = button.dataset.filter;
  render();
});

interfaceGroups.addEventListener("click", event => {
  const button = event.target.closest("button[data-group]");
  if (!button) return;
  interfaceGroup = button.dataset.group;
  render();
});

queryInput.addEventListener("input", updateQuery);
byId("search-form").addEventListener("submit", event => event.preventDefault());
clearSearch.addEventListener("click", () => {
  queryInput.value = "";
  updateQuery();
  queryInput.focus();
});
byId("reset").addEventListener("click", resetSearch);
for (const example of document.querySelectorAll("[data-query]")) {
  example.addEventListener("click", () => {
    category = "all";
    queryInput.value = example.dataset.query;
    if (previousQuery === queryInput.value) render();
    else updateQuery();
    queryInput.focus();
  });
}
document.addEventListener("keydown", event => {
  if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !detail.open
      && !event.target.closest("input,textarea,[contenteditable]")) {
    event.preventDefault();
    queryInput.focus();
  }
});

async function loadStars() {
  const link = byId("github-link");
  const slug = new URL(link.href).pathname.slice(1);
  try {
    const response = await fetch("https://api.github.com/repos/" + slug, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return;
    const { stargazers_count: stars } = await response.json();
    if (!Number.isSafeInteger(stars) || stars < 0) return;
    const badge = byId("star-count");
    badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9Z"/></svg>';
    badge.append(document.createTextNode(new Intl.NumberFormat().format(stars)));
    badge.hidden = false;
    link.setAttribute("aria-label", `GitHub, ${stars} ${stars === 1 ? "star" : "stars"}`);
  } catch {
    // The repository link is available independently of the GitHub API.
  }
}

async function loadCatalog() {
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error("Catalog unavailable");
    catalog = await response.json();
    icons = prepareSearch(catalog.icons);
    renderCategories();
    renderInterfaceGroups();
    render();
    syncHash();
  } catch {
    const notice = byId("notice");
    notice.textContent = "The catalog couldn’t load. Refresh to try again, or browse the files on GitHub.";
    notice.hidden = false;
  }
}

loadCatalog();
loadStars();

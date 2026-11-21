const stopWords = new Set("a an and any are as at be can could find for from has have how i icon icons in is it like me my need of on or please show some something that the there this to use used using want what when where which with would you".split(" "));

const conceptGroups = [
  "ship ships cargo freighter vessel maritime containers container",
  "airplane airline plane passenger aircraft aviation flight airport",
  "rail railway railroad train transit metro",
  "road trucking truck highway car lorry",
  "clean renewable green solar wind sustainable renewables",
  "electric electricity power electrical grid utility",
  "save later bookmark favourite favorite shortlist",
  "alert notify notification notifications reminder bell",
  "calendar date appointment appointments schedule planner event",
  "clock hour time watch timer",
  "file files folder directory organiser organizer",
  "chat text messaging message conversation comments comment bubble",
  "location map marker pin gps destination",
  "download fetch retrieve export offline",
  "success successful done completed confirmed approved check checkmark tick",
  "warning caution hazard danger exclamation",
  "settings preferences configure configuration gear cog",
  "search find lookup look magnify discover magnifier magnifying",
  "money banks bank banking funds finance banking",
  "flood overflowing inundation submerged floodwater flooding",
  "quake earthquake earthquakes tremor seismic",
  "storm storms rain lightning thunderstorm",
  "health healthcare medical medicine hospital aid first-aid",
  "microchip cpu processors chips chip semiconductors semiconductor",
  "security password passwords locked lock privacy cybersecurity authentication",
  "passport visa documents customs travel-document",
  "internet broadband fibre fiber cable cables connectivity",
  "nuclear atom reactor atomic",
  "flag flags ensign national country",
];
const related = new Map();
for (const group of conceptGroups) {
  const words = group.split(" ");
  for (const word of words) related.set(word, new Set([...(related.get(word) ?? []), ...words]));
}

function tokens(text) {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function prepareSearch(icons) {
  return icons.map(icon => ({
    ...icon,
    labelWords: new Set(tokens(icon.label + " " + icon.id)),
    tagWords: new Set(tokens([icon.subject, icon.description, ...(icon.tags ?? [])].join(" "))),
  }));
}

export function searchIcons(icons, query, semanticScores) {
  const phrase = tokens(query).join(" ");
  const terms = [...new Set(tokens(query).filter(word => !stopWords.has(word)))];
  if (!phrase) return icons;
  if (!terms.length) return [];
  const matches = [];
  const bestSemantic = semanticScores ? Math.max(...icons.map(icon => semanticScores[icon.id] ?? 0)) : 0;

  for (const icon of icons) {
    const exact = tokens(icon.label).join(" ") === phrase || tokens(icon.id).join(" ") === phrase;
    let lexical = 0;
    for (const word of terms) {
      if (icon.labelWords.has(word)) lexical += 1;
      else if (icon.tagWords.has(word)) lexical += .78;
      else if ([...(related.get(word) ?? [])].some(alias => icon.labelWords.has(alias) || icon.tagWords.has(alias))) lexical += .42;
      else if (word.length >= 3 && [...icon.labelWords].some(candidate => candidate.startsWith(word))) lexical += .48;
    }
    lexical /= terms.length;
    const similarity = semanticScores?.[icon.id] ?? 0;
    const semantic = Math.max(0, (similarity - .22) / .65);
    const relevance = exact ? 2 : lexical * .69 + semantic * .51;
    const descriptiveMatch = terms.length >= 3 && similarity >= .335 && similarity >= bestSemantic - .07;
    if (exact || lexical >= (terms.length === 1 ? .4 : .177) || similarity >= .42 || descriptiveMatch || (similarity >= .32 && lexical >= .1)) {
      matches.push({ icon, relevance });
    }
  }
  matches.sort((a, b) => b.relevance - a.relevance || a.icon.label.localeCompare(b.icon.label));
  return matches.slice(0, 32).map(match => match.icon);
}

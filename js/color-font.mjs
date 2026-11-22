// OpenType tables for a single 128 px color strike and name ligatures.
export const bitmapSize = 128;
const em = 1024;
const ascent = 896;
const descent = -128;
const chars = " 0123456789_abcdefghijklmnopqrstuvwxyz";
const firstIcon = chars.length + 1; // Glyph zero is .notdef.
const characterGlyphs = new Map([...chars].map((char, index) => [char, index + 1]));
const encoder = new TextEncoder();

function words(...values) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value));
  return bytes;
}
function dwords(...values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value));
  return bytes;
}
function join(parts) {
  const data = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    data.set(part, offset);
    offset += part.length;
  }
  return data;
}
function offsetsAfter(headerSize, parts) {
  let offset = headerSize;
  return parts.map(part => {
    const start = offset;
    offset += part.length;
    return start;
  });
}
function searchFields(count, unit) {
  const power = 2 ** Math.floor(Math.log2(count));
  return [power * unit, Math.log2(power), (count - power) * unit];
}

function characterMap() {
  // Format 4. Each ASCII character occupies one segment, plus the sentinel.
  const codes = [...chars].map(char => char.charCodeAt(0)).concat(0xffff);
  const length = 16 + 8 * codes.length;
  const deltas = codes.map((code, index) => index === codes.length - 1 ? 1 : index + 1 - code);
  const subtable = words(4, length, 0, 2 * codes.length, ...searchFields(codes.length, 2),
    ...codes, 0, ...codes, ...deltas, ...codes.map(() => 0));
  return join([words(0, 2, 0, 3), dwords(20), words(3, 1), dwords(20), subtable]);
}

function ligatures(glyphs) {
  const groups = new Map();
  for (const [index, glyph] of glyphs.entries()) {
    const [initial, ...tail] = [...glyph.name].map(char => characterGlyphs.get(char));
    if (!groups.has(initial)) groups.set(initial, []);
    groups.get(initial).push(words(firstIcon + index, tail.length + 1, ...tail));
  }
  const initials = [...groups.keys()].sort((a, b) => a - b);
  const sets = initials.map(initial => {
    // When an icon name prefixes another, match the longer name first.
    const records = groups.get(initial).sort((a, b) => b.length - a.length);
    return join([words(records.length, ...offsetsAfter(2 + 2 * records.length, records)), ...records]);
  });
  const coverage = words(1, initials.length, ...initials);
  const coverageOffset = 6 + 2 * sets.length;
  const substitution = join([words(1, coverageOffset, sets.length,
    ...offsetsAfter(coverageOffset + coverage.length, sets)), coverage, ...sets]);
  const script = join([words(2), encoder.encode("DFLT"), words(14), encoder.encode("latn"), words(14),
    words(4, 0, 0, 0xffff, 1, 0)]);
  const feature = join([words(1), encoder.encode("liga"), words(8, 0, 1, 0)]);
  const lookup = words(1, 4, 4, 0, 1, 8);
  return join([words(1, 0, 10, 10 + script.length, 10 + script.length + feature.length),
    script, feature, lookup, substitution]);
}

function fontNames(family) {
  const names = [
    [0, "Clayfold artwork."],
    [1, family], [2, "Regular"], [3, family + " 1.0"], [4, family],
    [5, "Version 1.0"], [6, family.replaceAll(" ", "")],
    [13, "See the included ARTWORK-LICENSE.md for license terms."],
    [14, "https://github.com/ZacBytes/clayfold/blob/main/ARTWORK-LICENSE.md"],
  ];
  const strings = names.map(([, value]) => words(...[...value].map(char => char.charCodeAt(0))));
  const offsets = offsetsAfter(0, strings);
  const records = names.flatMap(([id], index) => [3, 1, 0x409, id, strings[index].length, offsets[index]]);
  return join([words(0, names.length, 6 + 12 * names.length, ...records), ...strings]);
}

function standardTables(glyphs, family) {
  const count = firstIcon + glyphs.length;
  // Empty outlines for bitmap glyphs. The .notdef rectangle keeps glyf nonempty.
  const glyf = join([words(1, 0, 0, 510, 690, 3, 0),
    Uint8Array.of(0x31, 0x21, 0x11, 0x21), words(510, -510, 690)]);
  const metrics = Array.from({length: count}, (_, index) => [index < firstIcon ? 570 : em, 0]).flat();
  const head = join([dwords(0x10000, 0x10000, 0, 0x5f0f3cf5), words(3, em),
    dwords(0, 0xe7274522, 0, 0xe7274522), words(0, 0, 510, 690, 0, 3, 2, 0, 0)]);
  const hhea = join([dwords(0x10000), words(ascent, descent, 0, em, 0, 60, 510, 1, 0, 0,
    0, 0, 0, 0, 0, count)]);
  const maxp = join([dwords(0x10000), words(count, 4, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)]);
  const average = Math.round((chars.length * 570 + glyphs.length * em) / (count - 1));
  const contextLength = Math.max(...glyphs.map(glyph => glyph.name.length));
  const os2 = join([
    words(3, average, 400, 5, 0, ...Array(11).fill(0)),
    new Uint8Array(10), dwords(1, 0, 0, 0), encoder.encode("CLAY"),
    words(0x40, 32, 122, ascent, descent, 0, ascent, -descent), dwords(0, 0),
    words(0, 0, 0, 32, contextLength),
  ]);
  return {
    head, hhea, maxp, "OS/2": os2,
    cmap: characterMap(),
    hmtx: words(...metrics),
    glyf,
    loca: words(0, ...Array(count).fill(glyf.length / 2)),
    name: fontNames(family),
    post: dwords(0x30000, 0, 0, 0, 0, 0, 0, 0),
    GSUB: ligatures(glyphs),
  };
}

function appleBitmaps(glyphs) {
  const records = glyphs.map(({png}) => join([words(0, -bitmapSize / 8), encoder.encode("png "), png]));
  const headerSize = 4 + 4 * (firstIcon + records.length + 1);
  const starts = offsetsAfter(headerSize, records);
  return join([words(1, 1), dwords(1, 12), words(bitmapSize, 72),
    dwords(...Array(firstIcon).fill(headerSize), ...starts, starts.at(-1) + records.at(-1).length),
    ...records]);
}

function chromiumBitmaps(glyphs) {
  const top = bitmapSize * 7 / 8;
  const records = glyphs.map(({png}) => join([
    Uint8Array.of(bitmapSize, bitmapSize, 0, top, bitmapSize), dwords(png.length), png,
  ]));
  const starts = offsetsAfter(0, records);
  const endGlyph = firstIcon + records.length - 1;
  const stride = Uint8Array.of(top, top - bitmapSize, bitmapSize, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const location = join([words(firstIcon, endGlyph), dwords(8), words(1, 17), dwords(4),
    dwords(...starts, starts.at(-1) + records.at(-1).length)]);
  return {
    CBDT: join([dwords(0x30000), ...records]),
    CBLC: join([dwords(0x30000, 1, 56, location.length, 1, 0), stride, stride,
      words(firstIcon, endGlyph), Uint8Array.of(bitmapSize, bitmapSize, 32, 1), location]),
  };
}

function padded(length) { return Math.ceil(length / 4) * 4; }
function checksum(data) {
  let sum = 0;
  const full = data.length & ~3;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let index = 0; index < full; index += 4) sum = (sum + view.getUint32(index)) >>> 0;
  let tail = 0;
  for (let index = full; index < data.length; index++) tail |= data[index] << (24 - 8 * (index - full));
  return (sum + tail) >>> 0;
}

function writeSfnt(tables) {
  const tags = Object.keys(tables).sort();
  const header = join([dwords(0x10000), words(tags.length, ...searchFields(tags.length, 16))]);
  let offset = header.length + 16 * tags.length;
  const data = new Uint8Array(offset + tags.reduce((total, tag) => total + padded(tables[tag].length), 0));
  const view = new DataView(data.buffer);
  data.set(header);
  let headOffset;
  tags.forEach((tag, index) => {
    const table = tables[tag];
    const record = header.length + 16 * index;
    data.set(encoder.encode(tag), record);
    view.setUint32(record + 4, checksum(table));
    view.setUint32(record + 8, offset);
    view.setUint32(record + 12, table.length);
    data.set(table, offset);
    if (tag === "head") headOffset = offset;
    offset += padded(table.length);
  });
  view.setUint32(headOffset + 8, (0xb1b0afba - checksum(data)) >>> 0);
  return data;
}

export function buildColorFonts(glyphs) {
  if (!glyphs.length || new Set(glyphs.map(glyph => glyph.name)).size !== glyphs.length ||
    glyphs.some(glyph => !/^[a-z0-9_]{2,}$/.test(glyph.name))) {
    throw new Error("The font requires unique icon names.");
  }
  return {
    "clayfold-cbdt.ttf": writeSfnt({
      ...standardTables(glyphs, "Clayfold Icons CBDT"), ...chromiumBitmaps(glyphs),
    }),
    "clayfold-sbix.ttf": writeSfnt({
      ...standardTables(glyphs, "Clayfold Icons SBIX"), sbix: appleBitmaps(glyphs),
    }),
  };
}

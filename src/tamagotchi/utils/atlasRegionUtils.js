const ATLAS_SECTIONS = ["tiles", "objects", "variants"];

const indexCache = new WeakMap();

function sortByName(a, b) {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function addToMapList(map, key, value) {
  if (!key) return;

  const list = map.get(key);
  if (list) {
    list.push(value);
    return;
  }

  map.set(key, [value]);
}

function normalizeAtlasEntry(entry, section) {
  return {
    ...entry,
    section,
    id: entry.name,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    spawn: entry.spawn || {},
    collision: entry.collision || {},
    render: entry.render || {},
    special: entry.special || null,
    v1: entry.v1 || {},
  };
}

function filterSectionEntries(sectionEntries = {}, section) {
  return Object.values(sectionEntries)
    .filter((entry) => entry?.v1?.enabled === true)
    .map((entry) => normalizeAtlasEntry(entry, section));
}

export function createAtlasIndex(atlasData) {
  if (!atlasData) {
    return {
      entries: [],
      byName: new Map(),
      byGroup: new Map(),
      byFamily: new Map(),
      byCategory: new Map(),
      byLayer: new Map(),
      byTag: new Map(),
      meta: {},
      rules: {},
    };
  }

  const cached = indexCache.get(atlasData);
  if (cached) return cached;

  const entries = ATLAS_SECTIONS.flatMap((section) =>
    filterSectionEntries(atlasData[section], section)
  ).sort(sortByName);

  const byName = new Map();
  const byGroup = new Map();
  const byFamily = new Map();
  const byCategory = new Map();
  const byLayer = new Map();
  const byTag = new Map();

  entries.forEach((entry) => {
    byName.set(entry.name, entry);
    addToMapList(byGroup, entry.group, entry);
    addToMapList(byFamily, entry.family, entry);
    addToMapList(byCategory, entry.category, entry);
    addToMapList(byLayer, entry.render?.layer, entry);

    entry.tags.forEach((tag) => addToMapList(byTag, tag, entry));
  });

  [byGroup, byFamily, byCategory, byLayer, byTag].forEach((map) => {
    map.forEach((list) => list.sort(sortByName));
  });

  const index = {
    entries,
    byName,
    byGroup,
    byFamily,
    byCategory,
    byLayer,
    byTag,
    meta: atlasData.meta || {},
    rules: atlasData.rules || {},
  };

  indexCache.set(atlasData, index);

  return index;
}

export function getAtlasMeta(atlasData) {
  return createAtlasIndex(atlasData).meta;
}

export function getAtlasRules(atlasData) {
  return createAtlasIndex(atlasData).rules;
}

export function getEnabledEntries(atlasData, options = {}) {
  const { section, group, family, category, layer, tag } = options;
  let entries = createAtlasIndex(atlasData).entries;

  if (section) entries = entries.filter((entry) => entry.section === section);
  if (group) entries = entries.filter((entry) => entry.group === group);
  if (family) entries = entries.filter((entry) => entry.family === family);
  if (category) entries = entries.filter((entry) => entry.category === category);
  if (layer) entries = entries.filter((entry) => entry.render?.layer === layer);
  if (tag) entries = entries.filter((entry) => entry.tags.includes(tag));

  return entries;
}

export function getAtlasEntry(atlasData, name) {
  return createAtlasIndex(atlasData).byName.get(name) || null;
}

export function getGroupEntries(atlasData, groupName, options = {}) {
  const { section } = options;
  const entries = createAtlasIndex(atlasData).byGroup.get(groupName) || [];

  return section ? entries.filter((entry) => entry.section === section) : entries;
}

export function getFamilyEntries(atlasData, familyName, options = {}) {
  const { section } = options;
  const entries = createAtlasIndex(atlasData).byFamily.get(familyName) || [];

  return section ? entries.filter((entry) => entry.section === section) : entries;
}

export function getEntriesByFamilies(atlasData, families = [], options = {}) {
  return families.flatMap((family) => getFamilyEntries(atlasData, family, options));
}

export function getEntriesByGroupOrFamilies(atlasData, config = {}) {
  if (config.group) {
    const groupedEntries = getGroupEntries(atlasData, config.group, config);
    if (groupedEntries.length > 0) return groupedEntries;
  }

  return getEntriesByFamilies(atlasData, config.families || [], config);
}

export function hasAtlasTag(entry, tag) {
  return Boolean(entry?.tags?.includes(tag));
}

export function hashUnit(...parts) {
  let hash = 2166136261;

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const value = String(parts[partIndex]);

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    if (partIndex < parts.length - 1) {
      hash ^= 124;
      hash = Math.imul(hash, 16777619);
    }
  }

  return (hash >>> 0) / 4294967295;
}

export function chooseDeterministicVariant(entries, ...seedParts) {
  if (!entries.length) return null;

  const index = Math.floor(hashUnit(...seedParts) * entries.length) % entries.length;
  return entries[index];
}

export function getAtlasSliceBackgroundStyle(entry, atlasImage) {
  return {
    backgroundImage: `url(${atlasImage})`,
    backgroundPosition: `-${entry.x}px -${entry.y}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const ROOT_DIR = process.cwd();
const ATLAS_DIR = path.join(ROOT_DIR, "src", "spritesheets", "atlas");
const OUTPUT_DIR = path.join(ROOT_DIR, "src", "spritesheets", "world");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

const SEASON_ATLASES = {
  spring: "All tiles Spring.png",
  summer: "All tiles Summer.png",
  autumn: "All tiles Autumn.png",
  winter: "All tiles Winter.png",
};

const CATEGORY_NAMES = ["terrain", "trees", "rocks"];
const TERRAIN_EXCLUDED_TAGS = new Set([
  "water",
  "road",
  "path",
  "bridge",
  "sand",
  "hole",
  "animation",
]);
const TREE_FAMILY_PREFIXES = [
  "tree_green",
  "tree_pink",
  "tall_tree_green",
  "tall_tree_pink",
];

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function padIndex(value) {
  return String(value).padStart(2, "0");
}

function toPosixRelativePath(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath).split(path.sep).join("/");
}

function incrementCount(counter, key) {
  counter[key] = (counter[key] || 0) + 1;
}

function flattenAtlasEntries(atlasData) {
  const entries = [];

  for (const sectionName of ["tiles", "objects", "variants"]) {
    const section = atlasData[sectionName] || {};
    for (const entry of Object.values(section)) {
      if (entry && typeof entry === "object") {
        entries.push(entry);
      }
    }
  }

  return entries;
}

async function resolveAtlasJsonPath() {
  const preferredPath = path.join(ATLAS_DIR, "atlas-clean-v1.json");

  try {
    await fs.access(preferredPath);
    return preferredPath;
  } catch (error) {
    // Fall through to discovery.
  }

  const atlasFiles = await fs.readdir(ATLAS_DIR);
  const jsonCandidates = atlasFiles.filter((name) => name.endsWith(".json"));
  const rankedCandidates = [...jsonCandidates].sort((a, b) => {
    const score = (name) => {
      let total = 0;
      if (/clean/i.test(name)) total += 10;
      if (/v1/i.test(name)) total += 5;
      if (/atlas/i.test(name)) total += 2;
      return total;
    };

    return score(b) - score(a) || naturalCompare(a, b);
  });

  if (!rankedCandidates.length) {
    throw new Error(`No atlas JSON file found in ${ATLAS_DIR}`);
  }

  const bestCandidate = rankedCandidates[0];
  if (!/clean/i.test(bestCandidate) || !/v1/i.test(bestCandidate)) {
    throw new Error(
      `Cleaned V1 atlas JSON not found. Available JSON files: ${jsonCandidates.join(", ")}`
    );
  }

  return path.join(ATLAS_DIR, bestCandidate);
}

function validateRect(entry) {
  return (
    Number.isInteger(entry.x) &&
    Number.isInteger(entry.y) &&
    Number.isInteger(entry.width) &&
    Number.isInteger(entry.height) &&
    entry.width > 0 &&
    entry.height > 0
  );
}

function isV1Enabled(entry) {
  return entry?.v1?.enabled === true && entry?.v1?.excludedByRule !== true;
}

function terrainStemForEntry(entry) {
  const family = entry.family || "";

  if (family === "grass_base_light") return "grass_base";
  if (family === "grass_base_dark") return "grass_dark_base";
  if (family === "grass_patch") return "grass_patch";
  if (family === "grass_dark_patch") return "grass_dark_patch";
  if (family === "grass_variation") return "grass_variation";

  if (entry.category === "ground_base") return "grass_base";
  if (entry.category === "ground_variant" && entry.tags?.includes("grass_dark")) {
    return "grass_dark_base";
  }
  if (entry.category === "terrain_variation") return "terrain_variation";

  return entry.name;
}

function classifyEntry(entry, skippedCounts) {
  if (entry?.v1?.enabled !== true) {
    incrementCount(skippedCounts, "disabled_v1");
    return null;
  }

  if (entry?.v1?.excludedByRule) {
    incrementCount(skippedCounts, "excluded_by_rule");
    return null;
  }

  if (!validateRect(entry)) {
    incrementCount(skippedCounts, "invalid_source_rect");
    return null;
  }

  if (entry.group === "terrain") {
    const hasExcludedTag = (entry.tags || []).some((tag) => TERRAIN_EXCLUDED_TAGS.has(tag));
    const looksExcluded =
      hasExcludedTag ||
      /water|road|path|bridge|sand|hole|animation/i.test(
        [entry.category, entry.family, entry.description].filter(Boolean).join(" ")
      );

    if (looksExcluded) {
      incrementCount(skippedCounts, "terrain_excluded_context");
      return null;
    }

    return {
      category: "terrain",
      stem: terrainStemForEntry(entry),
    };
  }

  if (entry.group === "trees") {
    const family = entry.family || "";
    const name = entry.name || "";
    const isAllowedTree = TREE_FAMILY_PREFIXES.some(
      (prefix) => family.startsWith(prefix) || name.startsWith(prefix)
    );

    if (!isAllowedTree) {
      incrementCount(skippedCounts, "tree_family_not_selected");
      return null;
    }

    return {
      category: "trees",
      exportedName: name,
    };
  }

  if (entry.group === "rocks") {
    const isRock =
      entry.family === "rock" ||
      (entry.tags || []).includes("rock") ||
      /rock/i.test([entry.category, entry.family, entry.description].filter(Boolean).join(" "));

    if (!isRock) {
      incrementCount(skippedCounts, "rock_family_not_selected");
      return null;
    }

    return {
      category: "rocks",
      stem: "rock",
    };
  }

  incrementCount(skippedCounts, "group_not_selected");
  return null;
}

function assignExportNames(selectedEntries) {
  const byCategory = {
    terrain: [],
    trees: [],
    rocks: [],
  };

  selectedEntries.forEach((item) => {
    byCategory[item.category].push(item);
  });

  byCategory.terrain
    .sort((a, b) => naturalCompare(a.entry.name, b.entry.name))
    .reduce((groups, item) => {
      groups[item.stem] = groups[item.stem] || [];
      groups[item.stem].push(item);
      return groups;
    }, {});

  const terrainGroups = byCategory.terrain.reduce((groups, item) => {
    groups[item.stem] = groups[item.stem] || [];
    groups[item.stem].push(item);
    return groups;
  }, {});

  Object.keys(terrainGroups)
    .sort(naturalCompare)
    .forEach((stem) => {
      terrainGroups[stem]
        .sort((a, b) => naturalCompare(a.entry.name, b.entry.name))
        .forEach((item, index) => {
          item.exportedName = `${stem}_${padIndex(index + 1)}`;
        });
    });

  byCategory.trees
    .sort((a, b) => naturalCompare(a.entry.name, b.entry.name))
    .forEach((item) => {
      item.exportedName = item.exportedName || item.entry.name;
    });

  byCategory.rocks
    .sort((a, b) => {
      const areaDelta = b.entry.width * b.entry.height - a.entry.width * a.entry.height;
      if (areaDelta !== 0) return areaDelta;
      return naturalCompare(a.entry.name, b.entry.name);
    })
    .forEach((item, index) => {
      item.exportedName = `rock_${padIndex(index + 1)}`;
    });

  return byCategory;
}

function assertUniqueFilenames(byCategory) {
  for (const category of CATEGORY_NAMES) {
    const seen = new Set();

    for (const item of byCategory[category]) {
      if (seen.has(item.exportedName)) {
        throw new Error(
          `Duplicate exported filename "${item.exportedName}.png" in category "${category}"`
        );
      }
      seen.add(item.exportedName);
    }
  }
}

async function loadAtlasMetadata() {
  const metadataBySeason = {};
  let expectedWidth = null;
  let expectedHeight = null;

  for (const [season, atlasFilename] of Object.entries(SEASON_ATLASES)) {
    const atlasPath = path.join(ATLAS_DIR, atlasFilename);

    try {
      await fs.access(atlasPath);
    } catch (error) {
      throw new Error(`Missing seasonal atlas for ${season}: ${atlasPath}`);
    }

    const metadata = await sharp(atlasPath).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Could not read image dimensions for ${atlasPath}`);
    }

    if (expectedWidth === null) {
      expectedWidth = metadata.width;
      expectedHeight = metadata.height;
    } else if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
      throw new Error(
        `Seasonal atlases must share dimensions. Expected ${expectedWidth}x${expectedHeight}, got ${metadata.width}x${metadata.height} for ${atlasPath}`
      );
    }

    metadataBySeason[season] = {
      atlasPath,
      width: metadata.width,
      height: metadata.height,
    };
  }

  return metadataBySeason;
}

function validateSelectionBounds(selectedEntries, atlasMetadataBySeason) {
  const firstSeason = Object.keys(atlasMetadataBySeason)[0];
  const atlasWidth = atlasMetadataBySeason[firstSeason].width;
  const atlasHeight = atlasMetadataBySeason[firstSeason].height;

  selectedEntries.forEach(({ entry }) => {
    if (
      entry.x < 0 ||
      entry.y < 0 ||
      entry.x + entry.width > atlasWidth ||
      entry.y + entry.height > atlasHeight
    ) {
      throw new Error(
        `Crop rect for "${entry.name}" falls outside atlas bounds: (${entry.x}, ${entry.y}, ${entry.width}, ${entry.height}) within ${atlasWidth}x${atlasHeight}`
      );
    }
  });
}

async function resetOutputDirectories() {
  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });

  for (const season of Object.keys(SEASON_ATLASES)) {
    for (const category of CATEGORY_NAMES) {
      await fs.mkdir(path.join(OUTPUT_DIR, season, category), { recursive: true });
    }
  }
}

async function extractSprites(selectedEntries, atlasMetadataBySeason) {
  const manifest = {
    seasons: Object.keys(SEASON_ATLASES),
    sourceAtlasJson: toPosixRelativePath(await resolveAtlasJsonPath()),
    sourceAtlases: Object.fromEntries(
      Object.entries(atlasMetadataBySeason).map(([season, metadata]) => [
        season,
        toPosixRelativePath(metadata.atlasPath),
      ])
    ),
    categories: {
      terrain: [],
      trees: [],
      rocks: [],
    },
    sprites: {},
  };

  for (const item of selectedEntries) {
    const { entry, category, exportedName } = item;
    const paths = {};

    for (const [season, metadata] of Object.entries(atlasMetadataBySeason)) {
      const outputPath = path.join(OUTPUT_DIR, season, category, `${exportedName}.png`);

      await sharp(metadata.atlasPath)
        .extract({
          left: entry.x,
          top: entry.y,
          width: entry.width,
          height: entry.height,
        })
        .png()
        .toFile(outputPath);

      paths[season] = toPosixRelativePath(outputPath);
    }

    manifest.categories[category].push(exportedName);
    manifest.sprites[exportedName] = {
      name: exportedName,
      originalName: entry.name,
      category,
      family: entry.family || null,
      group: entry.group || null,
      description: entry.description || null,
      width: entry.width,
      height: entry.height,
      tileW: entry.tileW || null,
      tileH: entry.tileH || null,
      tags: entry.tags || [],
      collision: entry.collision || null,
      spawn: entry.spawn || null,
      render: entry.render || null,
      v1: entry.v1 || null,
      sourceRect: {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height,
      },
      paths,
    };
  }

  for (const category of CATEGORY_NAMES) {
    manifest.categories[category].sort(naturalCompare);
  }

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

async function validateManifest(manifest) {
  for (const [spriteName, sprite] of Object.entries(manifest.sprites)) {
    for (const season of manifest.seasons) {
      const relativePath = sprite.paths?.[season];
      if (!relativePath) {
        throw new Error(`Manifest entry "${spriteName}" is missing the ${season} path`);
      }

      const absolutePath = path.join(ROOT_DIR, relativePath);
      try {
        await fs.access(absolutePath);
      } catch (error) {
        throw new Error(`Manifest path missing on disk for "${spriteName}": ${relativePath}`);
      }
    }
  }
}

async function main() {
  const atlasJsonPath = await resolveAtlasJsonPath();
  const atlasData = JSON.parse(await fs.readFile(atlasJsonPath, "utf8"));
  const atlasMetadataBySeason = await loadAtlasMetadata();
  const skippedCounts = {};
  const selectedEntries = [];

  for (const entry of flattenAtlasEntries(atlasData)) {
    const classification = classifyEntry(entry, skippedCounts);
    if (!classification) continue;

    selectedEntries.push({
      entry,
      category: classification.category,
      stem: classification.stem || null,
      exportedName: classification.exportedName || null,
    });
  }

  const byCategory = assignExportNames(selectedEntries);
  assertUniqueFilenames(byCategory);
  validateSelectionBounds(selectedEntries, atlasMetadataBySeason);

  await resetOutputDirectories();
  const manifest = await extractSprites(selectedEntries, atlasMetadataBySeason);
  await validateManifest(manifest);

  const summary = {
    atlasJson: toPosixRelativePath(atlasJsonPath),
    exported: Object.fromEntries(
      CATEGORY_NAMES.map((category) => [category, manifest.categories[category].length])
    ),
    skipped: Object.fromEntries(
      Object.entries(skippedCounts).sort((a, b) => naturalCompare(a[0], b[0]))
    ),
    totalExported: Object.keys(manifest.sprites).length,
    manifest: toPosixRelativePath(MANIFEST_PATH),
  };

  console.log("World sprite extraction complete.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`World sprite extraction failed: ${error.message}`);
  process.exitCode = 1;
});

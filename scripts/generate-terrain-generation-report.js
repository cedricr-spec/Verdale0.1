#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { pathToFileURL } = require("url");
const sharp = require("sharp");

const ROOT_DIR = process.cwd();
const TEMPLATE_PATH = path.join(
  ROOT_DIR,
  "src",
  "spritesheets",
  "world",
  "autotile-templates-clean.json"
);
const SPRING_ATLAS_PATH = path.join(
  ROOT_DIR,
  "src",
  "spritesheets",
  "atlas",
  "All tiles Spring.png"
);
const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "debug",
  "terrain-generation-report.txt"
);

const SAMPLE_BOUNDS = {
  minX: -96,
  maxX: 95,
  minY: -96,
  maxY: 95,
};
const REPEAT_DISTANCE_TILES = 72;
const CATEGORY_KEYS = [
  "full",
  "edges",
  "outer_corners",
  "inner_corners",
  "corridors",
  "sides",
  "isolated",
  "complex",
];

let normalizeAutotileTemplatesData;
let resolveTerrainAutotileCore;
let terrainCore;

function getRuntimeTemplateIdsForTerrain(terrainType) {
  if (terrainType === terrainCore.TERRAIN_TYPES.GRASS_DARK) {
    return ["grass_dark_on_grass_light"];
  }

  if (terrainType === terrainCore.TERRAIN_TYPES.WATER) {
    return ["water_on_grass_light"];
  }

  if (terrainType === terrainCore.TERRAIN_TYPES.SAND) {
    return ["sand_on_grass_light"];
  }

  if (terrainType === terrainCore.TERRAIN_TYPES.ROAD) {
    return ["road_on_grass_light"];
  }

  return [];
}

function sampleTerrainGrid(sampler, bounds) {
  const grid = [];
  const terrainCounts = {
    [terrainCore.TERRAIN_TYPES.GRASS_LIGHT]: 0,
    [terrainCore.TERRAIN_TYPES.GRASS_DARK]: 0,
    [terrainCore.TERRAIN_TYPES.WATER]: 0,
    [terrainCore.TERRAIN_TYPES.SAND]: 0,
    [terrainCore.TERRAIN_TYPES.ROAD]: 0,
  };

  for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
    const row = [];

    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
      const terrainType = sampler.getTerrainType(gridX, gridY);
      row.push(terrainType);
      terrainCounts[terrainType] += 1;
    }

    grid.push(row);
  }

  return {
    grid,
    terrainCounts,
  };
}

function getTerrainFromGrid(grid, bounds, gridX, gridY) {
  const localX = gridX - bounds.minX;
  const localY = gridY - bounds.minY;

  return grid[localY]?.[localX] || terrainCore.TERRAIN_TYPES.GRASS_LIGHT;
}

function resolveRuntimeTerrain(normalizedData, grid, bounds, gridX, gridY) {
  const centerTerrain = getTerrainFromGrid(grid, bounds, gridX, gridY);
  const candidateTemplates = getRuntimeTemplateIdsForTerrain(centerTerrain)
    .map((templateId) => normalizedData.templates[templateId])
    .filter(Boolean);
  const fallbackPattern = normalizedData.terrainFallbackPatterns[centerTerrain] || null;

  if (!candidateTemplates.length) {
    return {
      terrainType: centerTerrain,
      templateId: null,
      patternId: fallbackPattern?.id || "fallback",
      category: fallbackPattern?.category || "full",
      usedFallback: false,
    };
  }

  return resolveTerrainAutotileCore({
    getTerrainAt: (x, y) => getTerrainFromGrid(grid, bounds, x, y),
    gridX,
    gridY,
    candidateTemplates,
    fallbackPattern,
  });
}

function sampleAutotileCounts(normalizedData, grid, bounds) {
  const categoryCounts = Object.fromEntries(CATEGORY_KEYS.map((key) => [key, 0]));
  let fallbackCount = 0;

  for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY += 1) {
    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX += 1) {
      const resolved = resolveRuntimeTerrain(normalizedData, grid, bounds, gridX, gridY);
      categoryCounts[resolved.category] = (categoryCounts[resolved.category] || 0) + 1;
      if (resolved.usedFallback) {
        fallbackCount += 1;
      }
    }
  }

  return {
    categoryCounts,
    fallbackCount,
  };
}

function getComponentSignature(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));

  return cells
    .map(([x, y]) => `${x - minX}:${y - minY}`)
    .sort()
    .join(";");
}

function distanceBetween(a, b) {
  return Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
}

function findComponents(grid, bounds, terrainType) {
  const visited = new Set();
  const components = [];
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;

  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      const worldX = bounds.minX + localX;
      const worldY = bounds.minY + localY;
      const key = `${worldX},${worldY}`;

      if (visited.has(key) || grid[localY][localX] !== terrainType) {
        continue;
      }

      const queue = [[worldX, worldY]];
      const cells = [];
      let sumX = 0;
      let sumY = 0;
      visited.add(key);

      while (queue.length) {
        const [cellX, cellY] = queue.shift();
        cells.push([cellX, cellY]);
        sumX += cellX;
        sumY += cellY;

        [
          [cellX - 1, cellY],
          [cellX + 1, cellY],
          [cellX, cellY - 1],
          [cellX, cellY + 1],
        ].forEach(([nextX, nextY]) => {
          if (
            nextX < bounds.minX ||
            nextX > bounds.maxX ||
            nextY < bounds.minY ||
            nextY > bounds.maxY
          ) {
            return;
          }

          const nextKey = `${nextX},${nextY}`;
          if (visited.has(nextKey)) {
            return;
          }

          if (getTerrainFromGrid(grid, bounds, nextX, nextY) !== terrainType) {
            return;
          }

          visited.add(nextKey);
          queue.push([nextX, nextY]);
        });
      }

      components.push({
        size: cells.length,
        centerX: sumX / cells.length,
        centerY: sumY / cells.length,
        signature: getComponentSignature(cells),
      });
    }
  }

  return components;
}

function summarizeRepeatedShapes(components) {
  const signatureGroups = new Map();
  let repeatedNearbyPairs = 0;

  components.forEach((component) => {
    if (!signatureGroups.has(component.signature)) {
      signatureGroups.set(component.signature, []);
    }

    signatureGroups.get(component.signature).push(component);
  });

  signatureGroups.forEach((group) => {
    if (group.length < 2) return;

    for (let index = 0; index < group.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < group.length; otherIndex += 1) {
        if (distanceBetween(group[index], group[otherIndex]) <= REPEAT_DISTANCE_TILES) {
          repeatedNearbyPairs += 1;
        }
      }
    }
  });

  return {
    repeatedNearbyPairs,
    repeatedSignatureGroupCount: [...signatureGroups.values()].filter(
      (group) => group.length > 1
    ).length,
  };
}

async function getTileLuminance(template) {
  const atlas = template.patterns.full.tile.atlas;
  const { data } = await sharp(SPRING_ATLAS_PATH)
    .extract({
      left: atlas.x,
      top: atlas.y,
      width: atlas.width,
      height: atlas.height,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let totalRed = 0;
  let totalGreen = 0;
  let totalBlue = 0;

  for (let index = 0; index < data.length; index += 4) {
    totalRed += data[index];
    totalGreen += data[index + 1];
    totalBlue += data[index + 2];
  }

  const pixelCount = data.length / 4;
  const averageRed = totalRed / pixelCount;
  const averageGreen = totalGreen / pixelCount;
  const averageBlue = totalBlue / pixelCount;

  return Math.round(
    0.2126 * averageRed + 0.7152 * averageGreen + 0.0722 * averageBlue
  );
}

function formatCountMap(counts) {
  return Object.entries(counts)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

async function main() {
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  ({
    normalizeAutotileTemplatesData,
    resolveTerrainAutotileCore,
  } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "tamagotchi", "utils", "autotileRuntimeCore.js")
    ).href
  ));
  terrainCore = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "tamagotchi", "utils", "worldTerrainGeneratorCore.js")
    ).href
  );

  const rawTemplates = JSON.parse(await fs.readFile(TEMPLATE_PATH, "utf8"));
  const normalizedData = normalizeAutotileTemplatesData(rawTemplates);
  const sampler = terrainCore.createTerrainSampler(terrainCore.WORLD_TERRAIN_SEED);
  const { grid, terrainCounts } = sampleTerrainGrid(sampler, SAMPLE_BOUNDS);
  const autotileCounts = sampleAutotileCounts(normalizedData, grid, SAMPLE_BOUNDS);
  const waterComponents = findComponents(grid, SAMPLE_BOUNDS, terrainCore.TERRAIN_TYPES.WATER);
  const darkComponents = findComponents(grid, SAMPLE_BOUNDS, terrainCore.TERRAIN_TYPES.GRASS_DARK);
  const sandComponents = findComponents(grid, SAMPLE_BOUNDS, terrainCore.TERRAIN_TYPES.SAND);
  const roadComponents = findComponents(grid, SAMPLE_BOUNDS, terrainCore.TERRAIN_TYPES.ROAD);
  const waterRepeatSummary = summarizeRepeatedShapes(waterComponents);
  const darkRepeatSummary = summarizeRepeatedShapes(darkComponents);
  const sandRepeatSummary = summarizeRepeatedShapes(sandComponents);
  const roadRepeatSummary = summarizeRepeatedShapes(roadComponents);
  const waterAverageSize = waterComponents.length
    ? (waterComponents.reduce((total, component) => total + component.size, 0) /
        waterComponents.length).toFixed(2)
    : "0.00";
  const darkAverageSize = darkComponents.length
    ? (darkComponents.reduce((total, component) => total + component.size, 0) /
        darkComponents.length).toFixed(2)
    : "0.00";
  const sandAverageSize = sandComponents.length
    ? (sandComponents.reduce((total, component) => total + component.size, 0) /
        sandComponents.length).toFixed(2)
    : "0.00";
  const roadAverageSize = roadComponents.length
    ? (roadComponents.reduce((total, component) => total + component.size, 0) /
        roadComponents.length).toFixed(2)
    : "0.00";
  const lightTemplate = rawTemplates.templates.grass_light_on_grass_dark;
  const darkTemplate = rawTemplates.templates.grass_dark_on_grass_light;
  const lightLuminance = await getTileLuminance(lightTemplate);
  const darkLuminance = await getTileLuminance(darkTemplate);

  const report = [
    "Terrain Generation Report",
    "",
    `Sample bounds: x ${SAMPLE_BOUNDS.minX}..${SAMPLE_BOUNDS.maxX}, y ${SAMPLE_BOUNDS.minY}..${SAMPLE_BOUNDS.maxY}`,
    "",
    "Terrain counts around origin:",
    formatCountMap(terrainCounts),
    "",
    "Visual label mapping:",
    `- logical grass_light resolves through the grass_light_on_grass_dark full tile fallback (luminance ${lightLuminance})`,
    `- logical grass_dark resolves through grass_dark_on_grass_light full tile (luminance ${darkLuminance})`,
    "- higher full-tile luminance means the dominant logical base now maps to the lighter-looking grass art",
    "",
    "Water patch estimate:",
    `- connected water patch count: ${waterComponents.length}`,
    `- average water patch size (cells): ${waterAverageSize}`,
    `- repeated nearby water motifs detected: ${
      waterRepeatSummary.repeatedNearbyPairs > 0 ? "yes" : "no"
    }`,
    `- repeated nearby water pairs: ${waterRepeatSummary.repeatedNearbyPairs}`,
    "",
    "Grass patch estimate:",
    `- connected dark-grass patch count: ${darkComponents.length}`,
    `- average dark-grass patch size (cells): ${darkAverageSize}`,
    `- repeated nearby dark-grass motifs detected: ${
      darkRepeatSummary.repeatedNearbyPairs > 0 ? "yes" : "no"
    }`,
    `- repeated nearby dark-grass pairs: ${darkRepeatSummary.repeatedNearbyPairs}`,
    "",
    "Sand patch estimate:",
    `- connected sand patch count: ${sandComponents.length}`,
    `- average sand patch size (cells): ${sandAverageSize}`,
    `- repeated nearby sand motifs detected: ${
      sandRepeatSummary.repeatedNearbyPairs > 0 ? "yes" : "no"
    }`,
    `- repeated nearby sand pairs: ${sandRepeatSummary.repeatedNearbyPairs}`,
    "",
    "Road patch estimate:",
    `- connected road patch count: ${roadComponents.length}`,
    `- average road patch size (cells): ${roadAverageSize}`,
    `- repeated nearby road motifs detected: ${
      roadRepeatSummary.repeatedNearbyPairs > 0 ? "yes" : "no"
    }`,
    `- repeated nearby road pairs: ${roadRepeatSummary.repeatedNearbyPairs}`,
    "",
    "Autotile runtime sample:",
    `- fallback count: ${autotileCounts.fallbackCount}`,
    "Category counts:",
    formatCountMap(autotileCounts.categoryCounts),
    "",
  ].join("\n");

  await fs.writeFile(OUTPUT_PATH, `${report}\n`, "utf8");
  process.stdout.write(`${report}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

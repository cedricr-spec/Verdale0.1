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
const OUTPUT_DIR = path.join(ROOT_DIR, "debug");
const REPORT_PATH = path.join(OUTPUT_DIR, "runtime-autotile-debug-report.txt");

let normalizeAutotileTemplatesData;
let resolveTerrainAutotileCore;
let terrainCore;

const TILE_SIZE = 16;
const TILE_SCALE = 4;
const SCALED_TILE_SIZE = TILE_SIZE * TILE_SCALE;
const CARD_PADDING = 12;
const CARD_GAP = 18;
const LABEL_HEIGHT = 28;
const CARD_COLUMNS = 2;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createScenario(title, width, height, predicate) {
  return { title, width, height, predicate };
}

function createScenarios() {
  return [
    createScenario("isolated single tile", 5, 5, (x, y) => x === 2 && y === 2),
    createScenario("3x3 patch", 5, 5, (x, y) => x >= 1 && x <= 3 && y >= 1 && y <= 3),
    createScenario("5x5 rectangle", 7, 7, (x, y) => x >= 1 && x <= 5 && y >= 1 && y <= 5),
    createScenario(
      "L-shape",
      6,
      6,
      (x, y) =>
        ((x >= 1 && x <= 4 && y >= 1 && y <= 2) ||
          (x >= 1 && x <= 2 && y >= 1 && y <= 4))
    ),
    createScenario(
      "ring / inner-corner case",
      7,
      7,
      (x, y) =>
        x >= 1 &&
        x <= 5 &&
        y >= 1 &&
        y <= 5 &&
        !(x >= 2 && x <= 4 && y >= 2 && y <= 4)
    ),
  ];
}

function createTokenGrid(scenario, patchToken, backgroundToken) {
  return Array.from({ length: scenario.height }, (_, y) =>
    Array.from({ length: scenario.width }, (_, x) =>
      scenario.predicate(x, y) ? patchToken : backgroundToken
    )
  );
}

function createTerrainGrid(template, tokenGrid) {
  return tokenGrid.map((row) =>
    row.map((token) => (token === "A" ? template.terrainA : template.terrainB))
  );
}

function createLiteralTerrainGrid(template, literalRows) {
  return literalRows.map((row) =>
    row.map((token) => (token === "A" ? template.terrainA : template.terrainB))
  );
}

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

function getCandidateTemplatesForTerrain(normalizedData, terrainType) {
  const templateIds = normalizedData.templateIdsByCenterTerrain[terrainType] || [];
  return templateIds
    .map((templateId) => normalizedData.templates[templateId])
    .filter(Boolean);
}

function resolveCell(normalizedData, terrainGrid, x, y, options = {}) {
  const getTerrainAt = (gridX, gridY) =>
    terrainGrid[gridY]?.[gridX] || terrainGrid[0]?.[0] || terrainCore.TERRAIN_TYPES.GRASS_LIGHT;
  const centerTerrain = getTerrainAt(x, y);
  const candidateTemplates = Object.prototype.hasOwnProperty.call(
    options,
    "candidateTemplateIds"
  )
    ? (options.candidateTemplateIds || [])
        .map((templateId) => normalizedData.templates[templateId])
        .filter(Boolean)
    : getCandidateTemplatesForTerrain(normalizedData, centerTerrain);
  const fallbackPattern = normalizedData.terrainFallbackPatterns[centerTerrain] || null;

  if (!candidateTemplates.length) {
    return {
      terrainType: centerTerrain,
      templateId: null,
      centerTerrain,
      centerToken: null,
      backgroundToken: null,
      backgroundTerrain: null,
      sampledTerrains: null,
      rawMask: null,
      mask: null,
      maskSignature: null,
      pattern: fallbackPattern,
      patternId: fallbackPattern?.id || "fallback",
      category: fallbackPattern?.category || "full",
      unsupportedNeighborCount: 0,
      usedFallback: false,
    };
  }

  return resolveTerrainAutotileCore({
    getTerrainAt,
    gridX: x,
    gridY: y,
    candidateTemplates,
    fallbackPattern,
  });
}

function createCardOverlaySvg(title, width, height, footerLines = []) {
  const footerHeight = Math.max(0, footerLines.length * 16);
  const safeTitle = escapeXml(title);

  return `
    <svg width="${width}" height="${height + LABEL_HEIGHT + footerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height + LABEL_HEIGHT + footerHeight}" rx="10" ry="10" fill="#ffffff" stroke="#d8d8d8"/>
      <text x="12" y="20" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#141414">${safeTitle}</text>
      <rect x="12" y="${LABEL_HEIGHT}" width="${width - CARD_PADDING * 2}" height="${height}" fill="#f5f5f5" stroke="#d3d3d3"/>
      ${footerLines
        .map(
          (line, index) =>
            `<text x="12" y="${LABEL_HEIGHT + height + 16 + index * 16}" font-family="monospace" font-size="11" fill="#666666">${escapeXml(
              line
            )}</text>`
        )
        .join("")}
    </svg>
  `;
}

async function extractScaledTile(atlasBuffer, atlas) {
  return sharp(atlasBuffer)
    .extract({
      left: atlas.x,
      top: atlas.y,
      width: atlas.width,
      height: atlas.height,
    })
    .resize(SCALED_TILE_SIZE, SCALED_TILE_SIZE, { kernel: "nearest" })
    .png()
    .toBuffer();
}

async function renderScenarioCard(normalizedData, template, scenario, atlasBuffer) {
  const tokenGrid = createTokenGrid(scenario, template.centerToken, template.backgroundToken);
  const terrainGrid = createTerrainGrid(template, tokenGrid);
  const bodyWidth = scenario.width * SCALED_TILE_SIZE;
  const bodyHeight = scenario.height * SCALED_TILE_SIZE;
  const cardWidth = bodyWidth + CARD_PADDING * 2;
  const cardHeight = bodyHeight + CARD_PADDING * 2;
  const categoryCounts = {};
  const composites = [
    {
      input: Buffer.from(
        createCardOverlaySvg(
          scenario.title,
          cardWidth,
          bodyHeight,
          [
            `center=${template.centerToken} background=${template.backgroundToken}`,
            `terrainA=${template.terrainA} terrainB=${template.terrainB}`,
          ]
        )
      ),
      left: 0,
      top: 0,
    },
  ];

  for (let y = 0; y < scenario.height; y += 1) {
    for (let x = 0; x < scenario.width; x += 1) {
      const centerToken = tokenGrid[y][x];
      const resolved = resolveCell(normalizedData, terrainGrid, x, y, {
        candidateTemplateIds:
          centerToken === template.centerToken ? [template.id] : [],
      });
      const atlas = resolved?.pattern?.tile?.atlas;
      if (!atlas) continue;

      categoryCounts[resolved.category] = (categoryCounts[resolved.category] || 0) + 1;

      composites.push({
        input: await extractScaledTile(atlasBuffer, atlas),
        left: CARD_PADDING + x * SCALED_TILE_SIZE,
        top: LABEL_HEIGHT + y * SCALED_TILE_SIZE,
      });
    }
  }

  const cardBuffer = await sharp({
    create: {
      width: cardWidth,
      height: cardHeight + LABEL_HEIGHT + 32,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return {
    cardBuffer,
    width: cardWidth,
    height: cardHeight + LABEL_HEIGHT + 32,
    categoryCounts,
  };
}

async function renderTemplateSheet(normalizedData, templateId, atlasBuffer) {
  const template = normalizedData.templates[templateId];
  const scenarios = createScenarios();
  const renderedCards = [];
  const scenarioCounts = {};

  for (const scenario of scenarios) {
    const renderedCard = await renderScenarioCard(
      normalizedData,
      template,
      scenario,
      atlasBuffer
    );
    renderedCards.push(renderedCard);
    scenarioCounts[scenario.title] = renderedCard.categoryCounts;
  }

  const rows = Math.ceil(renderedCards.length / CARD_COLUMNS);
  const sheetWidth =
    Math.max(...renderedCards.map((card) => card.width)) * CARD_COLUMNS +
    CARD_GAP * (CARD_COLUMNS + 1);
  const cardHeight = Math.max(...renderedCards.map((card) => card.height));
  const sheetHeight = rows * cardHeight + CARD_GAP * (rows + 1);
  const sheet = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: "#f1f1f1",
    },
  });
  const composites = renderedCards.map((card, index) => {
    const column = index % CARD_COLUMNS;
    const row = Math.floor(index / CARD_COLUMNS);

    return {
      input: card.cardBuffer,
      left: CARD_GAP + column * (Math.max(...renderedCards.map((entry) => entry.width)) + CARD_GAP),
      top: CARD_GAP + row * (cardHeight + CARD_GAP),
    };
  });
  const outputPath = path.join(
    OUTPUT_DIR,
    `runtime-autotile-testpatch-${templateId}.png`
  );

  await sheet.composite(composites).png().toFile(outputPath);

  return {
    outputPath,
    scenarioCounts,
  };
}

function createCountBucket() {
  return {
    totalResolved: 0,
    fallbackCount: 0,
    byCategory: {
      full: 0,
      edges: 0,
      outer_corners: 0,
      inner_corners: 0,
      corridors: 0,
      sides: 0,
      isolated: 0,
      complex: 0,
    },
    byTemplate: {},
  };
}

function getTemplateBucket(bucket, templateId) {
  if (!bucket.byTemplate[templateId]) {
    bucket.byTemplate[templateId] = createCountBucket();
  }

  return bucket.byTemplate[templateId];
}

function recordResolvedTile(bucket, resolved) {
  const category = resolved.category || "full";
  const templateId = resolved.templateId || "fallback";
  const templateBucket = getTemplateBucket(bucket, templateId);

  bucket.totalResolved += 1;
  templateBucket.totalResolved += 1;
  bucket.byCategory[category] = (bucket.byCategory[category] || 0) + 1;
  templateBucket.byCategory[category] = (templateBucket.byCategory[category] || 0) + 1;

  if (resolved.usedFallback) {
    bucket.fallbackCount += 1;
    templateBucket.fallbackCount += 1;
  }
}

function sampleRuntimeCounts(normalizedData) {
  const sampler = terrainCore.createTerrainSampler(terrainCore.WORLD_TERRAIN_SEED);
  const counts = createCountBucket();
  const sampleBounds = {
    minX: -48,
    maxX: 47,
    minY: -48,
    maxY: 47,
  };
  const terrainGrid = [];

  for (let gridY = sampleBounds.minY; gridY <= sampleBounds.maxY; gridY += 1) {
    const row = [];
    for (let gridX = sampleBounds.minX; gridX <= sampleBounds.maxX; gridX += 1) {
      row.push(sampler.getTerrainType(gridX, gridY));
    }
    terrainGrid.push(row);
  }

  function resolveSampleCell(gridX, gridY) {
    const localX = gridX - sampleBounds.minX;
    const localY = gridY - sampleBounds.minY;
    const centerTerrain = terrainGrid[localY][localX];

    return resolveCell(normalizedData, terrainGrid, localX, localY, {
      candidateTemplateIds: getRuntimeTemplateIdsForTerrain(centerTerrain),
    });
  }

  for (let gridY = sampleBounds.minY; gridY <= sampleBounds.maxY; gridY += 1) {
    for (let gridX = sampleBounds.minX; gridX <= sampleBounds.maxX; gridX += 1) {
      const resolved = resolveSampleCell(gridX, gridY);

      recordResolvedTile(counts, resolved);
    }
  }

  return {
    sampleBounds,
    counts,
  };
}

function formatMask(mask) {
  return JSON.stringify(mask);
}

function assertResolvedPattern({
  templateId,
  gridX,
  gridY,
  expectedPatternId,
  expectedCategory,
  resolved,
}) {
  const matchesPattern = expectedPatternId ? resolved.patternId === expectedPatternId : true;
  const matchesCategory = expectedCategory ? resolved.category === expectedCategory : true;

  if (matchesPattern && matchesCategory) {
    return;
  }

  throw new Error(
    [
      `Runtime autotile validation failed for ${templateId} at (${gridX}, ${gridY})`,
      `expected pattern=${expectedPatternId || "<any>"} category=${expectedCategory || "<any>"}`,
      `received pattern=${resolved.patternId} category=${resolved.category}`,
      `rawMask=${formatMask(resolved.rawMask)}`,
      `canonicalMask=${formatMask(resolved.mask)}`,
      `sampledTerrains=${formatMask(resolved.sampledTerrains)}`,
    ].join(" | ")
  );
}

function runIsolatedCaseValidation(normalizedData) {
  const waterTemplate = normalizedData.templates.water_on_grass_light;
  const standardIsolatedGrid = createLiteralTerrainGrid(waterTemplate, [
    ["A", "A", "A"],
    ["A", "B", "A"],
    ["A", "A", "A"],
  ]);
  const centerResolved = resolveCell(normalizedData, standardIsolatedGrid, 1, 1);

  assertResolvedPattern({
    templateId: "water_on_grass_light",
    gridX: 1,
    gridY: 1,
    expectedPatternId: "isolated",
    expectedCategory: "isolated",
    resolved: centerResolved,
  });

  for (let gridY = 0; gridY < 3; gridY += 1) {
    for (let gridX = 0; gridX < 3; gridX += 1) {
      if (gridX === 1 && gridY === 1) continue;
      const resolved = resolveCell(normalizedData, standardIsolatedGrid, gridX, gridY, {
        candidateTemplateIds: [],
      });

      if (resolved.category !== "full") {
        throw new Error(
          [
            `Runtime autotile isolated-grid validation failed for water_on_grass_light at (${gridX}, ${gridY})`,
            `expected surrounding tile category=full`,
            `received pattern=${resolved.patternId} category=${resolved.category}`,
            `rawMask=${formatMask(resolved.rawMask)}`,
            `canonicalMask=${formatMask(resolved.mask)}`,
            `sampledTerrains=${formatMask(resolved.sampledTerrains)}`,
          ].join(" | ")
        );
      }
    }
  }

  Object.entries(normalizedData.templates).forEach(([templateId, template]) => {
    const patchToken = template.centerToken;
    const backgroundToken = patchToken === "B" ? "A" : "B";
    const grid = createTerrainGrid(
      template,
      [
        [backgroundToken, backgroundToken, backgroundToken],
        [backgroundToken, patchToken, backgroundToken],
        [backgroundToken, backgroundToken, backgroundToken],
      ].map((row) => [...row])
    );
    const resolved = resolveCell(normalizedData, grid, 1, 1, {
      candidateTemplateIds: [templateId],
    });

    assertResolvedPattern({
      templateId,
      gridX: 1,
      gridY: 1,
      expectedPatternId: "isolated",
      expectedCategory: "isolated",
      resolved,
    });
  });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

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
  const atlasBuffer = await fs.readFile(SPRING_ATLAS_PATH);
  runIsolatedCaseValidation(normalizedData);
  const templateOutputs = [];

  for (const templateId of Object.keys(normalizedData.templates)) {
    templateOutputs.push(await renderTemplateSheet(normalizedData, templateId, atlasBuffer));
  }

  const sampled = sampleRuntimeCounts(normalizedData);
  const lines = [
    "Runtime autotile debug report",
    "",
    `Template source: ${TEMPLATE_PATH}`,
    `Spring atlas: ${SPRING_ATLAS_PATH}`,
    "",
    `Sampled terrain window: x ${sampled.sampleBounds.minX}..${sampled.sampleBounds.maxX}, y ${sampled.sampleBounds.minY}..${sampled.sampleBounds.maxY}`,
    `Total resolved cells: ${sampled.counts.totalResolved}`,
    `Fallback count: ${sampled.counts.fallbackCount}`,
    "",
    "Category counts:",
    ...Object.entries(sampled.counts.byCategory).map(
      ([category, count]) => `- ${category}: ${count}`
    ),
    "",
    "Per-template counts:",
    ...Object.entries(sampled.counts.byTemplate).flatMap(([templateId, bucket]) => [
      `- ${templateId}: total=${bucket.totalResolved}, fallbacks=${bucket.fallbackCount}, outer_corners=${bucket.byCategory.outer_corners || 0}`,
      ...Object.entries(bucket.byCategory).map(
        ([category, count]) => `  ${category}: ${count}`
      ),
    ]),
    "",
    "Generated images:",
    ...templateOutputs.map(({ outputPath }) => `- ${outputPath}`),
  ];

  await fs.writeFile(REPORT_PATH, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`${lines.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

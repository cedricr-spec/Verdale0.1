#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
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
const REPORT_PATH = path.join(OUTPUT_DIR, "autotile-visual-audit-report.txt");

const NEIGHBOR_KEYS = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
];

const CATEGORY_ORDER = [
  "full",
  "isolated",
  "sides",
  "corridors",
  "outer_corners",
  "edges",
  "inner_corners",
  "complex",
];

const CARD_WIDTH = 320;
const CARD_HEIGHT = 190;
const CARD_COLUMNS = 5;
const CARD_MARGIN = 16;
const PREVIEW_SCALE = 6;
const TILE_SIZE = 16;
const TEST_TILE_SCALE = 3;
const TEST_TILE_SIZE = TILE_SIZE * TEST_TILE_SCALE;

const TEMPLATE_PREVIEW_COLORS = {
  grass_dark: { fill: "#315c2b", label: "#eff7eb" },
  grass_light: { fill: "#88bc59", label: "#18320b" },
  water: { fill: "#3b7fc4", label: "#eef8ff" },
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getSignature(mask) {
  return NEIGHBOR_KEYS.map((key) => `${key}=${mask[key]}`).join("|");
}

function classifyMask(mask) {
  const top = mask.top === "B";
  const right = mask.right === "B";
  const bottom = mask.bottom === "B";
  const left = mask.left === "B";
  const cardinalCount = [top, right, bottom, left].filter(Boolean).length;

  if (cardinalCount === 0) return "isolated";
  if (cardinalCount === 1) return "sides";

  if (cardinalCount === 2) {
    if (left && right) return "corridors";
    if (top && bottom) return "corridors";
    return "outer_corners";
  }

  if (cardinalCount === 3) return "edges";

  const diagonalCount = ["topLeft", "topRight", "bottomLeft", "bottomRight"].filter(
    (key) => mask[key] === "B"
  ).length;

  if (diagonalCount === 4) return "full";
  if (diagonalCount === 3) return "inner_corners";
  return "complex";
}

function getOrientationFromMask(mask, category) {
  const top = mask.top === "B";
  const right = mask.right === "B";
  const bottom = mask.bottom === "B";
  const left = mask.left === "B";

  if (category === "sides") {
    if (top) return "top";
    if (right) return "right";
    if (bottom) return "bottom";
    if (left) return "left";
  }

  if (category === "corridors") {
    if (left && right) return "horizontal";
    if (top && bottom) return "vertical";
  }

  if (category === "outer_corners") {
    if (top && left) return "top_left";
    if (top && right) return "top_right";
    if (bottom && left) return "bottom_left";
    if (bottom && right) return "bottom_right";
  }

  if (category === "edges") {
    if (!top) return "top";
    if (!right) return "right";
    if (!bottom) return "bottom";
    if (!left) return "left";
  }

  if (category === "inner_corners") {
    if (mask.topLeft === "A") return "top_left";
    if (mask.topRight === "A") return "top_right";
    if (mask.bottomLeft === "A") return "bottom_left";
    if (mask.bottomRight === "A") return "bottom_right";
  }

  return null;
}

function expectedOrientationFromId(patternId) {
  if (patternId.startsWith("inner_corner_")) return patternId.replace("inner_corner_", "");
  if (patternId.startsWith("edge_")) return patternId.replace(/^edge_/, "").replace(/_\d+$/, "");
  if (patternId.startsWith("outer_corner_")) {
    return patternId.replace(/^outer_corner_/, "").replace(/_\d+$/, "");
  }
  if (patternId.startsWith("side_")) return patternId.replace("side_", "");
  if (patternId === "corridor_horizontal") return "horizontal";
  if (patternId === "corridor_vertical") return "vertical";
  return null;
}

function averageRegionColor(raw, region) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;

  for (let y = region.top; y < region.top + region.height; y += 1) {
    for (let x = region.left; x < region.left + region.width; x += 1) {
      const index = (y * TILE_SIZE + x) * 4;
      const a = raw[index + 3] / 255;
      red += raw[index] * a;
      green += raw[index + 1] * a;
      blue += raw[index + 2] * a;
      alpha += a;
    }
  }

  if (alpha <= 0) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: red / alpha,
    g: green / alpha,
    b: blue / alpha,
  };
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function classifyRegion(raw, region, refs) {
  const sample = averageRegionColor(raw, region);
  const distanceToA = colorDistance(sample, refs.aColor);
  const distanceToB = colorDistance(sample, refs.bColor);
  const token = distanceToA <= distanceToB ? "A" : "B";
  const confidence =
    Math.abs(distanceToA - distanceToB) / Math.max(1, distanceToA + distanceToB);

  return { token, confidence, sample, distanceToA, distanceToB };
}

function md5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function sortPatterns(patterns) {
  return patterns.sort((a, b) => {
    const categoryDelta =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

function createMaskPreviewSvg(mask, template, x, y, cellSize = 20) {
  const aFill = "#ece8de";
  const aText = "#4b4b4b";
  const bTheme = TEMPLATE_PREVIEW_COLORS[template.terrainB] || TEMPLATE_PREVIEW_COLORS.grass_dark;
  const layout = [
    ["topLeft", "top", "topRight"],
    ["left", "center", "right"],
    ["bottomLeft", "bottom", "bottomRight"],
  ];

  const parts = [];

  layout.forEach((row, rowIndex) => {
    row.forEach((key, columnIndex) => {
      const token = key === "center" ? "B" : mask[key];
      const fill = token === "B" ? bTheme.fill : aFill;
      const textColor = token === "B" ? bTheme.label : aText;
      const left = x + columnIndex * cellSize;
      const top = y + rowIndex * cellSize;

      parts.push(
        `<rect x="${left}" y="${top}" width="${cellSize - 2}" height="${cellSize - 2}" rx="3" ry="3" fill="${fill}" stroke="#1e1e1e" stroke-width="1" />`
      );
      parts.push(
        `<text x="${left + (cellSize - 2) / 2}" y="${top + cellSize / 2 + 4}" text-anchor="middle" font-family="monospace" font-size="11" fill="${textColor}">${token}</text>`
      );
    });
  });

  return parts.join("");
}

function createCardSvg(pattern, template) {
  const atlas = pattern.tile.atlas;
  const signature = getSignature(pattern.mask);
  const safeId = escapeXml(pattern.id);
  const safeCategory = escapeXml(pattern.category);
  const safeSignature = escapeXml(signature);

  return `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="10" ry="10" fill="#ffffff" stroke="#d0d0d0"/>
      <text x="14" y="24" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#141414">${safeId}</text>
      <text x="14" y="44" font-family="Arial, sans-serif" font-size="12" fill="#555555">${safeCategory}</text>
      <text x="14" y="60" font-family="monospace" font-size="11" fill="#666666">atlas (${atlas.x}, ${atlas.y})</text>
      <text x="14" y="74" font-family="monospace" font-size="10" fill="#808080">${safeSignature}</text>
      <rect x="14" y="86" width="${TILE_SIZE * PREVIEW_SCALE}" height="${TILE_SIZE * PREVIEW_SCALE}" fill="#f4f4f4" stroke="#c9c9c9"/>
      ${createMaskPreviewSvg(pattern.mask, template, 124, 96, 22)}
      <text x="124" y="86" font-family="Arial, sans-serif" font-size="11" fill="#666666">mask preview</text>
      <text x="210" y="104" font-family="monospace" font-size="11" fill="#666666">tile ${atlas.width}x${atlas.height}</text>
      <text x="210" y="122" font-family="monospace" font-size="11" fill="#666666">terrainA=${escapeXml(template.terrainA)}</text>
      <text x="210" y="140" font-family="monospace" font-size="11" fill="#666666">terrainB=${escapeXml(template.terrainB)}</text>
    </svg>
  `;
}

function createScenario(title, width, height, predicate) {
  return { title, width, height, predicate };
}

function createTestScenarios() {
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

async function extractTileResources(atlasBuffer, pattern) {
  const atlas = pattern.tile.atlas;
  const extractor = sharp(atlasBuffer).extract({
    left: atlas.x,
    top: atlas.y,
    width: atlas.width,
    height: atlas.height,
  });

  const previewBuffer = await extractor
    .clone()
    .resize(atlas.width * PREVIEW_SCALE, atlas.height * PREVIEW_SCALE, {
      kernel: "nearest",
    })
    .png()
    .toBuffer();

  const testBuffer = await extractor
    .clone()
    .resize(atlas.width * TEST_TILE_SCALE, atlas.height * TEST_TILE_SCALE, {
      kernel: "nearest",
    })
    .png()
    .toBuffer();

  const rawBuffer = await extractor
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer();

  return {
    previewBuffer,
    testBuffer,
    rawBuffer,
    hash: md5(rawBuffer),
  };
}

function getBackgroundTemplateId(templates, terrainType) {
  return Object.keys(templates).find(
    (templateId) => templates[templateId].terrainB === terrainType
  );
}

function resolvePatternForPatch(template, cells, x, y) {
  const center = cells[y]?.[x] || "A";
  if (center !== "B") return null;

  const mask = {
    topLeft: cells[y - 1]?.[x - 1] || "A",
    top: cells[y - 1]?.[x] || "A",
    topRight: cells[y - 1]?.[x + 1] || "A",
    left: cells[y]?.[x - 1] || "A",
    center: "B",
    right: cells[y]?.[x + 1] || "A",
    bottomLeft: cells[y + 1]?.[x - 1] || "A",
    bottom: cells[y + 1]?.[x] || "A",
    bottomRight: cells[y + 1]?.[x + 1] || "A",
  };

  const signature = getSignature(mask);
  return template.patternList.find((pattern) => getSignature(pattern.mask) === signature) || null;
}

function createEmptyGrid(width, height, fill = "A") {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function buildScenarioGrid(scenario) {
  const cells = createEmptyGrid(scenario.width, scenario.height, "A");

  for (let y = 0; y < scenario.height; y += 1) {
    for (let x = 0; x < scenario.width; x += 1) {
      if (scenario.predicate(x, y)) {
        cells[y][x] = "B";
      }
    }
  }

  return cells;
}

function createScenarioCardSvg(title, width, height) {
  const canvasWidth = width * TEST_TILE_SIZE;
  const canvasHeight = height * TEST_TILE_SIZE;

  return `
    <svg width="${canvasWidth + 24}" height="${canvasHeight + 54}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${canvasWidth + 24}" height="${canvasHeight + 54}" rx="10" ry="10" fill="#ffffff" stroke="#d0d0d0"/>
      <text x="12" y="24" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#141414">${escapeXml(
        title
      )}</text>
      <rect x="12" y="34" width="${canvasWidth}" height="${canvasHeight}" fill="#f8f8f8" stroke="#d7d7d7"/>
    </svg>
  `;
}

function linesForPattern(pattern) {
  const lines = [];
  if (!pattern) return lines;

  const derivedCategory = classifyMask(pattern.mask);
  const maskOrientation = getOrientationFromMask(pattern.mask, derivedCategory);
  const idOrientation = expectedOrientationFromId(pattern.id);

  if (pattern.id === "full" && derivedCategory !== "full") {
    lines.push("full tile not actually full");
  }

  if (pattern.id === "isolated" && derivedCategory !== "isolated") {
    lines.push("isolated tile not actually isolated");
  }

  if (idOrientation && maskOrientation && idOrientation !== maskOrientation) {
    if (
      (idOrientation === "top" && maskOrientation === "bottom") ||
      (idOrientation === "bottom" && maskOrientation === "top")
    ) {
      lines.push("pattern name suggests top/bottom but mask orientation is swapped");
    } else if (
      (idOrientation === "left" && maskOrientation === "right") ||
      (idOrientation === "right" && maskOrientation === "left")
    ) {
      lines.push("pattern name suggests left/right but mask orientation is swapped");
    } else {
      lines.push("pattern id orientation does not match mask orientation");
    }
  }

  return lines;
}

function getRegionMap() {
  return {
    top: { left: 4, top: 0, width: 8, height: 4 },
    right: { left: 12, top: 4, width: 4, height: 8 },
    bottom: { left: 4, top: 12, width: 8, height: 4 },
    left: { left: 0, top: 4, width: 4, height: 8 },
    topLeft: { left: 0, top: 0, width: 4, height: 4 },
    topRight: { left: 12, top: 0, width: 4, height: 4 },
    bottomLeft: { left: 0, top: 12, width: 4, height: 4 },
    bottomRight: { left: 12, top: 12, width: 4, height: 4 },
  };
}

function analyzePatternVisual(pattern, resources, refs) {
  const regions = getRegionMap();
  const regionClassifications = {};

  for (const [key, region] of Object.entries(regions)) {
    regionClassifications[key] = classifyRegion(resources.rawBuffer, region, refs);
  }

  const expectedMask = {
    ...pattern.mask,
    center: "B",
  };

  const visualCardinals = {
    top: regionClassifications.top.token,
    right: regionClassifications.right.token,
    bottom: regionClassifications.bottom.token,
    left: regionClassifications.left.token,
  };

  const visualMask = {
    topLeft: regionClassifications.topLeft.token,
    top: visualCardinals.top,
    topRight: regionClassifications.topRight.token,
    left: visualCardinals.left,
    center: "B",
    right: visualCardinals.right,
    bottomLeft: regionClassifications.bottomLeft.token,
    bottom: visualCardinals.bottom,
    bottomRight: regionClassifications.bottomRight.token,
  };

  const visualCategory = classifyMask(visualMask);
  const expectedCategory = classifyMask(expectedMask);
  const visualOrientation = getOrientationFromMask(visualMask, visualCategory);
  const expectedOrientation = getOrientationFromMask(expectedMask, expectedCategory);
  const issues = [];

  if (
    expectedMask.top !== visualMask.top &&
    expectedMask.bottom !== visualMask.bottom &&
    visualMask.top === expectedMask.bottom &&
    visualMask.bottom === expectedMask.top
  ) {
    issues.push("pattern name suggests top but tile art looks bottom (vertical swap suspicion)");
  }

  if (
    expectedMask.left !== visualMask.left &&
    expectedMask.right !== visualMask.right &&
    visualMask.left === expectedMask.right &&
    visualMask.right === expectedMask.left
  ) {
    issues.push("left/right possibly swapped");
  }

  if (expectedCategory !== visualCategory) {
    issues.push(
      `visual side reading looks like ${visualCategory}, expected ${expectedCategory}`
    );
  }

  if (
    expectedOrientation &&
    visualOrientation &&
    expectedOrientation !== visualOrientation
  ) {
    issues.push(
      `orientation looks ${visualOrientation}, expected ${expectedOrientation}`
    );
  }

  if (pattern.id === "full") {
    const nonBRegions = Object.entries(regionClassifications)
      .filter(([, result]) => result.token !== "B")
      .map(([key]) => key);
    if (nonBRegions.length) {
      issues.push(`full tile not actually full; non-B regions: ${nonBRegions.join(", ")}`);
    }
  }

  if (pattern.id === "isolated") {
    const nonARegions = Object.entries(regionClassifications)
      .filter(([, result]) => result.token === "B")
      .map(([key]) => key);
    if (nonARegions.length > 2) {
      issues.push(
        `isolated tile looks too connected; B-like regions: ${nonARegions.join(", ")}`
      );
    }
  }

  if (expectedCategory === "outer_corners" || expectedCategory === "inner_corners") {
    const expectedCornerA = Object.entries(expectedMask)
      .filter(([key, value]) => key.includes("top") || key.includes("bottom"))
      .filter(([key, value]) => key !== "top" && key !== "right" && key !== "bottom" && key !== "left" && value === "A")
      .map(([key]) => key);
    const visualCornerA = Object.entries(visualMask)
      .filter(([key, value]) => key.includes("top") || key.includes("bottom"))
      .filter(([key, value]) => key !== "top" && key !== "right" && key !== "bottom" && key !== "left" && value === "A")
      .map(([key]) => key);
    if (expectedCornerA.join(",") !== visualCornerA.join(",")) {
      issues.push(
        `inner/outer corner visually suspicious; diagonal A positions look like ${visualCornerA.join(
          ", "
        ) || "none"}`
      );
    }
  }

  return {
    expectedMask,
    visualMask,
    expectedCategory,
    visualCategory,
    expectedOrientation,
    visualOrientation,
    issues,
    hash: resources.hash,
  };
}

async function createContactSheet(templateId, template, resourcesById) {
  const patterns = sortPatterns(template.patternList.slice());
  const rows = Math.ceil(patterns.length / CARD_COLUMNS);
  const width = CARD_MARGIN * 2 + CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_MARGIN;
  const height = CARD_MARGIN * 2 + rows * CARD_HEIGHT + (rows - 1) * CARD_MARGIN;
  const composites = [];

  patterns.forEach((pattern, index) => {
    const column = index % CARD_COLUMNS;
    const row = Math.floor(index / CARD_COLUMNS);
    const left = CARD_MARGIN + column * (CARD_WIDTH + CARD_MARGIN);
    const top = CARD_MARGIN + row * (CARD_HEIGHT + CARD_MARGIN);
    const svg = Buffer.from(createCardSvg(pattern, template));

    composites.push({
      input: svg,
      left,
      top,
    });

    composites.push({
      input: resourcesById.get(pattern.id).previewBuffer,
      left: left + 14,
      top: top + 86,
    });
  });

  const outputPath = path.join(OUTPUT_DIR, `autotile-contactsheet-${templateId}.png`);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#f3f4f6",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function createTestPatchSheet(templateId, template, templates, resourcesById) {
  const scenarios = createTestScenarios();
  const scenarioColumns = 3;
  const cardSpacing = 18;
  const backgroundTemplateId = getBackgroundTemplateId(templates, template.terrainA);
  const backgroundPattern =
    backgroundTemplateId && templates[backgroundTemplateId]
      ? templates[backgroundTemplateId].patternMap.get("full")
      : null;
  const fallbackPattern = template.patternMap.get("isolated");
  const backgroundResource =
    backgroundPattern && resourcesById.get(backgroundPattern.id)
      ? resourcesById.get(backgroundPattern.id)
      : resourcesById.get(fallbackPattern.id);

  const scenarioCards = [];
  for (const scenario of scenarios) {
    const width = scenario.width * TEST_TILE_SIZE + 24;
    const height = scenario.height * TEST_TILE_SIZE + 54;
    scenarioCards.push({ ...scenario, cardWidth: width, cardHeight: height });
  }

  const maxCardWidth = Math.max(...scenarioCards.map((item) => item.cardWidth));
  const maxCardHeight = Math.max(...scenarioCards.map((item) => item.cardHeight));
  const rows = Math.ceil(scenarioCards.length / scenarioColumns);
  const width =
    16 * 2 + scenarioColumns * maxCardWidth + (scenarioColumns - 1) * cardSpacing;
  const height =
    16 * 2 + rows * maxCardHeight + (rows - 1) * cardSpacing;

  const composites = [];

  for (let index = 0; index < scenarioCards.length; index += 1) {
    const scenario = scenarioCards[index];
    const column = index % scenarioColumns;
    const row = Math.floor(index / scenarioColumns);
    const left = 16 + column * (maxCardWidth + cardSpacing);
    const top = 16 + row * (maxCardHeight + cardSpacing);

    composites.push({
      input: Buffer.from(createScenarioCardSvg(scenario.title, scenario.width, scenario.height)),
      left,
      top,
    });

    const grid = buildScenarioGrid(scenario);
    for (let y = 0; y < scenario.height; y += 1) {
      for (let x = 0; x < scenario.width; x += 1) {
        const pattern =
          grid[y][x] === "B"
            ? resolvePatternForPatch(template, grid, x, y) || fallbackPattern
            : backgroundPattern;
        const resource =
          pattern && resourcesById.get(pattern.id)
            ? resourcesById.get(pattern.id)
            : backgroundResource;

        composites.push({
          input: resource.testBuffer,
          left: left + 12 + x * TEST_TILE_SIZE,
          top: top + 34 + y * TEST_TILE_SIZE,
        });
      }
    }
  }

  const outputPath = path.join(OUTPUT_DIR, `autotile-testpatch-${templateId}.png`);

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#eef1f5",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const templateData = JSON.parse(await fs.readFile(TEMPLATE_PATH, "utf8"));
  const atlasBuffer = await fs.readFile(SPRING_ATLAS_PATH);
  const templates = {};
  const reportLines = [];

  for (const [templateId, template] of Object.entries(templateData.templates || {})) {
    const patternList = Object.values(template.patterns || {}).map((pattern) => ({
      ...pattern,
      signature: getSignature(pattern.mask),
    }));
    const patternMap = new Map(patternList.map((pattern) => [pattern.id, pattern]));
    templates[templateId] = {
      ...template,
      patternList,
      patternMap,
    };
  }

  reportLines.push("AUTOTILE VISUAL AUDIT");
  reportLines.push(`JSON: ${path.relative(ROOT_DIR, TEMPLATE_PATH)}`);
  reportLines.push(`ATLAS: ${path.relative(ROOT_DIR, SPRING_ATLAS_PATH)}`);
  reportLines.push("");
  reportLines.push(
    "This report is heuristic. It checks whether the assigned atlas tile art visually agrees with the validated mask topology."
  );
  reportLines.push("");

  for (const [templateId, template] of Object.entries(templates)) {
    const resourcesById = new Map();
    for (const pattern of template.patternList) {
      resourcesById.set(pattern.id, await extractTileResources(atlasBuffer, pattern));
    }

    const fullPattern = template.patternMap.get("full");
    const isolatedPattern = template.patternMap.get("isolated");
    const fullResource = resourcesById.get(fullPattern.id);
    const isolatedResource = resourcesById.get(isolatedPattern.id);
    const refs = {
      bColor: averageRegionColor(fullResource.rawBuffer, {
        left: 0,
        top: 0,
        width: TILE_SIZE,
        height: TILE_SIZE,
      }),
      aColor: averageRegionColor(isolatedResource.rawBuffer, {
        left: 0,
        top: 0,
        width: TILE_SIZE,
        height: TILE_SIZE,
      }),
    };

    const exactHashGroups = new Map();
    const suspicious = [];

    for (const pattern of template.patternList) {
      const resources = resourcesById.get(pattern.id);
      const analysis = analyzePatternVisual(pattern, resources, refs);
      pattern.visualAnalysis = analysis;

      if (!exactHashGroups.has(analysis.hash)) exactHashGroups.set(analysis.hash, []);
      exactHashGroups.get(analysis.hash).push(pattern);

      suspicious.push(
        ...linesForPattern(pattern).map((message) => ({ patternId: pattern.id, message }))
      );
      suspicious.push(
        ...analysis.issues.map((message) => ({ patternId: pattern.id, message }))
      );
    }

    exactHashGroups.forEach((patterns, hash) => {
      if (patterns.length <= 1) return;

      const signatures = new Set(patterns.map((pattern) => pattern.signature));
      if (signatures.size <= 1) return;

      suspicious.push({
        patternId: patterns.map((pattern) => pattern.id).join(", "),
        message: "repeated visual type in incompatible slots (identical tile pixels)",
      });
    });

    const contactSheetPath = await createContactSheet(
      templateId,
      template,
      resourcesById
    );
    const testPatchPath = await createTestPatchSheet(
      templateId,
      template,
      templates,
      resourcesById
    );

    reportLines.push(`Template: ${templateId}`);
    reportLines.push(`  terrainA=${template.terrainA} terrainB=${template.terrainB}`);
    reportLines.push(
      `  contactsheet=${path.relative(ROOT_DIR, contactSheetPath)}`
    );
    reportLines.push(
      `  testpatch=${path.relative(ROOT_DIR, testPatchPath)}`
    );

    if (!suspicious.length) {
      reportLines.push("  suspicious assignments: none flagged by heuristics");
    } else {
      reportLines.push("  suspicious assignments:");
      suspicious.forEach((issue) => {
        reportLines.push(`    - ${issue.patternId}: ${issue.message}`);
      });
    }

    reportLines.push("");
  }

  await fs.writeFile(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT_DIR, REPORT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

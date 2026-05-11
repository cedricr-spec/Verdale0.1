#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");

const ROOT_DIR = process.cwd();
const DEFAULT_INPUT = path.join(
  ROOT_DIR,
  "src",
  "spritesheets",
  "world",
  "autotile-templates-clean.json"
);
const DEFAULT_NORMALIZED_OUTPUT = path.join(
  ROOT_DIR,
  "src",
  "spritesheets",
  "world",
  "autotile-templates-normalized.json"
);

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

const CARDINAL_KEYS = ["top", "right", "bottom", "left"];
const DIAGONAL_DEPENDENCIES = {
  topLeft: ["top", "left"],
  topRight: ["top", "right"],
  bottomLeft: ["bottom", "left"],
  bottomRight: ["bottom", "right"],
};

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    writeNormalized: false,
    normalizedOutput: DEFAULT_NORMALIZED_OUTPUT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--write-normalized") {
      args.writeNormalized = true;
      continue;
    }

    if (value === "--input" && argv[index + 1]) {
      args.input = path.resolve(ROOT_DIR, argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--normalized-output" && argv[index + 1]) {
      args.normalizedOutput = path.resolve(ROOT_DIR, argv[index + 1]);
      index += 1;
      continue;
    }
  }

  return args;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function tokenToBit(value) {
  if (value === "B") return 1;
  if (value === "A") return 0;
  return null;
}

function bitToToken(value) {
  return value ? "B" : "A";
}

function createSignature(mask) {
  return NEIGHBOR_KEYS.map((key) => `${key}=${mask[key]}`).join("|");
}

function normalizeMask(mask) {
  const normalized = {};
  for (const key of NEIGHBOR_KEYS) {
    normalized[key] = mask?.[key];
  }
  return normalized;
}

function canonicalizeMask(rawMask) {
  const canonical = normalizeMask(rawMask);

  for (const [diagonalKey, [firstCardinal, secondCardinal]] of Object.entries(
    DIAGONAL_DEPENDENCIES
  )) {
    if (
      canonical[diagonalKey] === "B" &&
      !(canonical[firstCardinal] === "B" && canonical[secondCardinal] === "B")
    ) {
      canonical[diagonalKey] = "A";
    }
  }

  return canonical;
}

function generateCanonical47Set() {
  const signatures = new Map();

  for (let value = 0; value < 256; value += 1) {
    const rawMask = {};
    NEIGHBOR_KEYS.forEach((key, bitIndex) => {
      rawMask[key] = bitToToken((value >> bitIndex) & 1);
    });

    const canonicalMask = canonicalizeMask(rawMask);
    signatures.set(createSignature(canonicalMask), canonicalMask);
  }

  return signatures;
}

function classifyMask(mask) {
  const cardinalBits = {
    top: tokenToBit(mask.top),
    right: tokenToBit(mask.right),
    bottom: tokenToBit(mask.bottom),
    left: tokenToBit(mask.left),
  };

  const cardinalCount = CARDINAL_KEYS.reduce(
    (total, key) => total + (cardinalBits[key] || 0),
    0
  );

  if (cardinalCount === 0) return "isolated";
  if (cardinalCount === 1) return "sides";

  if (cardinalCount === 2) {
    const hasHorizontal = cardinalBits.left && cardinalBits.right;
    const hasVertical = cardinalBits.top && cardinalBits.bottom;
    return hasHorizontal || hasVertical ? "corridors" : "outer_corners";
  }

  if (cardinalCount === 3) return "edges";

  const diagonalCount = ["topLeft", "topRight", "bottomLeft", "bottomRight"].reduce(
    (total, key) => total + (tokenToBit(mask[key]) || 0),
    0
  );

  if (diagonalCount === 4) return "full";
  if (diagonalCount === 3) return "inner_corners";
  return "complex";
}

function getOrientationFamily(mask) {
  const top = mask.top === "B";
  const right = mask.right === "B";
  const bottom = mask.bottom === "B";
  const left = mask.left === "B";

  const cardinalCount = [top, right, bottom, left].filter(Boolean).length;

  if (cardinalCount === 1) {
    if (top) return "top";
    if (right) return "right";
    if (bottom) return "bottom";
    return "left";
  }

  if (cardinalCount === 2) {
    if (left && right) return "horizontal";
    if (top && bottom) return "vertical";
    if (top && left) return "top_left";
    if (top && right) return "top_right";
    if (bottom && left) return "bottom_left";
    if (bottom && right) return "bottom_right";
  }

  if (cardinalCount === 3) {
    if (!top) return "top";
    if (!right) return "right";
    if (!bottom) return "bottom";
    return "left";
  }

  if (cardinalCount === 4) {
    if (mask.topLeft === "A" && mask.topRight === "B" && mask.bottomLeft === "B" && mask.bottomRight === "B") {
      return "top_left";
    }
    if (mask.topLeft === "B" && mask.topRight === "A" && mask.bottomLeft === "B" && mask.bottomRight === "B") {
      return "top_right";
    }
    if (mask.topLeft === "B" && mask.topRight === "B" && mask.bottomLeft === "A" && mask.bottomRight === "B") {
      return "bottom_left";
    }
    if (mask.topLeft === "B" && mask.topRight === "B" && mask.bottomLeft === "B" && mask.bottomRight === "A") {
      return "bottom_right";
    }
  }

  return null;
}

function expectedCategoryFromId(id) {
  if (id === "full") return "full";
  if (id === "isolated") return "isolated";
  if (id.startsWith("inner_corner_")) return "inner_corners";
  if (id.startsWith("edge_")) return "edges";
  if (id.startsWith("outer_corner_")) return "outer_corners";
  if (id.startsWith("corridor_")) return "corridors";
  if (id.startsWith("side_")) return "sides";
  if (id.startsWith("complex_core_")) return "complex";
  return null;
}

function expectedOrientationFromId(id) {
  if (id.startsWith("inner_corner_")) return id.replace("inner_corner_", "");
  if (id.startsWith("edge_")) return id.replace(/^edge_/, "").replace(/_\d+$/, "");
  if (id.startsWith("outer_corner_")) {
    return id.replace(/^outer_corner_/, "").replace(/_\d+$/, "");
  }
  if (id.startsWith("side_")) return id.replace("side_", "");
  if (id === "corridor_horizontal") return "horizontal";
  if (id === "corridor_vertical") return "vertical";
  return null;
}

function buildExpectedMaskForId(id) {
  const category = expectedCategoryFromId(id);
  if (!category) return null;

  const mask = {
    topLeft: "A",
    top: "A",
    topRight: "A",
    left: "A",
    center: "B",
    right: "A",
    bottomLeft: "A",
    bottom: "A",
    bottomRight: "A",
  };

  if (category === "full") {
    for (const key of [...NEIGHBOR_KEYS, "center"]) {
      mask[key] = "B";
    }
    return mask;
  }

  if (category === "isolated") {
    return mask;
  }

  if (category === "sides") {
    const side = expectedOrientationFromId(id);
    if (side === "top") mask.top = "B";
    if (side === "right") mask.right = "B";
    if (side === "bottom") mask.bottom = "B";
    if (side === "left") mask.left = "B";
    return mask;
  }

  if (category === "corridors") {
    if (id === "corridor_horizontal") {
      mask.left = "B";
      mask.right = "B";
    } else {
      mask.top = "B";
      mask.bottom = "B";
    }
    return mask;
  }

  if (category === "outer_corners") {
    const orientation = expectedOrientationFromId(id);
    if (orientation === "top_left") {
      mask.top = "B";
      mask.left = "B";
      if (/_02$/.test(id)) mask.topLeft = "B";
    }
    if (orientation === "top_right") {
      mask.top = "B";
      mask.right = "B";
      if (/_02$/.test(id)) mask.topRight = "B";
    }
    if (orientation === "bottom_left") {
      mask.bottom = "B";
      mask.left = "B";
      if (/_02$/.test(id)) mask.bottomLeft = "B";
    }
    if (orientation === "bottom_right") {
      mask.bottom = "B";
      mask.right = "B";
      if (/_02$/.test(id)) mask.bottomRight = "B";
    }
    return mask;
  }

  if (category === "edges") {
    mask.top = "B";
    mask.right = "B";
    mask.bottom = "B";
    mask.left = "B";

    const orientation = expectedOrientationFromId(id);
    const variant = Number(id.match(/_(\d+)$/)?.[1] || "1");

    if (orientation === "top") {
      mask.top = "A";
      if (variant === 2 || variant === 4) mask.topRight = "B";
      if (variant === 3 || variant === 4) mask.topLeft = "B";
      return mask;
    }

    if (orientation === "right") {
      mask.right = "A";
      if (variant === 2 || variant === 4) mask.bottomRight = "B";
      if (variant === 3 || variant === 4) mask.topRight = "B";
      return mask;
    }

    if (orientation === "bottom") {
      mask.bottom = "A";
      if (variant === 2 || variant === 4) mask.bottomLeft = "B";
      if (variant === 3 || variant === 4) mask.bottomRight = "B";
      return mask;
    }

    if (orientation === "left") {
      mask.left = "A";
      if (variant === 2 || variant === 4) mask.topLeft = "B";
      if (variant === 3 || variant === 4) mask.bottomLeft = "B";
      return mask;
    }
  }

  if (category === "inner_corners") {
    for (const key of [...NEIGHBOR_KEYS, "center"]) {
      mask[key] = "B";
    }

    const orientation = expectedOrientationFromId(id);
    const diagonalKey =
      orientation === "top_left"
        ? "topLeft"
        : orientation === "top_right"
          ? "topRight"
          : orientation === "bottom_left"
            ? "bottomLeft"
            : "bottomRight";

    mask[diagonalKey] = "A";
    return mask;
  }

  return null;
}

function getExpectedMaskForId(id, fallbackMask) {
  return buildExpectedMaskForId(id) || fallbackMask;
}

function formatList(values) {
  return values.length ? values.join(", ") : "none";
}

function analyzeTemplate(templateId, template, canonical47) {
  const patternEntries = Object.entries(template.patterns || {});
  const rawSignatureToIds = new Map();
  const canonicalSignatureToIds = new Map();
  const patternReports = [];
  const issues = {
    invalidMasks: [],
    invalidAtlasSlices: [],
    duplicateAtlasCoords: [],
    duplicateRawMasks: [],
    duplicateCanonicalMasks: [],
    nonCanonicalMasks: [],
    missingCanonicalSignatures: [],
    categoryMismatches: [],
    idShapeMismatches: [],
  };

  const canonicalCoverage = new Set();
  const atlasCoordToIds = new Map();

  for (const [patternId, pattern] of patternEntries) {
    const rawMask = normalizeMask(pattern.mask);
    const invalidKeys = [];
    const atlas = pattern?.tile?.atlas || {};

    for (const key of NEIGHBOR_KEYS) {
      if (rawMask[key] !== "A" && rawMask[key] !== "B") {
        invalidKeys.push(key);
      }
    }

    const centerValid = pattern.mask?.center === "B";
    const rawSignature = createSignature(rawMask);
    const canonicalMask = canonicalizeMask(rawMask);
    const canonicalSignature = createSignature(canonicalMask);
    const isCanonical = rawSignature === canonicalSignature;
    const expectedCategory = expectedCategoryFromId(patternId);
    const derivedCategory = classifyMask(canonicalMask);
    const expectedOrientation = expectedOrientationFromId(patternId);
    const derivedOrientation = getOrientationFamily(canonicalMask);

    if (invalidKeys.length || !centerValid) {
      issues.invalidMasks.push({
        patternId,
        invalidKeys,
        center: pattern.mask?.center,
      });
    }

    const atlasValid =
      Number.isFinite(atlas.x) &&
      Number.isFinite(atlas.y) &&
      atlas.width === 16 &&
      atlas.height === 16;

    if (!atlasValid) {
      issues.invalidAtlasSlices.push({
        patternId,
        atlas,
      });
    }

    const atlasCoordKey = `${atlas.x},${atlas.y},${atlas.width},${atlas.height}`;
    if (!atlasCoordToIds.has(atlasCoordKey)) atlasCoordToIds.set(atlasCoordKey, []);
    atlasCoordToIds.get(atlasCoordKey).push(patternId);

    if (!isCanonical) {
      issues.nonCanonicalMasks.push({
        patternId,
        rawSignature,
        canonicalSignature,
      });
    }

    if (!canonical47.has(canonicalSignature)) {
      issues.nonCanonicalMasks.push({
        patternId,
        rawSignature,
        canonicalSignature,
        reason: "not_in_canonical_47",
      });
    }

    if (expectedCategory && expectedCategory !== derivedCategory) {
      issues.categoryMismatches.push({
        patternId,
        expectedCategory,
        actualCategory: pattern.category,
        derivedCategory,
      });
    }

    if (expectedOrientation && derivedOrientation && expectedOrientation !== derivedOrientation) {
      issues.idShapeMismatches.push({
        patternId,
        expectedOrientation,
        derivedOrientation,
      });
    }

    if (!rawSignatureToIds.has(rawSignature)) rawSignatureToIds.set(rawSignature, []);
    rawSignatureToIds.get(rawSignature).push(patternId);

    if (!canonicalSignatureToIds.has(canonicalSignature)) {
      canonicalSignatureToIds.set(canonicalSignature, []);
    }
    canonicalSignatureToIds.get(canonicalSignature).push(patternId);
    canonicalCoverage.add(canonicalSignature);

    patternReports.push({
      patternId,
      category: pattern.category,
      rawSignature,
      canonicalSignature,
      isCanonical,
      expectedCategory,
      derivedCategory,
      expectedOrientation,
      derivedOrientation,
    });
  }

  rawSignatureToIds.forEach((ids, signature) => {
    if (ids.length > 1) {
      issues.duplicateRawMasks.push({ signature, ids });
    }
  });

  canonicalSignatureToIds.forEach((ids, signature) => {
    if (ids.length > 1) {
      issues.duplicateCanonicalMasks.push({ signature, ids });
    }
  });

  atlasCoordToIds.forEach((ids, atlasCoordKey) => {
    if (ids.length > 1) {
      issues.duplicateAtlasCoords.push({
        atlasCoordKey,
        ids,
      });
    }
  });

  for (const signature of canonical47.keys()) {
    if (!canonicalCoverage.has(signature)) {
      issues.missingCanonicalSignatures.push(signature);
    }
  }

  return {
    templateId,
    terrainA: template.terrainA,
    terrainB: template.terrainB,
    patternCount: patternEntries.length,
    patternReports,
    issues,
  };
}

function pickCanonicalOwner(idGroups, preferredPatternIds) {
  if (!idGroups?.length) return null;

  for (const preferredId of preferredPatternIds) {
    const match = idGroups.find((item) => item.patternId === preferredId);
    if (match) return match;
  }

  return idGroups[0];
}

function buildNormalizedTemplate(template) {
  const patternEntries = Object.entries(template.patterns || {}).map(([patternId, pattern]) => {
    const rawMask = normalizeMask(pattern.mask);
    const canonicalMask = canonicalizeMask(rawMask);
    const canonicalSignature = createSignature(canonicalMask);
    return {
      patternId,
      pattern,
      canonicalMask,
      canonicalSignature,
    };
  });

  const byCanonicalSignature = new Map();
  for (const entry of patternEntries) {
    if (!byCanonicalSignature.has(entry.canonicalSignature)) {
      byCanonicalSignature.set(entry.canonicalSignature, []);
    }
    byCanonicalSignature.get(entry.canonicalSignature).push(entry);
  }

  const normalizedPatterns = {};
  const usedCanonicalSignatures = new Set();
  const usedPatternIds = new Set();

  for (const [patternId, pattern] of Object.entries(template.patterns || {})) {
    const expectedMask = getExpectedMaskForId(patternId, normalizeMask(pattern.mask));
    const canonicalMask = canonicalizeMask(expectedMask);
    const canonicalSignature = createSignature(canonicalMask);
    const candidates = byCanonicalSignature.get(canonicalSignature) || [];
    const chosen =
      candidates.find((candidate) => candidate.patternId === patternId) ||
      pickCanonicalOwner(candidates, [patternId, `full`, `isolated`]) || {
        patternId,
        pattern,
        canonicalMask,
      };

    normalizedPatterns[patternId] = {
      ...clone(chosen.pattern),
      mask: {
        ...clone(chosen.pattern.mask || {}),
        ...canonicalMask,
        center: "B",
      },
    };

    usedCanonicalSignatures.add(canonicalSignature);
    usedPatternIds.add(patternId);
  }

  return {
    ...clone(template),
    patterns: normalizedPatterns,
  };
}

function printTemplateReport(report) {
  console.log(`\nTemplate: ${report.templateId}`);
  console.log(`  terrainA=${report.terrainA} terrainB=${report.terrainB}`);
  console.log(`  pattern count: ${report.patternCount}`);
  console.log(
    `  issues: invalid=${report.issues.invalidMasks.length}, invalidAtlas=${report.issues.invalidAtlasSlices.length}, atlasDuplicates=${report.issues.duplicateAtlasCoords.length}, rawDuplicates=${report.issues.duplicateRawMasks.length}, canonicalDuplicates=${report.issues.duplicateCanonicalMasks.length}, nonCanonical=${report.issues.nonCanonicalMasks.length}, missingCanonical=${report.issues.missingCanonicalSignatures.length}, categoryMismatches=${report.issues.categoryMismatches.length}, idShapeMismatches=${report.issues.idShapeMismatches.length}`
  );

  if (report.patternCount !== 47) {
    console.log(`  ERROR: expected 47 patterns, found ${report.patternCount}`);
  }

  if (report.issues.invalidMasks.length) {
    console.log("  Invalid masks:");
    report.issues.invalidMasks.forEach((issue) => {
      console.log(
        `    - ${issue.patternId}: invalid keys=${formatList(issue.invalidKeys)} center=${issue.center}`
      );
    });
  }

  if (report.issues.invalidAtlasSlices.length) {
    console.log("  Invalid atlas slices:");
    report.issues.invalidAtlasSlices.forEach((issue) => {
      console.log(`    - ${issue.patternId}: ${JSON.stringify(issue.atlas)}`);
    });
  }

  if (report.issues.duplicateAtlasCoords.length) {
    console.log("  Duplicate atlas coordinates:");
    report.issues.duplicateAtlasCoords.forEach((issue) => {
      console.log(`    - ${issue.atlasCoordKey} -> ${issue.ids.join(", ")}`);
    });
  }

  if (report.issues.duplicateRawMasks.length) {
    console.log("  Duplicate raw masks:");
    report.issues.duplicateRawMasks.forEach((issue) => {
      console.log(`    - ${issue.signature} -> ${issue.ids.join(", ")}`);
    });
  }

  if (report.issues.duplicateCanonicalMasks.length) {
    console.log("  Duplicate canonical masks:");
    report.issues.duplicateCanonicalMasks.forEach((issue) => {
      console.log(`    - ${issue.signature} -> ${issue.ids.join(", ")}`);
    });
  }

  if (report.issues.nonCanonicalMasks.length) {
    console.log("  Suspicious/unreachable masks:");
    report.issues.nonCanonicalMasks.forEach((issue) => {
      console.log(
        `    - ${issue.patternId}: raw=${issue.rawSignature} canonical=${issue.canonicalSignature}${issue.reason ? ` reason=${issue.reason}` : ""}`
      );
    });
  }

  if (report.issues.missingCanonicalSignatures.length) {
    console.log("  Missing canonical signatures:");
    report.issues.missingCanonicalSignatures.forEach((signature) => {
      console.log(`    - ${signature}`);
    });
  }

  if (report.issues.categoryMismatches.length) {
    console.log("  Category mismatches:");
    report.issues.categoryMismatches.forEach((issue) => {
      console.log(
        `    - ${issue.patternId}: expected=${issue.expectedCategory} category=${issue.actualCategory} derived=${issue.derivedCategory}`
      );
    });
  }

  if (report.issues.idShapeMismatches.length) {
    console.log("  ID/mask orientation mismatches:");
    report.issues.idShapeMismatches.forEach((issue) => {
      console.log(
        `    - ${issue.patternId}: expected=${issue.expectedOrientation} derived=${issue.derivedOrientation}`
      );
    });
  }

  console.log("  Pattern id -> signature:");
  report.patternReports
    .slice()
    .sort((a, b) => a.patternId.localeCompare(b.patternId))
    .forEach((pattern) => {
      const suffix = pattern.isCanonical
        ? ""
        : ` | canonical=${pattern.canonicalSignature}`;
      console.log(`    - ${pattern.patternId}: ${pattern.rawSignature}${suffix}`);
    });
}

async function main() {
  const args = parseArgs(process.argv);
  const canonical47 = generateCanonical47Set();
  const source = JSON.parse(await fs.readFile(args.input, "utf8"));
  const reports = [];

  console.log(`Autotile validator`);
  console.log(`Input: ${path.relative(ROOT_DIR, args.input)}`);
  console.log(`Canonical blob-47 signatures: ${canonical47.size}`);

  for (const [templateId, template] of Object.entries(source.templates || {})) {
    reports.push(analyzeTemplate(templateId, template, canonical47));
  }

  reports.forEach(printTemplateReport);

  const hasIssues = reports.some((report) => {
    return (
      report.patternCount !== 47 ||
      report.issues.invalidMasks.length > 0 ||
      report.issues.invalidAtlasSlices.length > 0 ||
      report.issues.duplicateAtlasCoords.length > 0 ||
      report.issues.duplicateRawMasks.length > 0 ||
      report.issues.duplicateCanonicalMasks.length > 0 ||
      report.issues.nonCanonicalMasks.length > 0 ||
      report.issues.missingCanonicalSignatures.length > 0 ||
      report.issues.categoryMismatches.length > 0 ||
      report.issues.idShapeMismatches.length > 0
    );
  });

  console.log(`\nSummary: ${hasIssues ? "issues detected" : "no structural issues detected"}`);

  if (!args.writeNormalized) {
    return;
  }

  const normalized = clone(source);
  normalized.meta = {
    ...(normalized.meta || {}),
    normalizedFrom: path.relative(ROOT_DIR, args.input),
    normalizedAt: new Date().toISOString(),
    normalizationStrategy:
      "Canonical 47-tile blob masks. Preserve atlas coordinates and ids where possible; canonicalize masks by semantic pattern ids.",
  };

  for (const [templateId, template] of Object.entries(source.templates || {})) {
    normalized.templates[templateId] = buildNormalizedTemplate(template);
  }

  await fs.writeFile(args.normalizedOutput, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  console.log(`Normalized file written: ${path.relative(ROOT_DIR, args.normalizedOutput)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

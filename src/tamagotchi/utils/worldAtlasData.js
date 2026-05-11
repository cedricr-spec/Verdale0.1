import atlasCleanV1Data from "../../spritesheets/atlas/atlas-clean-v1.json";
import treesFromAtlasData from "../../spritesheets/world/trees-from-atlas-with-collisions.json";

export const WORLD_ATLAS_PRIMARY_TREE_TAG = "world_tree_main_atlas";

function normalizeTreeCollisionBox(collisionBox) {
  if (!collisionBox) return null;

  const offsetX = Number(collisionBox.x);
  const offsetY = Number(collisionBox.y);
  const width = Number(collisionBox.width);
  const height = Number(collisionBox.height);

  if (
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    offsetX,
    offsetY,
    width,
    height,
  };
}

function getTreeFamily(tree) {
  if (tree.width === 48 && tree.height === 72) {
    return "atlas_tree_tall";
  }

  if (
    (tree.width === 16 && tree.height === 32) ||
    (tree.width === 48 && tree.height === 32)
  ) {
    return "atlas_tree_stump";
  }

  return "atlas_tree";
}

function getTreeCategory(tree) {
  if (tree.width === 48 && tree.height === 72) {
    return "tree_large";
  }

  if (
    (tree.width === 16 && tree.height === 32) ||
    (tree.width === 48 && tree.height === 32)
  ) {
    return "tree_stump";
  }

  return "tree";
}

function getTreeFrequency(tree) {
  if (tree.width === 48 && tree.height === 72) {
    return "uncommon";
  }

  if (
    (tree.width === 16 && tree.height === 32) ||
    (tree.width === 48 && tree.height === 32)
  ) {
    return "rare";
  }

  if (tree.width === 48 && tree.height === 51) {
    return "uncommon";
  }

  return "common";
}

function createWorldTreeEntry(tree) {
  const family = getTreeFamily(tree);
  const tags = ["tree", "blocks_movement"];
  const localCollisionBox = normalizeTreeCollisionBox(tree.collisionBox);

  if (family.includes("tall")) {
    tags.push("tall_tree");
  }

  if (!tree.isStump) {
    tags.push(WORLD_ATLAS_PRIMARY_TREE_TAG);
  }

  if (tree.isStump) {
    tags.push("stump");
  }

  return {
    id: tree.id,
    name: tree.id,
    type: "object",
    x: tree.x,
    y: tree.y,
    width: tree.width,
    height: tree.height,
    tileX: Math.floor(tree.x / 16),
    tileY: Math.floor(tree.y / 16),
    tileW: Math.max(1, Math.ceil(tree.width / 16)),
    tileH: Math.max(1, Math.ceil(tree.height / 16)),
    sourceColor: "atlas",
    originalName: tree.id,
    originalFamily: family,
    family,
    category: getTreeCategory(tree),
    group: "trees",
    description: tree.isStump
      ? "Atlas-based chopped tree stump entry"
      : "Atlas-based world tree entry",
    spawn: {
      surfaces: ["grass"],
      avoid: ["road", "water", "sand"],
      near: ["grass", "tree"],
      frequency: getTreeFrequency(tree),
      placement: "small_group",
    },
    tags,
    collisionBox: localCollisionBox,
    collision: {
      blocksMovement: true,
      walkableOverride: false,
    },
    interaction:
      tree.isStump || tree.interactionDisabled
        ? null
        : {
            type: "chop",
            tool: "axe",
            gives: "wood",
            replacementEntryId: tree.choppedVariantId || null,
          },
    render: {
      layer: "decor",
      priority: 0,
    },
    choppedVariantId: tree.choppedVariantId || null,
    isStump: tree.isStump === true,
    interactionDisabled: tree.interactionDisabled === true,
    v1: {
      enabled: true,
      excludedByRule: false,
    },
  };
}

export function getWorldAtlasEntryById(atlasData, entryId) {
  if (!entryId) return null;
  return atlasData?.objects?.[entryId] || null;
}

export function getWorldAtlasEntryCollisionBox(entry, scale = 1) {
  // entry.collisionBox is already normalized to {offsetX,offsetY,width,height}
  // by normalizeTreeCollisionBox at entry-creation time — do NOT call it again.
  const col = entry?.collisionBox;
  if (!col) return null;

  const offsetX = Number(col.offsetX);
  const offsetY = Number(col.offsetY);
  const width = Number(col.width);
  const height = Number(col.height);

  if (
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return {
    offsetX: offsetX * safeScale,
    offsetY: offsetY * safeScale,
    width: width * safeScale,
    height: height * safeScale,
  };
}

export function createWorldAtlasObjectSnapshot(item) {
  if (!item) return null;

  return {
    id: item.id || null,
    x: item.x ?? 0,
    y: item.y ?? 0,
    baseX: item.baseX ?? item.x ?? 0,
    baseY: item.baseY ?? item.y ?? 0,
    scale: Number.isFinite(item.scale) && item.scale > 0 ? item.scale : 1,
    anchorMode: item.anchorMode || "object",
    anchorX: Number.isFinite(item.anchorX) ? item.anchorX : 0.5,
    anchorY: Number.isFinite(item.anchorY) ? item.anchorY : 1,
    renderLayer: item.renderLayer || "decor",
    renderPriority: item.renderPriority ?? 0,
    zSortY: item.zSortY ?? item.baseY ?? item.y ?? 0,
    splitDepth: item.splitDepth || 0,
    parentObjectId: item.parentObjectId || null,
    worldDecorFamily: item.worldDecorFamily || null,
  };
}

export function createWorldAtlasStumpObject(sourceItem, replacementEntry) {
  if (!sourceItem || !replacementEntry) return null;

  const placement = createWorldAtlasObjectSnapshot(sourceItem);
  const scale =
    Number.isFinite(placement?.scale) && placement.scale > 0
      ? placement.scale
      : 1;
  const entryId = replacementEntry.id || replacementEntry.name || null;

  if (!entryId) return null;

const STUMP_Y_OFFSET = 22;

return {
  id: `stump_${sourceItem.id}`,
  originalObjectId: sourceItem.id,
  entryId,
  x: placement.x,
  y: placement.y + STUMP_Y_OFFSET,
  baseX: placement.baseX,
  baseY: placement.baseY + STUMP_Y_OFFSET,
  scale,
  anchorMode: placement.anchorMode,
  anchorX: placement.anchorX,
  anchorY: placement.anchorY,
  renderLayer: placement.renderLayer || replacementEntry.render?.layer || "decor",
  renderPriority: placement.renderPriority ?? replacementEntry.render?.priority ?? 0,
  zSortY: (placement.zSortY ?? placement.baseY) + STUMP_Y_OFFSET,
  worldDecorFamily: placement.worldDecorFamily || null,
  collisionBox: getWorldAtlasEntryCollisionBox(replacementEntry, scale),
};
}

export function createWorldAtlasStumpRenderItem(stumpObject, atlasData) {
  if (!stumpObject?.entryId) return null;

  const entry = getWorldAtlasEntryById(atlasData, stumpObject.entryId);
  if (!entry) return null;

  return {
    ...stumpObject,
    entry,
    renderWidth: entry.width || 0,
    renderHeight: entry.height || 0,
    blocksMovement: Boolean(entry.collision?.blocksMovement ?? true),
    walkableOverride: Boolean(entry.collision?.walkableOverride ?? false),
    isStump: true,
    interactionDisabled: true,
    collisionBox:
      stumpObject.collisionBox ||
      getWorldAtlasEntryCollisionBox(entry, stumpObject.scale || 1),
  };
}

export function createWorldAtlasReplacementItem(
  sourceItem,
  replacementEntry,
  replacementState = null
) {
  if (!sourceItem || !replacementEntry) return null;

  const placement =
    replacementState?.originalItemSnapshot ||
    createWorldAtlasObjectSnapshot(sourceItem);
  const scale =
    Number.isFinite(placement?.scale) && placement.scale > 0
      ? placement.scale
      : 1;
  const baseX =
    replacementState?.baseX ??
    placement?.baseX ??
    sourceItem.baseX ??
    sourceItem.x ??
    0;
  const baseY =
    replacementState?.baseY ??
    placement?.baseY ??
    sourceItem.baseY ??
    sourceItem.y ??
    0;
  const replacementObjectId =
    replacementState?.replacementObjectId || `stump_${sourceItem.id}`;

  return {
    ...sourceItem,
    ...placement,
    id: replacementObjectId,
    entry: replacementEntry,
    x: placement?.x ?? sourceItem.x ?? baseX,
    y: placement?.y ?? sourceItem.y ?? baseY,
    baseX,
    baseY,
    anchorMode: placement?.anchorMode || sourceItem.anchorMode || "object",
    anchorX:
      Number.isFinite(placement?.anchorX)
        ? placement.anchorX
        : Number.isFinite(sourceItem.anchorX)
          ? sourceItem.anchorX
          : 0.5,
    anchorY:
      Number.isFinite(placement?.anchorY)
        ? placement.anchorY
        : Number.isFinite(sourceItem.anchorY)
          ? sourceItem.anchorY
          : 1,
    renderLayer: placement?.renderLayer || sourceItem.renderLayer || "decor",
    renderPriority:
      placement?.renderPriority ?? sourceItem.renderPriority ?? 0,
    renderWidth: replacementEntry.width || sourceItem.renderWidth || 0,
    renderHeight: replacementEntry.height || sourceItem.renderHeight || 0,
    blocksMovement: Boolean(
      replacementEntry.collision?.blocksMovement ?? sourceItem.blocksMovement
    ),
    walkableOverride: Boolean(
      replacementEntry.collision?.walkableOverride ?? sourceItem.walkableOverride
    ),
    collisionBox: getWorldAtlasEntryCollisionBox(replacementEntry, scale),
    splitDepth: replacementEntry.isStump ? 0 : placement?.splitDepth || 0,
    zSortY: placement?.zSortY ?? baseY,
    replacementEntryId: replacementEntry.id || replacementEntry.name || null,
    replacedSourceId: sourceItem.id,
    hiddenOriginalObjectId: sourceItem.id,
    isStump: replacementEntry.isStump === true,
    interactionDisabled: replacementEntry.interactionDisabled === true,
    worldDecorFamily:
      placement?.worldDecorFamily || sourceItem.worldDecorFamily || null,
  };
}

function hydrateWorldAtlasTreeItem(item) {
  if (!item?.entry) return item;

  const entryId =
    item.entry.id ||
    item.entry.name ||
    item.entry.originalName ||
    item.entry.originalId ||
    null;

  if (!entryId) return item;

  const treeEntry = WORLD_ATLAS_TREE_OBJECTS[entryId];
  if (!treeEntry) return item;

  return {
    ...item,
    entry: {
      ...item.entry,
      ...treeEntry,
      id: treeEntry.id || item.entry.id || item.entry.name,
      name: treeEntry.name || item.entry.name || treeEntry.id,
      interaction:
        treeEntry.interaction === null
          ? null
          : treeEntry.interaction || item.entry.interaction || null,
      choppedVariantId:
        treeEntry.choppedVariantId || item.entry.choppedVariantId || null,
      isStump: treeEntry.isStump === true || item.entry.isStump === true,
      interactionDisabled:
        treeEntry.interactionDisabled === true ||
        item.entry.interactionDisabled === true,
    },
  };
}

export function getWorldAtlasReplacementItems(atlasData, objectState) {
  const replacedObjectIds = objectState?.replacedObjectIds || {};

  return Object.values(replacedObjectIds).flatMap((replacementState) => {
    if (!replacementState?.replacementEntryId) {
      return [];
    }

    const replacementEntry = getWorldAtlasEntryById(
      atlasData,
      replacementState.replacementEntryId
    );
    if (!replacementEntry) {
      return [];
    }

    const sourceSnapshot = replacementState.originalItemSnapshot || {
      id: replacementState.originalObjectId,
      x: replacementState.baseX ?? 0,
      y: replacementState.baseY ?? 0,
      baseX: replacementState.baseX ?? 0,
      baseY: replacementState.baseY ?? 0,
      scale: 1,
      anchorMode: "object",
      anchorX: 0.5,
      anchorY: 1,
      renderLayer: "decor",
      renderPriority: 0,
      zSortY: replacementState.baseY ?? 0,
      splitDepth: 0,
    };

    const replacementItem = createWorldAtlasReplacementItem(
      sourceSnapshot,
      replacementEntry,
      replacementState
    );

    return replacementItem ? [replacementItem] : [];
  });
}

export function applyWorldAtlasObjectState(items, atlasData, objectState) {
  const hiddenObjectIds = objectState?.hiddenObjectIds || {};
  const replacedObjectIds = objectState?.replacedObjectIds || {};

  return (items || []).flatMap((item) => {
    if (!item?.id) return item ? [item] : [];

    if (replacedObjectIds[item.id]) {
      return [];
    }

    if (hiddenObjectIds[item.id]) {
      return [];
    }

    return [hydrateWorldAtlasTreeItem(item)];
  });
}

export const WORLD_ATLAS_TREE_OBJECTS = Object.fromEntries(
  (treesFromAtlasData?.trees || []).map((tree) => [tree.id, createWorldTreeEntry(tree)])
);

export const WORLD_ATLAS_DATA = {
  ...atlasCleanV1Data,
  objects: {
    ...(atlasCleanV1Data.objects || {}),
    ...WORLD_ATLAS_TREE_OBJECTS,
  },
};

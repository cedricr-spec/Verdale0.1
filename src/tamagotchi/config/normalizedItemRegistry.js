import rawRegistry from "../../spritesheets/items/itemsRegistry_clean_v2.json"
import craftingAtlasPng from "../../spritesheets/items/Crafting Materials Icons.png"

export const RAW_NORMALIZED_ITEM_REGISTRY = rawRegistry

const RAW_ITEMS = Array.isArray(rawRegistry?.items) ? rawRegistry.items : []
const RAW_RECIPES = Array.isArray(rawRegistry?.recipes) ? rawRegistry.recipes : []

const ITEM_ATLAS_URLS = {
  [rawRegistry?.spriteSheet?.path]: craftingAtlasPng,
  "src/spritesheets/items/Crafting Materials Icons.png": craftingAtlasPng,
  "Crafting Materials Icons.png": craftingAtlasPng,
}

const SUPPORTED_RECIPE_TYPES = new Set(["crafting", "heating", "processing"])

const TOOL_CAPABILITY_KEYS = new Set([
  "axe",
  "pickaxe",
  "hoe",
  "shovel",
  "hammer",
  "bucket",
  "watering_can",
  "bug_net",
  "needle",
])

const TOOL_TIER_ORDER = [
  "wood",
  "copper",
  "iron",
  "gold",
  "indigosium",
  "diamond",
  "slayirium",
  "adamantite",
  "emerald",
]

const DEFAULT_WORLD_INTERACTION_CONFIG_BY_TOOL_KIND = {
  axe: {
    interactionType: "chop",
    targetGroup: "trees",
    successMessage: "Chopped!",
    missingMessage: "No tree nearby",
    fx: {
      type: "axe_slash",
      towardPetDistance: 18,
      liftFromBase: 18,
    },
  },
  pickaxe: {
    interactionType: "mine",
    targetGroup: "rocks",
    successMessage: "Mined!",
    missingMessage: "No rock nearby",
    fx: {
      type: "pickaxe_slash",
      towardPetDistance: 12,
      liftFromBase: 26,
    },
  },
}

function titleCase(value) {
  return String(value || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function slugifyToolLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normalizeToolKind(value, itemId = "") {
  const explicitKind = slugifyToolLabel(value)
  if (itemId.endsWith("_pickaxe")) return "pickaxe"
  if (itemId.endsWith("_watering_can")) return "watering_can"
  if (itemId.endsWith("_bug_net")) return "bug_net"
  if (itemId.endsWith("_hoe")) return "hoe"
  if (itemId.endsWith("_shovel")) return "shovel"
  if (itemId.endsWith("_hammer")) return "hammer"
  if (itemId.endsWith("_bucket")) return "bucket"
  if (itemId.endsWith("_axe")) return "axe"
  if (TOOL_CAPABILITY_KEYS.has(explicitKind)) return explicitKind
  return explicitKind || null
}

function inferToolTier(itemId = "") {
  if (!itemId) return null
  if (itemId.startsWith("wooden_")) return "wood"

  const [firstSegment] = String(itemId).split("_")
  if (TOOL_TIER_ORDER.includes(firstSegment)) return firstSegment
  return null
}

function getToolTierRank(tier) {
  const index = TOOL_TIER_ORDER.indexOf(tier)
  return index >= 0 ? index : -1
}

function normalizeQuantityRange(quantity) {
  if (Array.isArray(quantity)) {
    const min = Math.max(1, Math.floor(Number(quantity[0]) || 1))
    const max = Math.max(min, Math.floor(Number(quantity[1]) || min))
    return [min, max]
  }

  const single = Math.max(1, Math.floor(Number(quantity) || 1))
  return [single, single]
}

function normalizeSpriteRect(sprite = null) {
  if (!sprite) return null

  const width = Number(sprite.w ?? sprite.width ?? 0)
  const height = Number(sprite.h ?? sprite.height ?? width)
  if (width <= 0 || height <= 0) return null

  return {
    x: Number(sprite.x || 0),
    y: Number(sprite.y || 0),
    width,
    height,
  }
}

export function resolveItemAtlasUrl(atlasSourcePath) {
  if (!atlasSourcePath) return null
  const filename = atlasSourcePath.split("/").pop()
  return (
    ITEM_ATLAS_URLS[atlasSourcePath] ||
    ITEM_ATLAS_URLS[filename] ||
    atlasSourcePath
  )
}

function normalizeRecipeEntries(entries = []) {
  return (entries || [])
    .map((entry) => {
      const itemId = String(entry?.itemId || "").trim()
      const quantity = Math.max(0, Math.floor(Number(entry?.quantity) || 0))
      if (!itemId || quantity <= 0) return null
      return {
        itemId,
        quantity,
        name: entry?.name || null,
      }
    })
    .filter(Boolean)
}

function buildDefaultWorldSpawnRule(item) {
  const explicit = item?.drops?.world_spawn
  if (!explicit) return null

  return {
    enabled: explicit.enabled !== false,
    itemId: item.id,
    chance: Number(explicit.chance ?? 1),
    weight: Math.max(0, Number(explicit.weight) || 0),
    quantity: normalizeQuantityRange(explicit.quantity),
    biome: explicit.biome || null,
    sourceGroup: explicit.sourceGroup || null,
    sourceTerrain: explicit.sourceTerrain || null,
    requiredTool: explicit.requiredTool || null,
    requiredToolKind: explicit.requiredToolKind || null,
    minToolTier: explicit.minToolTier || null,
  }
}

function parseObtainSourceDetails(entry = {}, itemId = "") {
  const label = String(entry?.label || "").trim()
  const lowerLabel = label.toLowerCase()
  const rawType = String(entry?.type || "").trim().toLowerCase()

  let type = rawType || "other"
  if (type === "other" && lowerLabel.includes("fill")) {
    type = "fill"
  }

  const details = {
    type,
    label,
    itemId,
    sourceGroup: null,
    sourceTerrain: null,
    station: null,
    requiredTool: null,
    requiredToolKind: null,
    minToolTier: null,
  }

  if (lowerLabel.includes("chopping tree")) {
    details.sourceGroup = "trees"
    details.requiredToolKind = "axe"
  }

  if (lowerLabel.includes("mining rock")) {
    details.sourceGroup = "rocks"
    details.requiredToolKind = "pickaxe"
  }

  if (lowerLabel.includes("sand terrain")) {
    details.sourceTerrain = "sand"
    details.requiredToolKind = "shovel"
  }

  if (lowerLabel.includes("furnace")) {
    details.station = "furnace"
  }

  if (lowerLabel.includes("charcoal kiln")) {
    details.station = "charcoal_kiln"
  }

  const toolMatch = lowerLabel.match(/with\s+([a-z\s]+)$/)
  if (toolMatch?.[1]) {
    const toolId = slugifyToolLabel(toolMatch[1])
      .replace(/_watering_can$/, "_watering_can")
      .replace(/_bug_net$/, "_bug_net")
    if (toolId) {
      details.requiredTool = toolId
      details.requiredToolKind = normalizeToolKind(toolId, toolId)
      details.minToolTier = inferToolTier(toolId)
    }
  }

  if (type === "fill" && lowerLabel.includes("wooden bucket")) {
    details.requiredTool = "wooden_bucket"
    details.requiredToolKind = "bucket"
    details.sourceTerrain = "water"
  }

  if (type === "fill" && lowerLabel.includes("iron bucket")) {
    details.requiredTool = "iron_bucket"
    details.requiredToolKind = "bucket"
    details.sourceTerrain = "water"
  }

  return details
}

function normalizeObtainingSources(item) {
  return (item?.gameplay?.obtainableFrom || [])
    .map((entry) => parseObtainSourceDetails(entry, item.id))
    .filter((entry) => Boolean(entry.type))
}

function normalizeDropRules(item, obtainSources) {
  const worldSpawnRule = buildDefaultWorldSpawnRule(item)

  const rules = {
    world_spawn: worldSpawnRule,
    chopping: null,
    mining: null,
    fill: null,
  }

  obtainSources.forEach((source) => {
    if (!source?.type || source.type === "world_spawn") return

    const explicit = item?.drops?.[source.type] || {}
    const targetKey = source.type
    if (!rules[targetKey]) {
      rules[targetKey] = {
        enabled: explicit.enabled !== false,
        itemId: item.id,
        weight: Math.max(0, Number(explicit.weight) || 1),
        chance: Number(explicit.chance ?? 1),
        quantity: normalizeQuantityRange(explicit.quantity),
        sourceGroup: explicit.sourceGroup || source.sourceGroup || null,
        sourceTerrain: explicit.sourceTerrain || source.sourceTerrain || null,
        station: explicit.station || source.station || null,
        requiredTool: explicit.requiredTool || source.requiredTool || null,
        requiredToolKind:
          explicit.requiredToolKind ||
          source.requiredToolKind ||
          normalizeToolKind(explicit.requiredTool, explicit.requiredTool),
        minToolTier:
          explicit.minToolTier ||
          source.minToolTier ||
          inferToolTier(explicit.requiredTool || source.requiredTool),
      }
    }
  })

  return rules
}

function inferItemEmoji(item) {
  const itemId = item?.id || ""
  const toolKind = normalizeToolKind(item?.tool?.kind, itemId)
  if (toolKind === "axe") return "🪓"
  if (toolKind === "pickaxe") return "⛏️"
  if (toolKind === "hoe") return "🌱"
  if (toolKind === "shovel") return "🛠️"
  if (toolKind === "hammer") return "🔨"
  if (toolKind === "bucket" || toolKind === "watering_can") return "🪣"
  if (toolKind === "bug_net") return "🕸️"
  if (toolKind === "needle") return "🪡"

  if (itemId.includes("wood")) return "🪵"
  if (itemId.includes("stone")) return "🪨"
  if (itemId.includes("gem")) return "💎"
  if (itemId.includes("ore")) return "⛏️"
  if (itemId.includes("ingot")) return "🔩"
  if (itemId.includes("glass")) return "🧪"
  if (itemId.includes("paper")) return "📄"
  if (itemId.includes("bone")) return "🦴"
  if (itemId.includes("leaf")) return "🍃"
  if (itemId.includes("sand")) return "🟨"
  if (itemId.includes("charcoal") || itemId.includes("coal")) return "⚫"
  if (itemId.includes("furnace")) return "🔥"
  if (itemId.includes("kiln")) return "🔥"

  return "📦"
}

function normalizeRegistryItem(item) {
  const spriteRect = normalizeSpriteRect(item?.sprite)
  const atlasSource = resolveItemAtlasUrl(item?.sprite?.sheet)
  const legacyIds = [...new Set((item?.legacyIds || []).filter(Boolean))]
  const obtainSources = normalizeObtainingSources(item)
  const toolKind = normalizeToolKind(item?.tool?.kind, item?.id)
  const toolTier = inferToolTier(item?.id)

  return {
    ...item,
    atlasSource,
    atlasRect: spriteRect,
    legacyIds,
    displayIcon: inferItemEmoji(item),
    stackable: Math.max(1, Number(item?.gameplay?.maxStack || 1)) > 1,
    maxStack: Math.max(1, Number(item?.gameplay?.maxStack || 1)),
    tool: toolKind
      ? {
          ...item.tool,
          kind: toolKind,
          tier: toolTier,
        }
      : null,
    obtainableFrom: obtainSources,
    dropRules: normalizeDropRules(item, obtainSources),
  }
}

export const NORMALIZED_REGISTRY_ITEMS = RAW_ITEMS.map(normalizeRegistryItem)

export const NORMALIZED_REGISTRY_ITEMS_BY_ID = NORMALIZED_REGISTRY_ITEMS.reduce(
  (registry, item) => {
    registry[item.id] = item
    return registry
  },
  {}
)

export const NORMALIZED_REGISTRY_ALIASES = NORMALIZED_REGISTRY_ITEMS.reduce(
  (aliases, item) => {
    item.legacyIds.forEach((legacyId) => {
      aliases[legacyId] = item.id
    })
    return aliases
  },
  {
    ...(rawRegistry?.legacyAliases || {}),
  }
)

export function getCanonicalRegistryItemId(itemId) {
  if (!itemId) return null
  if (NORMALIZED_REGISTRY_ITEMS_BY_ID[itemId]) return itemId
  return NORMALIZED_REGISTRY_ALIASES[itemId] || null
}

export function getNormalizedRegistryItem(itemId) {
  const canonicalItemId = getCanonicalRegistryItemId(itemId)
  return canonicalItemId ? NORMALIZED_REGISTRY_ITEMS_BY_ID[canonicalItemId] || null : null
}

export function getItemToolProfile(itemId) {
  return getNormalizedRegistryItem(itemId)?.tool || null
}

export function getItemEquipmentProfile(itemId) {
  return getNormalizedRegistryItem(itemId)?.equipment || null
}

export function compareToolTiers(currentTier, requiredTier) {
  if (!requiredTier) return true
  return getToolTierRank(currentTier) >= getToolTierRank(requiredTier)
}

export function matchesToolRequirement(itemId, requirement) {
  if (!requirement) return true

  const canonicalItemId = getCanonicalRegistryItemId(itemId) || itemId
  const toolProfile = getItemToolProfile(canonicalItemId)
  if (!toolProfile) return false

  if (Array.isArray(requirement)) {
    return requirement.some((entry) => matchesToolRequirement(canonicalItemId, entry))
  }

  if (typeof requirement === "string") {
    const requirementKind = normalizeToolKind(requirement, requirement)
    if (requirementKind && TOOL_CAPABILITY_KEYS.has(requirementKind) && requirement === requirementKind) {
      return toolProfile.kind === requirementKind
    }

    const canonicalRequirement = getCanonicalRegistryItemId(requirement)
    if (canonicalRequirement) {
      return canonicalRequirement === canonicalItemId
    }

    return Boolean(requirementKind && toolProfile.kind === requirementKind)
  }

  if (typeof requirement === "object") {
    const requiredKind =
      normalizeToolKind(requirement.kind, requirement.kind) ||
      normalizeToolKind(requirement.requiredToolKind, requirement.requiredToolKind)
    const requiredItemId = getCanonicalRegistryItemId(requirement.itemId || requirement.requiredTool)
    const minToolTier = requirement.minToolTier || inferToolTier(requiredItemId)

    if (requiredItemId && requiredItemId !== canonicalItemId) return false
    if (requiredKind && requiredKind !== toolProfile.kind) return false
    return compareToolTiers(toolProfile.tier, minToolTier)
  }

  return false
}

function matchesDropRuleContext(rule, context = {}) {
  if (!rule || rule.enabled === false) return false
  if (context.sourceGroup && rule.sourceGroup && context.sourceGroup !== rule.sourceGroup) return false
  if (context.sourceTerrain && rule.sourceTerrain && context.sourceTerrain !== rule.sourceTerrain) {
    return false
  }
  if (context.station && rule.station && context.station !== rule.station) return false
  if (context.toolItemId) {
    const requirement =
      rule.requiredTool ||
      (rule.requiredToolKind || rule.minToolTier
        ? {
            kind: rule.requiredToolKind,
            minToolTier: rule.minToolTier,
          }
        : null)
    if (!matchesToolRequirement(context.toolItemId, requirement)) return false
  }

  return true
}

export function getWorldSpawnEntries() {
  return NORMALIZED_REGISTRY_ITEMS.map((item) => item.dropRules?.world_spawn)
    .filter((rule) => matchesDropRuleContext(rule))
    .sort((left, right) => right.weight - left.weight)
}

export function getObtainEntriesByType(type, context = {}) {
  return NORMALIZED_REGISTRY_ITEMS.map((item) => item.dropRules?.[type])
    .filter((rule) => matchesDropRuleContext(rule, context))
    .sort((left, right) => right.weight - left.weight)
}

export function getObtainEntriesForItem(itemId) {
  return getNormalizedRegistryItem(itemId)?.obtainableFrom || []
}

function buildRegistryRecipe(item) {
  const crafting = item?.crafting || {}
  if (!item?.id || !SUPPORTED_RECIPE_TYPES.has(crafting.type)) return null

  const inputs = normalizeRecipeEntries(crafting.ingredients)
  const outputs = normalizeRecipeEntries(crafting.output ? [crafting.output] : [])
  if (!inputs.length || !outputs.length) return null

  return {
    id: item.id,
    registryRecipeId: `${crafting.type}_${item.id}`,
    sourceItemId: item.id,
    name: item.name || titleCase(item.id),
    type: crafting.type,
    station: crafting.station || null,
    raw: crafting.raw || null,
    notes: crafting.notes || null,
    inputs,
    outputs,
    category: item?.gameplay?.category || "material",
    icon: item.displayIcon,
    atlasSource: item.atlasSource,
    atlasRect: item.atlasRect,
    showInPanel: crafting.type === "crafting" && !crafting.station,
  }
}

function buildRegistryRecipeFromEntry(recipe, index) {
  const sourceItemId = recipe?.sourceItemId || recipe?.output?.itemId || null
  const sourceItem = sourceItemId ? NORMALIZED_REGISTRY_ITEMS_BY_ID[sourceItemId] || null : null
  const type = recipe?.type || sourceItem?.crafting?.type || null
  if (!SUPPORTED_RECIPE_TYPES.has(type)) return null

  const outputs = normalizeRecipeEntries(recipe?.output ? [recipe.output] : [])
  const outputItem = outputs[0]?.itemId
    ? NORMALIZED_REGISTRY_ITEMS_BY_ID[outputs[0].itemId] || sourceItem || null
    : sourceItem
  const inputs = normalizeRecipeEntries(recipe?.ingredients)
  if (!inputs.length || !outputs.length) return null

  return {
    id: outputItem?.id || sourceItem?.id || recipe.id || `recipe_${index}`,
    registryRecipeId: recipe.id || `${type}_${outputItem?.id || sourceItem?.id || index}`,
    sourceItemId: sourceItem?.id || sourceItemId || outputItem?.id || null,
    name: outputItem?.name || sourceItem?.name || titleCase(outputItem?.id || sourceItemId),
    type,
    station: recipe?.station || sourceItem?.crafting?.station || null,
    raw: recipe?.raw || sourceItem?.crafting?.raw || null,
    notes: sourceItem?.crafting?.notes || null,
    inputs,
    outputs,
    category: outputItem?.gameplay?.category || sourceItem?.gameplay?.category || "material",
    icon: outputItem?.displayIcon || sourceItem?.displayIcon || "📦",
    atlasSource: outputItem?.atlasSource || sourceItem?.atlasSource || null,
    atlasRect: outputItem?.atlasRect || sourceItem?.atlasRect || null,
    showInPanel: type === "crafting" && !(recipe?.station || sourceItem?.crafting?.station),
    sortIndex: index,
  }
}

const ITEM_DERIVED_REGISTRY_RECIPES = NORMALIZED_REGISTRY_ITEMS.map(buildRegistryRecipe).filter(Boolean)

export const NORMALIZED_REGISTRY_RECIPES = (
  RAW_RECIPES.length ? RAW_RECIPES.map(buildRegistryRecipeFromEntry) : ITEM_DERIVED_REGISTRY_RECIPES
).filter(Boolean)

export const NORMALIZED_REGISTRY_RECIPES_BY_ID = NORMALIZED_REGISTRY_RECIPES.reduce(
  (registry, recipe) => {
    registry[recipe.id] = recipe
    return registry
  },
  {}
)

export function getNormalizedRegistryRecipe(recipeId) {
  return NORMALIZED_REGISTRY_RECIPES_BY_ID[recipeId] || null
}

export function getRegistryRecipesByStation(station = null) {
  return NORMALIZED_REGISTRY_RECIPES.filter((recipe) => (recipe.station || null) === (station || null))
}

export function getDefaultWorldInteractionConfig(itemId) {
  const toolKind = getItemToolProfile(itemId)?.kind
  return toolKind ? DEFAULT_WORLD_INTERACTION_CONFIG_BY_TOOL_KIND[toolKind] || null : null
}

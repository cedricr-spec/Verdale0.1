import RAW_QUESTS_JSON from "./quests.json"

export const QUEST_OBJECTIVE_TYPES = {
  COLLECT_ITEM: "collect_item",
  CRAFT_ITEM: "craft_item",
  DISCARD_ITEM: "discard_item",
  MINE_OBJECT: "mine_object",
  CHOP_OBJECT: "chop_object",
  WORLD_INTERACTION: "world_interaction",
  PLANT_CROP: "plant_crop",
  WATER_CROP: "water_crop",
  HARVEST_CROP: "harvest_crop",
}

export const QUEST_REWARD_TYPES = {
  INVENTORY_CAPACITY: "inventory_capacity",
  ITEM: "item",
  UNLOCK_CHARACTER: "unlock_character",
  UNLOCK_RECIPE: "unlock_recipe",
  EXPERIENCE: "experience",
  CURRENCY: "currency",
}

// Maps lowercase JSON strings → canonical constant values
const OBJECTIVE_TYPE_MAP = {
  collect_item: QUEST_OBJECTIVE_TYPES.COLLECT_ITEM,
  craft_item: QUEST_OBJECTIVE_TYPES.CRAFT_ITEM,
  discard_item: QUEST_OBJECTIVE_TYPES.DISCARD_ITEM,
  mine_object: QUEST_OBJECTIVE_TYPES.MINE_OBJECT,
  chop_object: QUEST_OBJECTIVE_TYPES.CHOP_OBJECT,
  world_interaction: QUEST_OBJECTIVE_TYPES.WORLD_INTERACTION,
  plant_crop: QUEST_OBJECTIVE_TYPES.PLANT_CROP,
  water_crop: QUEST_OBJECTIVE_TYPES.WATER_CROP,
  harvest_crop: QUEST_OBJECTIVE_TYPES.HARVEST_CROP,
}


const REWARD_TYPE_MAP = {
  item: QUEST_REWARD_TYPES.ITEM,
  inventory_capacity: QUEST_REWARD_TYPES.INVENTORY_CAPACITY,
  unlock_character: QUEST_REWARD_TYPES.UNLOCK_CHARACTER,
  unlock_recipe: QUEST_REWARD_TYPES.UNLOCK_RECIPE,
  experience: QUEST_REWARD_TYPES.EXPERIENCE,
  currency: QUEST_REWARD_TYPES.CURRENCY,
}

// ─────────────────────────────────────────────
// ⚠️ TEMP TEST CHARACTER UNLOCK REWARDS (REMOVE LATER)
// Used to test quest → progressionStore → character unlock flow.
// Keys are quest ids, values are character ids.
// Replace these ids with real quest/character ids from your project.
// ─────────────────────────────────────────────

const TEMP_TEST_CHARACTER_UNLOCK_REWARDS_BY_QUEST_ID = {
  // example:
  // first_quest_id: "character_id_to_unlock",
}

function normalizeObjectiveType(rawType) {
  if (!rawType) return QUEST_OBJECTIVE_TYPES.COLLECT_ITEM
  const lower = String(rawType).toLowerCase().trim()
  return OBJECTIVE_TYPE_MAP[lower] || lower
}

function normalizeRewardType(rawType) {
  if (!rawType) return QUEST_REWARD_TYPES.ITEM
  const lower = String(rawType).toLowerCase().trim()
  return REWARD_TYPE_MAP[lower] || lower
}

function normalizeQuantity(value, fallback = 1) {
  const n = Math.max(0, Number(value) || fallback)
  return n > 0 ? n : fallback
}

function normalizeQuest(quest) {
  if (!quest?.id) {
    if (import.meta.env.DEV) {
      console.warn("[questConfig] Quest entry missing id:", quest)
    }
    return null
  }

  // Support both `prerequisites` (JSON schema) and `prerequisiteQuestIds` (legacy JS)
  const rawPrereqs = Array.isArray(quest.prerequisites)
    ? quest.prerequisites
    : Array.isArray(quest.prerequisiteQuestIds)
    ? quest.prerequisiteQuestIds
    : []
  const prerequisiteQuestIds = [...new Set(rawPrereqs.filter(Boolean))]

  const objectives = Array.isArray(quest.objectives)
    ? quest.objectives
        .map((obj, idx) => {
          const itemId = obj?.itemId || null
          if (import.meta.env.DEV && !itemId) {
            console.warn(`[questConfig] Quest "${quest.id}" objective[${idx}] missing itemId`)
          }
          return {
            type: normalizeObjectiveType(obj?.type),
            itemId,
            // Support both `target` (spec shape) and `quantity` (legacy)
            quantity: normalizeQuantity(obj?.target ?? obj?.quantity, 1),
          }
        })
        .filter((obj) => Boolean(obj.itemId))
    : []

  const rewards = Array.isArray(quest.rewards)
    ? quest.rewards
        .map((reward) => ({
          type: normalizeRewardType(reward?.type),
          value: reward?.value ?? reward?.itemId ?? reward?.characterId ?? reward?.recipeId ?? null,
          amount: normalizeQuantity(reward?.amount, 1),
        }))
        .filter((reward) => Boolean(reward.type) && reward.value !== null)
    : []

  const tempUnlockCharacterId = TEMP_TEST_CHARACTER_UNLOCK_REWARDS_BY_QUEST_ID[quest.id]
  if (tempUnlockCharacterId) {
    rewards.push({
      type: QUEST_REWARD_TYPES.UNLOCK_CHARACTER,
      value: tempUnlockCharacterId,
      amount: 1,
    })
  }

  if (import.meta.env.DEV && objectives.length === 0) {
    console.warn(`[questConfig] Quest "${quest.id}" has no valid objectives`)
  }

  return {
    id: quest.id,
    chapter: Math.max(1, Number(quest.chapter) || 1),
    order: Math.max(0, Number(quest.order) || 0),
    title: quest.title || quest.id,
    shortTitle: quest.shortTitle || quest.title || quest.id,
    description: quest.description || "",
    iconItemId: quest.iconItemId || null,
    category: quest.category || "general",
    grade: quest.grade || "common",
    hidden: quest.hidden === true,
    status: "locked",
    // A quest with no prerequisites is automatically unlocked by default
    unlockedByDefault: quest.unlockedByDefault === true || prerequisiteQuestIds.length === 0,
    prerequisiteQuestIds,
    repeatable: quest.repeatable === true,
    objectives,
    rewards,
  }
}

// All quests loaded from JSON, normalized, sorted by chapter then order
export const QUESTS = RAW_QUESTS_JSON.map(normalizeQuest)
  .filter(Boolean)
  .sort((a, b) => {
    if (a.chapter !== b.chapter) return a.chapter - b.chapter
    return a.order - b.order
  })

export const QUESTS_BY_ID = QUESTS.reduce((registry, quest) => {
  registry[quest.id] = quest
  return registry
}, {})

// Ordered list of quest IDs (chapter → order) — used by the store for active quest resolution
export const QUEST_CHAIN_ORDER = QUESTS.map((q) => q.id)

// Chapter metadata — add an entry here when adding new chapters.
// questIds are auto-derived from QUESTS so no manual sync is needed.
const CHAPTER_META = {
  1: { title: "The First Tools", description: "Learn the basics of crafting and gathering." },
  2: { title: "The Farm Awakens", description: "Grow your first crops and unlock new skills." },
}

export const QUEST_CHAPTERS = (() => {
  const map = {}
  QUESTS.forEach((quest) => {
    const id = quest.chapter
    if (!map[id]) {
      map[id] = {
        id,
        title: CHAPTER_META[id]?.title ?? `Chapter ${id}`,
        description: CHAPTER_META[id]?.description ?? "",
        questIds: [],
      }
    }
    map[id].questIds.push(quest.id)
  })
  return Object.values(map).sort((a, b) => a.id - b.id)
})()

export function getQuestIdsForChapter(chapterId) {
  const chapter = QUEST_CHAPTERS.find((c) => c.id === chapterId)
  return chapter?.questIds ?? []
}

export function isChapterCompleted(chapterId, questState) {
  const questIds = getQuestIdsForChapter(chapterId)
  if (questIds.length === 0) return false
  return questIds.every((id) => questState.claimedQuestIds.includes(id))
}

export function getCurrentChapterId(questState) {
  for (const chapter of QUEST_CHAPTERS) {
    if (!isChapterCompleted(chapter.id, questState)) return chapter.id
  }
  return QUEST_CHAPTERS[QUEST_CHAPTERS.length - 1]?.id ?? 1
}

export function getCurrentChapter(questState) {
  const id = getCurrentChapterId(questState)
  return QUEST_CHAPTERS.find((c) => c.id === id) ?? QUEST_CHAPTERS[0]
}

export const DEFAULT_UNLOCKED_QUEST_IDS = QUESTS
  .filter((q) => q.unlockedByDefault)
  .map((q) => q.id)

export const QUEST_DEPENDENTS_BY_ID = QUESTS.reduce((dependents, quest) => {
  quest.prerequisiteQuestIds.forEach((prereqId) => {
    if (!dependents[prereqId]) dependents[prereqId] = []
    dependents[prereqId].push(quest.id)
  })
  return dependents
}, {})

export function getQuestById(questId) {
  return QUESTS_BY_ID[questId] || null
}

export function getQuestObjectives(questIdOrQuest) {
  const quest = typeof questIdOrQuest === "string" ? getQuestById(questIdOrQuest) : questIdOrQuest
  return quest?.objectives || []
}

export function getQuestRewards(questIdOrQuest) {
  const quest = typeof questIdOrQuest === "string" ? getQuestById(questIdOrQuest) : questIdOrQuest
  return quest?.rewards || []
}

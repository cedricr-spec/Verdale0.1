import { create } from "zustand"
import {
  DEFAULT_UNLOCKED_QUEST_IDS,
  QUEST_CHAIN_ORDER,
  QUEST_OBJECTIVE_TYPES,
  QUEST_REWARD_TYPES,
  QUESTS,
  getQuestById,
  getQuestObjectives,
  getQuestRewards,
} from "../config/questConfig"
import { useInventoryStore } from "./useInventoryStore"
import { useProgressionStore } from "./progressionStore"

function uniqueIds(ids = []) {
  return [...new Set((ids || []).filter(Boolean))]
}

function createQuestProgress(questId) {
  return getQuestObjectives(questId).map(() => 0)
}
function createCompletedQuestProgress(questId) {
  return getQuestObjectives(questId).map((objective) => getObjectiveTarget(objective))
}
function createInitialObjectiveProgress(questIds = []) {
  return questIds.reduce((progressByQuestId, questId) => {
    progressByQuestId[questId] = createQuestProgress(questId)
    return progressByQuestId
  }, {})
}

function getFirstActiveQuestId(unlockedQuestIds = []) {
  return QUEST_CHAIN_ORDER.find((questId) => unlockedQuestIds.includes(questId)) || null
}

function getProgressForQuest(state, questId) {
  if (state.objectiveProgress[questId]) return state.objectiveProgress[questId]
  return createQuestProgress(questId)
}

function getObjectiveTarget(objective) {
  return Math.max(0, Number(objective?.quantity) || 0)
}

function getObjectiveProgressValue(progressByQuestId = {}, questId, objectiveIndex) {
  const progress = progressByQuestId[questId]
  return Math.max(0, Number(progress?.[objectiveIndex]) || 0)
}

export function getQuestObjectiveProgressEntries(questId, stateLike) {
  const quest = getQuestById(questId)
  if (!quest) return []

  return getQuestObjectives(quest).map((objective, objectiveIndex) => ({
    ...objective,
    current: getObjectiveProgressValue(stateLike.objectiveProgress, quest.id, objectiveIndex),
    target: getObjectiveTarget(objective),
  }))
}

export function isQuestCompletedForState(questId, stateLike) {
  const quest = getQuestById(questId)
  if (!quest) return false

  return getQuestObjectiveProgressEntries(questId, stateLike).every(
    (objective) => objective.current >= objective.target
  )
}

export function getQuestStatusForState(questId, stateLike) {
  if (stateLike.claimedQuestIds.includes(questId)) return "claimed"
  if (stateLike.completedQuestIds.includes(questId)) return "completed"
  if (stateLike.unlockedQuestIds.includes(questId)) {
    return stateLike.activeQuestId === questId ? "active" : "unlocked"
  }
  return "locked"
}

function isQuestAvailableForSelection(stateLike, questId) {
  const quest = getQuestById(questId)
  if (!quest) return false
  if (!stateLike.unlockedQuestIds.includes(questId)) return false
  if (quest.repeatable === true) return true
  return !stateLike.claimedQuestIds.includes(questId)
}

function getFirstTrackableQuestId(stateLike) {
  return (
    QUEST_CHAIN_ORDER.find((questId) => {
      if (!getQuestById(questId)) return false
      if (!stateLike.unlockedQuestIds.includes(questId)) return false
      if (stateLike.claimedQuestIds.includes(questId)) return false
      return true
    }) || null
  )
}

// When a quest first unlocks, check if the player already owns items that satisfy
// any craft_item objectives — this handles the case where tools were crafted before
// the quest became active.
function backfillObjectivesFromInventory(questId, progress) {
  const quest = getQuestById(questId)
  if (!quest) return progress

  const inventoryState = useInventoryStore.getState()
  const next = [...progress]
  let changed = false

  getQuestObjectives(quest).forEach((objective, index) => {
    if (objective.type !== QUEST_OBJECTIVE_TYPES.CRAFT_ITEM) return
    const target = getObjectiveTarget(objective)
    if (next[index] >= target) return // already satisfied

    const owned = Math.max(0, Number(inventoryState.countItemsOwned(objective.itemId)) || 0)
    if (owned >= target) {
      next[index] = target
      changed = true
    }
  })

  return changed ? next : progress
}

function unlockAvailableQuests(stateLike) {
  const unlockedQuestIds = uniqueIds(stateLike.unlockedQuestIds)
  const completedQuestIds = uniqueIds(stateLike.completedQuestIds)
  const nextObjectiveProgress = { ...stateLike.objectiveProgress }
  let changed = false

  QUESTS.forEach((quest) => {
    if (unlockedQuestIds.includes(quest.id)) return

    const prerequisiteQuestIds = quest.prerequisiteQuestIds || []
    const prerequisitesMet =
      quest.unlockedByDefault ||
      prerequisiteQuestIds.every((prerequisiteQuestId) => completedQuestIds.includes(prerequisiteQuestId))

    if (!prerequisitesMet) return

    unlockedQuestIds.push(quest.id)
    nextObjectiveProgress[quest.id] = nextObjectiveProgress[quest.id] || createQuestProgress(quest.id)
    changed = true
  })

  return {
    ...stateLike,
    unlockedQuestIds,
    objectiveProgress: changed ? nextObjectiveProgress : stateLike.objectiveProgress,
  }
}

// After unlocking new quests, backfill craft_item objectives from current inventory.
// Only runs for quests that were just newly unlocked (not on every event).
function backfillNewlyUnlockedQuests(stateLike, prevUnlockedIds) {
  const newlyUnlockedIds = stateLike.unlockedQuestIds.filter((id) => !prevUnlockedIds.includes(id))
  if (newlyUnlockedIds.length === 0) return stateLike

  const nextObjectiveProgress = { ...stateLike.objectiveProgress }
  let changed = false

  newlyUnlockedIds.forEach((questId) => {
    const current = nextObjectiveProgress[questId] || createQuestProgress(questId)
    const backfilled = backfillObjectivesFromInventory(questId, current)
    if (backfilled !== current) {
      nextObjectiveProgress[questId] = backfilled
      changed = true
    }
  })

  return changed ? { ...stateLike, objectiveProgress: nextObjectiveProgress } : stateLike
}

function completeEligibleQuests(stateLike) {
  const completedQuestIds = uniqueIds(stateLike.completedQuestIds)
  let changed = false

  stateLike.unlockedQuestIds.forEach((questId) => {
    if (completedQuestIds.includes(questId)) return
    if (!isQuestCompletedForState(questId, stateLike)) return

    completedQuestIds.push(questId)
    useProgressionStore.getState().completeQuest(questId)
    changed = true
  })

  return changed
    ? {
        ...stateLike,
        completedQuestIds,
      }
    : stateLike
}

function ensureActiveQuestId(stateLike) {
  const currentId = stateLike.activeQuestId
  if (currentId) {
    const quest = getQuestById(currentId)
    const stillValid =
      quest &&
      stateLike.unlockedQuestIds.includes(currentId) &&
      !stateLike.claimedQuestIds.includes(currentId)
    if (stillValid) return stateLike
  }

  const nextId = getFirstTrackableQuestId(stateLike)
  if (nextId === currentId) return stateLike

  if (import.meta.env.DEV) {
    console.log("[QuestStore] activeQuestId →", nextId, {
      from: currentId,
      unlockedQuestIds: stateLike.unlockedQuestIds,
      claimedQuestIds: stateLike.claimedQuestIds,
    })
  }

  return { ...stateLike, activeQuestId: nextId }
}

function buildInitialQuestState() {
  const progressionState = useProgressionStore.getState()
  const completedQuestIds = uniqueIds(progressionState.completedQuestIds || [])
  const claimedQuestIds = uniqueIds(progressionState.claimedQuestIds || [])
  const completedOrClaimedQuestIds = uniqueIds([...completedQuestIds, ...claimedQuestIds])
  const unlockedQuestIds = uniqueIds([...DEFAULT_UNLOCKED_QUEST_IDS, ...completedOrClaimedQuestIds])
  const objectiveProgress = createInitialObjectiveProgress(unlockedQuestIds)

  completedOrClaimedQuestIds.forEach((questId) => {
    objectiveProgress[questId] = createCompletedQuestProgress(questId)
  })

  const state = ensureActiveQuestId(
    unlockAvailableQuests({
      unlockedQuestIds,
      activeQuestId: getFirstActiveQuestId(unlockedQuestIds),
      completedQuestIds: completedOrClaimedQuestIds,
      claimedQuestIds,
      rewardClaimedQuestIds: claimedQuestIds,
      objectiveProgress,
    })
  )

  if (import.meta.env.DEV) {
    console.log("[QuestStore] init", {
      unlockedQuestIds: state.unlockedQuestIds,
      activeQuestId: state.activeQuestId,
      completedQuestIds: state.completedQuestIds,
      claimedQuestIds: state.claimedQuestIds,
    })
  }

  return state
}

function applyObjectiveEvent(stateLike, objectiveType, itemId, quantity = 1) {
  const safeQuantity = Math.max(0, Number(quantity) || 0)
  if (!itemId || safeQuantity <= 0) return stateLike

  const nextObjectiveProgress = { ...stateLike.objectiveProgress }
  let changed = false

  stateLike.unlockedQuestIds.forEach((questId) => {
    if (stateLike.completedQuestIds.includes(questId)) return

    const quest = getQuestById(questId)
    if (!quest) return

    const currentQuestProgress = [...getProgressForQuest(stateLike, questId)]

    getQuestObjectives(quest).forEach((objective, objectiveIndex) => {
      if (objective.type !== objectiveType) return
      if (objective.itemId !== itemId) return

      const target = getObjectiveTarget(objective)
      const current = Math.max(0, Number(currentQuestProgress[objectiveIndex]) || 0)
      const next = Math.min(target, current + safeQuantity)

      if (next === current) return

      currentQuestProgress[objectiveIndex] = next
      changed = true
    })

    nextObjectiveProgress[questId] = currentQuestProgress
  })

  if (!changed) return stateLike

  const progressedState = {
    ...stateLike,
    objectiveProgress: nextObjectiveProgress,
  }

  // Original pipeline: complete → unlock → ensure active
  const afterComplete = completeEligibleQuests(progressedState)
  const afterUnlock = unlockAvailableQuests(afterComplete)

  // If new quests became unlocked, backfill their craft_item objectives from
  // current inventory, then run completion check once more so a player who
  // already owned the required tools doesn't have to re-craft them.
  if (afterUnlock.unlockedQuestIds.length > afterComplete.unlockedQuestIds.length) {
    const afterBackfill = backfillNewlyUnlockedQuests(afterUnlock, afterComplete.unlockedQuestIds)
    if (afterBackfill !== afterUnlock) {
      return ensureActiveQuestId(completeEligibleQuests(afterBackfill))
    }
  }

  return ensureActiveQuestId(afterUnlock)
}

export const useQuestStore = create((set, get) => ({
  ...buildInitialQuestState(),

  setActiveQuest: (questId) => {
    const quest = getQuestById(questId)
    if (!quest) return false

    const state = get()
    if (!isQuestAvailableForSelection(state, questId)) return false

    set({ activeQuestId: questId })
    return true
  },

  recordCollectedItem: (itemId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.COLLECT_ITEM, itemId, quantity))
  },

  recordCraftedItem: (itemId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.CRAFT_ITEM, itemId, quantity))
  },

  recordDiscardedItem: (itemId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.DISCARD_ITEM, itemId, quantity))
  },

  recordMinedObject: (itemId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.MINE_OBJECT, itemId, quantity))
  },

  recordChoppedObject: (itemId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.CHOP_OBJECT, itemId, quantity))
  },

  recordPlantedCrop: (cropId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.PLANT_CROP, cropId, quantity))
  },

  recordWateredCrop: (cropId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.WATER_CROP, cropId, quantity))
  },

  recordHarvestedCrop: (cropId, quantity = 1) => {
    set((state) => applyObjectiveEvent(state, QUEST_OBJECTIVE_TYPES.HARVEST_CROP, cropId, quantity))
  },

  recordWorldInteraction: ({ type, sourceFamily, itemId }) => {
    if (!itemId) return
    let objectiveType = QUEST_OBJECTIVE_TYPES.WORLD_INTERACTION
    if (type === "chop" || type === "chop_complete" || sourceFamily === "tree") {
      objectiveType = QUEST_OBJECTIVE_TYPES.CHOP_OBJECT
    } else if (type === "mine" || type === "mine_complete" || sourceFamily === "rock") {
      objectiveType = QUEST_OBJECTIVE_TYPES.MINE_OBJECT
    }
    set((state) => applyObjectiveEvent(state, objectiveType, itemId, 1))
  },

  claimQuestRewards: (questId) => {
    const state = get()
    const quest = getQuestById(questId)
    if (!quest) return { success: false, reason: "missing_quest" }
    if (!state.completedQuestIds.includes(questId)) return { success: false, reason: "quest_not_completed" }
    if (state.claimedQuestIds.includes(questId)) return { success: false, reason: "quest_already_claimed" }

    const rewards = getQuestRewards(quest)

    // Route only item/capacity rewards to the inventory store
    const inventoryRewards = rewards.filter(
      (r) => r.type === QUEST_REWARD_TYPES.ITEM || r.type === QUEST_REWARD_TYPES.INVENTORY_CAPACITY
    )
    const inventoryResult = useInventoryStore.getState().applyQuestRewards(inventoryRewards)
    if (!inventoryResult.success) return inventoryResult

    const progressionStore = useProgressionStore.getState()

    // Character unlock rewards — idempotent, safe to call even if already unlocked
    rewards
      .filter((r) => r.type === QUEST_REWARD_TYPES.UNLOCK_CHARACTER && r.value)
      .forEach((r) => progressionStore.unlockCharacter(r.value))

    progressionStore.claimQuest(questId)

    set((currentState) => {
      const afterClaim = {
        ...currentState,
        claimedQuestIds: uniqueIds([...currentState.claimedQuestIds, questId]),
        rewardClaimedQuestIds: uniqueIds([...currentState.rewardClaimedQuestIds, questId]),
      }
      // Unlock quests whose prerequisites were just satisfied by this claim,
      // then pick a valid active quest from the expanded set.
      return ensureActiveQuestId(unlockAvailableQuests(afterClaim))
    })

    return { success: true }
  },

  resetQuestState: () => {
    useProgressionStore.getState().resetProgression()
    set(buildInitialQuestState())
  },
}))

export function getQuestSummaryById(questId, stateLike) {
  const quest = getQuestById(questId)
  if (!quest) return null

  return {
    ...quest,
    status: getQuestStatusForState(questId, stateLike),
    objectives: getQuestObjectiveProgressEntries(questId, stateLike),
    rewards: getQuestRewards(quest),
    rewardClaimed: stateLike.rewardClaimedQuestIds.includes(questId),
  }
}

export function hasClaimableQuestRewards(stateLike) {
  return stateLike.completedQuestIds.some((questId) => !stateLike.claimedQuestIds.includes(questId))
}

export function getActiveQuestSummary(stateLike) {
  if (!stateLike.activeQuestId) return null
  return getQuestSummaryById(stateLike.activeQuestId, stateLike)
}

export { QUEST_REWARD_TYPES }

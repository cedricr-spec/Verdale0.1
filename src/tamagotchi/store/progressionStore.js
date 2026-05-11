

import { create } from "zustand"

// Central progression store.
// This is the source of truth for unlocks and progression gates.
// Later we can persist this to Supabase / localStorage.

const DEFAULT_UNLOCKED_CHARACTER_IDS = [
  // Starter character id — replace with your real default character id if needed.
  "Bob","Gatito","Lil Devil", "Jordan", "Santa",
]

function uniqueAppend(list = [], value) {
  if (!value || list.includes(value)) return list
  return [...list, value]
}

export const useProgressionStore = create((set, get) => ({
  unlockedCharacterIds: DEFAULT_UNLOCKED_CHARACTER_IDS,
  completedQuestIds: [],
  claimedQuestIds: [],

  isCharacterUnlocked: (characterId) => {
    if (!characterId) return false
    return get().unlockedCharacterIds.includes(characterId)
  },

  isQuestCompleted: (questId) => {
    if (!questId) return false
    return get().completedQuestIds.includes(questId)
  },

  isQuestClaimed: (questId) => {
    if (!questId) return false
    return get().claimedQuestIds.includes(questId)
  },

  unlockCharacter: (characterId) => {
    if (!characterId) return

    set((state) => ({
      unlockedCharacterIds: uniqueAppend(state.unlockedCharacterIds, characterId),
    }))
  },

  completeQuest: (questId) => {
    if (!questId) return

    set((state) => ({
      completedQuestIds: uniqueAppend(state.completedQuestIds, questId),
    }))
  },

  claimQuest: (questId) => {
    if (!questId) return

    set((state) => ({
      completedQuestIds: uniqueAppend(state.completedQuestIds, questId),
      claimedQuestIds: uniqueAppend(state.claimedQuestIds, questId),
    }))
  },

  resetProgression: () => {
    set({
      unlockedCharacterIds: DEFAULT_UNLOCKED_CHARACTER_IDS,
      completedQuestIds: [],
      claimedQuestIds: [],
    })
  },
}))
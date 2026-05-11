// src/tamagotchi/config/characterPresentation.js

import { GRADES } from "./gradingConfig"

// Lock icons
import lockCommon from "../../hud/Locks/Lock_Icon.webp"
import lockGold from "../../hud/Locks/Lock_Icon_Gold.webp"
import lockEmerald from "../../hud/Locks/Lock_Icon_Emerald.webp"
import lockDiamond from "../../hud/Locks/Lock_Icon_Diamond.webp"

const CHARACTER_GRADE_SORT_ORDER = {
  [GRADES.COMMON]: 0,
  [GRADES.GOLD]: 1,
  [GRADES.EMERALD]: 2,
  [GRADES.DIAMOND]: 3,
}

// ─────────────────────────────────────────────
// Grade normalization
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ⚠️ TEMP TEST GRADES (REMOVE LATER)
// Allows forcing specific grades for some characters for UI testing
// ─────────────────────────────────────────────

const TEST_CHARACTER_GRADES = {
  [GRADES.GOLD]: ["Classy", "Zamy","Ahouu","Sbire", "Etchebest", "Incognito", "Merveille", "Bzzzee", "Tuby","Timmy",],
  [GRADES.EMERALD]: ["King", "Azazel", "Gims", "Sherriff", "Tv", "Randy", "Astronaut", "Alien", "Pô", "Olaf"],
  [GRADES.DIAMOND]: ["Faucheuse", "Hedwix", "Definitely-not-a-Bot", "Sharky", "Tino the Dino", "Mia"],
}

export function getCharacterGrade(character) {
  // TEMP override for testing
  if (character?.id) {
    for (const gradeKey in TEST_CHARACTER_GRADES) {
      if (TEST_CHARACTER_GRADES[gradeKey].includes(character.id)) {
        return gradeKey
      }
    }
  }

  const raw =
    character?.lockGrade ||
    character?.rarity ||
    character?.grade ||
    character?.tier ||
    GRADES.COMMON

  const value = String(raw).trim().toLowerCase()

  switch (value) {
    case "gold":
    case "or":
      return GRADES.GOLD

    case "emerald":
    case "emeraude":
    case "émeraude":
      return GRADES.EMERALD

    case "diamond":
    case "diamant":
      return GRADES.DIAMOND

    default:
      return GRADES.COMMON
  }
}

// ─────────────────────────────────────────────
// Lock icons mapping
// ─────────────────────────────────────────────

export const CHARACTER_LOCK_ICONS = {
  [GRADES.COMMON]: lockCommon,
  [GRADES.GOLD]: lockGold,
  [GRADES.EMERALD]: lockEmerald,
  [GRADES.DIAMOND]: lockDiamond,
}

export function getCharacterLockIcon(character) {
  const grade = getCharacterGrade(character)
  return CHARACTER_LOCK_ICONS[grade] || lockCommon
}


export function sortCharactersByProgression(characters = [], unlockedCharacterIds = []) {
  return characters
    .map((character, index) => ({ character, index }))
    .sort((a, b) => {
      const aUnlocked = unlockedCharacterIds.includes(a.character.id)
      const bUnlocked = unlockedCharacterIds.includes(b.character.id)

      if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1

      const aGrade = getCharacterGrade(a.character)
      const bGrade = getCharacterGrade(b.character)
      const aGradeOrder = CHARACTER_GRADE_SORT_ORDER[aGrade] ?? 0
      const bGradeOrder = CHARACTER_GRADE_SORT_ORDER[bGrade] ?? 0

      if (aGradeOrder !== bGradeOrder) return aGradeOrder - bGradeOrder

      return a.index - b.index
    })
    .map(({ character }) => character)
}
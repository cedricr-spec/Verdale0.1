

import { GRADES } from "./gradingConfig"

// Normalize grade coming from quest JSON
export function getQuestGrade(quest) {
  const value = String(quest?.grade || GRADES.COMMON).toLowerCase()

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

// Optional: central place for quest UI styling
export function getQuestPresentation(quest) {
  const grade = getQuestGrade(quest)

  switch (grade) {
    case GRADES.GOLD:
      return {
        grade,
        className: "quest--gold",
      }

    case GRADES.EMERALD:
      return {
        grade,
        className: "quest--emerald",
      }

    case GRADES.DIAMOND:
      return {
        grade,
        className: "quest--diamond",
      }

    default:
      return {
        grade,
        className: "quest--common",
      }
  }
}
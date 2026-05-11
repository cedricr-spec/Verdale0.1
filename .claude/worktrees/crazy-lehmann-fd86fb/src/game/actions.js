// 🔥 Game actions config (data-driven gameplay system)
export const ACTIONS = [
  {
    id: "burger",
    label: "Burger",
    icon: "🍔",
    type: "feed",
    effects: { hunger: +12, health: -2, happiness: +4 },
    cooldown: 10,
    tags: ["food", "junk"],
    condition: (state) => state.hunger < 95
  },
  {
    id: "apple",
    label: "Apple",
    icon: "🍎",
    type: "feed",
    effects: { hunger: +6, health: +3 },
    cooldown: 6,
    tags: ["food", "healthy"],
    condition: (state) => state.hunger < 100
  },
  {
    id: "donut",
    label: "Donut",
    icon: "🍩",
    type: "feed",
    effects: { hunger: +10, health: -1, happiness: +3 },
    cooldown: 8,
    tags: ["food", "junk"],
    condition: (state) => state.hunger < 95
  },
  {
    id: "pizza",
    label: "Pizza",
    icon: "🍕",
    type: "feed",
    effects: { hunger: +14, health: -3, happiness: +5 },
    cooldown: 12,
    tags: ["food", "junk"],
    condition: (state) => state.hunger < 90
  },
  {
    id: "sleep",
    label: "Sleep",
    icon: "😴",
    type: "sleep",
    effects: { energy: +15 },
    cooldown: 12,
    tags: ["rest"],
    condition: (state) => state.energy < 90
  }
  ,{
    id: "salad",
    label: "Salad",
    icon: "🥗",
    type: "feed",
    effects: { hunger: +8, health: +5 },
    cooldown: 8,
    tags: ["food", "healthy"],
    condition: (state) => state.hunger < 100
  },
  {
    id: "candy",
    label: "Candy",
    icon: "🍬",
    type: "feed",
    effects: { hunger: +6, happiness: +6, health: -3 },
    cooldown: 7,
    tags: ["food", "junk"],
    condition: (state) => state.hunger < 95
  },
  {
    id: "play_game",
    label: "Play",
    icon: "🕹️",
    type: "play",
    effects: { happiness: +14, energy: -7 },
    cooldown: 10,
    tags: ["fun"],
    condition: (state) => state.energy > 15
  },
  {
    id: "music",
    label: "Music",
    icon: "🎵",
    type: "play",
    effects: { happiness: +8, health: +2 },
    cooldown: 9,
    tags: ["fun"],
    condition: (state) => state.energy > 5
  },
  {
    id: "training",
    label: "Training",
    icon: "🏋️",
    type: "play",
    effects: { health: +6, energy: -10 },
    cooldown: 12,
    tags: ["fun", "hard"],
    condition: (state) => state.energy > 20
  },
  {
    id: "nap",
    label: "Nap",
    icon: "🛌",
    type: "sleep",
    effects: { energy: +8 },
    cooldown: 6,
    tags: ["rest"],
    condition: (state) => state.energy < 95
  },
  {
    id: "meditate",
    label: "Meditate",
    icon: "🧘",
    type: "sleep",
    effects: { energy: +6, health: +4 },
    cooldown: 10,
    tags: ["rest"],
    condition: (state) => state.energy < 90
  },
  {
    id: "clean",
    label: "Clean",
    icon: "🧼",
    type: "care",
    effects: { happiness: +6, health: +3 },
    cooldown: 8,
    tags: ["care"],
    condition: () => true
  },
  {
    id: "heal",
    label: "Heal",
    icon: "💊",
    type: "care",
    effects: { health: +12 },
    cooldown: 14,
    tags: ["care"],
    condition: (state) => state.health < 100
  }
];

// Optional: future combos (not used yet)
export const COMBOS = [
  {
    id: "junk_then_sleep",
    requiresTags: ["junk", "rest"],
    effect: { happiness: +8 },
    cooldown: 10,
    feedback: "Comfort combo 🍕😴"
  }
];

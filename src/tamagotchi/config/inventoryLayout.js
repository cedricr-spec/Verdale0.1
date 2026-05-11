const SLOT_SIZE = 32

export const PLAYER_INVENTORY_UI_LAYOUT = {
  desktop: {
    columnGap: 24,
    rowGap: 10,
  },
  mobile: {
    rowGap: 12,
  },
  actionSlots: {
    width: 320,
    height: 32,
    slotSize: SLOT_SIZE,
    x: 80,
    y: 0,
    columns: 5,
  },
  inventory: {
    width: 320,
    height: 256,
    slotSize: SLOT_SIZE,
    x: 16,
    y: 48,
    columns: 9,
    rows: 6,
  },
  craft: {
    width: 320,
    height: 160,
    slotSize: SLOT_SIZE,
    grid: {
      x: 16,
      y: 48,
      columns: 3,
      rows: 3,
    },
    result: {
      x: 144,
      y: 80,
      size: SLOT_SIZE,
    },
    recipes: {
      left: 224,
      top: 48,
      width: 80,
      height: 96,
      right: 16,
      bottom: 16,
    },
  },
}

export const PLAYER_INVENTORY_USABLE_SLOT_COUNT =
  PLAYER_INVENTORY_UI_LAYOUT.actionSlots.columns
export const PLAYER_INVENTORY_MAIN_SLOT_COUNT =
  PLAYER_INVENTORY_UI_LAYOUT.inventory.columns * PLAYER_INVENTORY_UI_LAYOUT.inventory.rows
export const PLAYER_INVENTORY_CRAFT_SLOT_COUNT =
  PLAYER_INVENTORY_UI_LAYOUT.craft.grid.columns * PLAYER_INVENTORY_UI_LAYOUT.craft.grid.rows
export const PLAYER_INVENTORY_MAX_VISUAL_CAPACITY =
  PLAYER_INVENTORY_USABLE_SLOT_COUNT + PLAYER_INVENTORY_MAIN_SLOT_COUNT

function createRect(left, top, width = SLOT_SIZE, height = SLOT_SIZE) {
  return {
    left,
    top,
    width,
    height,
  }
}

function buildGridRects({ x, y, columns, rows, slotSize = SLOT_SIZE }) {
  return Array.from({ length: columns * rows }, (_, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)

    return createRect(x + col * slotSize, y + row * slotSize, slotSize, slotSize)
  })
}

export const PLAYER_INVENTORY_SLOT_RECTS = {
  usable: Array.from(
    { length: PLAYER_INVENTORY_UI_LAYOUT.actionSlots.columns },
    (_, index) =>
      createRect(
        PLAYER_INVENTORY_UI_LAYOUT.actionSlots.x +
          index * PLAYER_INVENTORY_UI_LAYOUT.actionSlots.slotSize,
        PLAYER_INVENTORY_UI_LAYOUT.actionSlots.y,
        PLAYER_INVENTORY_UI_LAYOUT.actionSlots.slotSize,
        PLAYER_INVENTORY_UI_LAYOUT.actionSlots.slotSize
      )
  ),
  main: buildGridRects(PLAYER_INVENTORY_UI_LAYOUT.inventory),
  craft: buildGridRects(PLAYER_INVENTORY_UI_LAYOUT.craft.grid),
  result: [
    createRect(
      PLAYER_INVENTORY_UI_LAYOUT.craft.result.x,
      PLAYER_INVENTORY_UI_LAYOUT.craft.result.y,
      PLAYER_INVENTORY_UI_LAYOUT.craft.result.size,
      PLAYER_INVENTORY_UI_LAYOUT.craft.result.size
    ),
  ],
}

export function getInventorySlotRect(area, index) {
  return PLAYER_INVENTORY_SLOT_RECTS[area]?.[index] || null
}

export function getInventorySlotStyle(area, index) {
  const rect = getInventorySlotRect(area, index)
  if (!rect) return null

  return {
    position: "absolute",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
}

export function getCraftRecipePanelStyle() {
  const { recipes } = PLAYER_INVENTORY_UI_LAYOUT.craft

  return {
    position: "absolute",
    left: `${recipes.left}px`,
    top: `${recipes.top}px`,
    width: `${recipes.width}px`,
    height: `${recipes.height}px`,
  }
}

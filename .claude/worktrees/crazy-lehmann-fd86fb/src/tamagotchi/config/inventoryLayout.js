export const INVENTORY_LAYOUT = {
  canvasWidth: 212,
  canvasHeight: 224,
  slotSize: 36,
  usable: {
    count: 5,
    gap: 2,
    left: 12,
    right: 12,
    bottom: 12,
  },
  main: {
    rows: 2,
    cols: 5,
    gapX: 2,
    gapY: 2,
    left: 12,
    right: 12,
    aboveUsable: 8,
  },
  craft: {
    rows: 2,
    cols: 2,
    gapX: 2,
    gapY: 2,
    left: 12,
    top: 12,
  },
  result: {
    right: 50,
    top: 31,
  },
}

function toPercentX(value) {
  return `${(value / INVENTORY_LAYOUT.canvasWidth) * 100}%`
}

function toPercentY(value) {
  return `${(value / INVENTORY_LAYOUT.canvasHeight) * 100}%`
}

function createRect(left, top) {
  return {
    left,
    top,
    width: INVENTORY_LAYOUT.slotSize,
    height: INVENTORY_LAYOUT.slotSize,
  }
}

function buildUsableRects() {
  const { usable, canvasHeight, slotSize } = INVENTORY_LAYOUT
  const top = canvasHeight - usable.bottom - slotSize

  return Array.from({ length: usable.count }, (_, index) =>
    createRect(usable.left + index * (slotSize + usable.gap), top)
  )
}

function buildMainRects() {
  const { main, slotSize } = INVENTORY_LAYOUT
  const usableTop = INVENTORY_LAYOUT.canvasHeight - INVENTORY_LAYOUT.usable.bottom - slotSize
  const mainHeight = main.rows * slotSize + (main.rows - 1) * main.gapY
  const top = usableTop - main.aboveUsable - mainHeight

  return Array.from({ length: main.rows * main.cols }, (_, index) => {
    const col = index % main.cols
    const row = Math.floor(index / main.cols)

    return createRect(
      main.left + col * (slotSize + main.gapX),
      top + row * (slotSize + main.gapY)
    )
  })
}

function buildCraftRects() {
  const { craft, slotSize } = INVENTORY_LAYOUT

  return Array.from({ length: craft.rows * craft.cols }, (_, index) => {
    const col = index % craft.cols
    const row = Math.floor(index / craft.cols)

    return createRect(
      craft.left + col * (slotSize + craft.gapX),
      craft.top + row * (slotSize + craft.gapY)
    )
  })
}

export const INVENTORY_SLOT_RECTS = {
  usable: buildUsableRects(),
  main: buildMainRects(),
  craft: buildCraftRects(),
  result: [
    createRect(
      INVENTORY_LAYOUT.canvasWidth -
        INVENTORY_LAYOUT.result.right -
        INVENTORY_LAYOUT.slotSize,
      INVENTORY_LAYOUT.result.top
    ),
  ],
}

export function getInventorySlotRect(area, index) {
  return INVENTORY_SLOT_RECTS[area]?.[index] || null
}

export function getInventorySlotStyle(area, index) {
  const rect = getInventorySlotRect(area, index)
  if (!rect) return null

  return {
    position: "absolute",
    left: toPercentX(rect.left),
    top: toPercentY(rect.top),
    width: toPercentX(rect.width),
    height: toPercentY(rect.height),
  }
}

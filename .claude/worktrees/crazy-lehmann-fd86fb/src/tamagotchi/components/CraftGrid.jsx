import React from "react"
import { getInventorySlotStyle } from "../config/inventoryLayout"
import InventorySlot from "./InventorySlot"

export default function CraftGrid({
  craftSlots,
  craftResult,
  dragSourceKey,
  dropTargetKey,
  onSlotPointerDown,
  onResultClick,
}) {
  return (
    <>
      {craftSlots.map((stack, index) => {
        const slotKey = `craft:${index}`

        return (
          <InventorySlot
            key={slotKey}
            slotKey={slotKey}
            stack={stack}
            style={getInventorySlotStyle("craft", index)}
            isDragSource={dragSourceKey === slotKey}
            isDropTarget={dropTargetKey === slotKey}
            onPointerDown={(event) => onSlotPointerDown(event, "craft", index, stack)}
          />
        )
      })}

      <InventorySlot
        slotKey="result:0"
        slotType="result"
        stack={craftResult}
        style={getInventorySlotStyle("result", 0)}
        isDropTarget={dropTargetKey === "result:0"}
        onClick={onResultClick}
      />
    </>
  )
}

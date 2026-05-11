import React, { useEffect, useState } from "react"
import { getInventoryErrorMessage, useInventoryStore } from "../store/useInventoryStore"

const NOTICE_DURATION_MS = 2200

export default function InventoryNoticeToast() {
  const lastInventoryError = useInventoryStore((state) => state.lastInventoryError)
  const lastInventoryErrorNonce = useInventoryStore((state) => state.lastInventoryErrorNonce)
  const clearLastInventoryError = useInventoryStore((state) => state.clearLastInventoryError)
  const [visibleError, setVisibleError] = useState(lastInventoryError)

  useEffect(() => {
    if (!lastInventoryError) return undefined

    setVisibleError(lastInventoryError)

    const timeoutId = window.setTimeout(() => {
      setVisibleError(null)
      clearLastInventoryError()
    }, NOTICE_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [clearLastInventoryError, lastInventoryError, lastInventoryErrorNonce])

  const message = getInventoryErrorMessage(visibleError)
  if (!message) return null

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "96px",
        transform: "translateX(-50%)",
        zIndex: 10002,
        padding: "10px 14px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10, 10, 10, 0.9)",
        color: "#fff",
        fontSize: "12px",
        lineHeight: 1.35,
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        pointerEvents: "none",
        textAlign: "center",
        maxWidth: "min(420px, calc(100vw - 32px))",
      }}
    >
      {message}
    </div>
  )
}

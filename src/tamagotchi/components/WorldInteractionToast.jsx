import React, { useEffect, useState } from "react"
import { useBrokenObjectsStore } from "../store/brokenObjectsStore"

const TOAST_DURATION_MS = 1800

export default function WorldInteractionToast() {
  const worldFeedback = useBrokenObjectsStore((s) => s.worldFeedback)
  const worldFeedbackNonce = useBrokenObjectsStore((s) => s.worldFeedbackNonce)
  const [visibleMessage, setVisibleMessage] = useState(null)

  useEffect(() => {
    if (!worldFeedback) return undefined

    setVisibleMessage(worldFeedback)

    const timeoutId = window.setTimeout(() => {
      setVisibleMessage(null)
    }, TOAST_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [worldFeedback, worldFeedbackNonce])

  if (!visibleMessage) return null

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "130px",
        transform: "translateX(-50%)",
        zIndex: 10003,
        padding: "9px 14px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10, 10, 10, 0.9)",
        color: "#fff",
        fontSize: "12px",
        lineHeight: 1.35,
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        pointerEvents: "none",
        textAlign: "center",
        maxWidth: "min(320px, calc(100vw - 32px))",
        whiteSpace: "nowrap",
      }}
    >
      {visibleMessage}
    </div>
  )
}

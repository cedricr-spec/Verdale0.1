import React, { useMemo } from "react"
import Star from "./Star"
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}
export default function StarsField({ color, seed }) {
  const stars = useMemo(() => {
    const arr = []

    for (let i = 0; i < 35; i++) {
  let x = (seededRandom(seed + i * 1) - 0.5) * 10
let y = (seededRandom(seed + i * 2) - 0.5) * 6

// push hors du centre si trop proche
const dist = Math.sqrt(x * x + y * y)
if (dist < 1.5) {
  const angle = seededRandom(seed + i * 6) * Math.PI * 2
  x = Math.cos(angle) * 1.5
  y = Math.sin(angle) * 1.5
}

  arr.push({
    position: [
      x,
      y,
      (seededRandom(seed + i * 3) - 0.5) * 4
    ],
        size: seededRandom(seed + i * 4) * 0.6 + 0.3,
        variant: seededRandom(seed + i * 5) > 0.5 ? 1 : 2
      })
    }

    return arr
  }, [seed])

  return (
    <>
      {stars.map((star, i) => (
        <Star
        color={color}
          key={i}
          position={star.position}
          size={star.size}
          variant={star.variant}
        />
      ))}
    </>
  )
}
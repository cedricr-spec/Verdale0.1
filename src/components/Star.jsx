import React, { useRef } from "react"
import { useTexture } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"

export default function Star({
  position = [0, 0, 0],
  size = 0.6,
  speed = 3,
  variant = 1, // 👈 1 ou 2
  color = "#ffffff"
}) {
  const textures = useTexture(
    variant === 1
      ? [
          "/stars/star_1_1.svg",
          "/stars/star_1_2.svg",
          "/stars/star_1_3.svg"
        ]
      : [
          "/stars/star_2_1.svg",
          "/stars/star_2_2.svg",
          "/stars/star_2_3.svg"
        ]
  )

  const meshRef = useRef()
  const offset = useRef(Math.random() * 10)

  useFrame((state) => {
    const t =
      Math.floor((state.clock.elapsedTime + offset.current) * speed) %
      textures.length

    if (meshRef.current) {
      meshRef.current.material.map = textures[t]
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      {/* ratio 0.6:1 */}
      <planeGeometry args={[size * 0.6, size]} />
      
      <meshBasicMaterial
        transparent
        color={color}
        depthWrite={false}
      />
    </mesh>
  )
}
import React, { useRef, useEffect, useState } from "react";
import { useGLTF, Environment, useTexture, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import StarsField from "./components/StarsField";
import PetScreen from "./tamagotchi/components/PetScreen";
import JaugesPanel from "./tamagotchi/components/JaugesPanel";
import { usePetStore } from "./tamagotchi/store/usePetstore";

function getMeshBounds(root) {
  const meshBox = new THREE.Box3();
  const childBox = new THREE.Box3();
  const hasMesh = { current: false };
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh) return;
    hasMesh.current = true;
    childBox.setFromObject(child);
    meshBox.union(childBox);
  });
  return hasMesh.current ? meshBox : new THREE.Box3().setFromObject(root);
}

export default function Scene({ starsSeed, mode }) {
  const group = useRef();
  const { camera, gl } = useThree();

  const { scene } = useGLTF("/tamagotchi_model.glb");

  const [colorMap, normalMap, roughnessMap] = useTexture([
    "/textures/tamagotchi_bake_color.png",
    "/textures/bake_normal_tamagotchi.png",
    "/textures/bake_roughness_tamagotchi.png",
  ]);

  const [sticker1, setSticker1] = useState(null);
  const [sticker2, setSticker2] = useState(null);



  // 🎨 COLORS (store)
  const modelColor = usePetStore((state) => state.theme.modelColor);
  const starsColor = usePetStore((s) => s.theme.starsColor);
  const debugUI = usePetStore((s) => s.debugUI);


  // 🕹️ ACTION HOOKS
  const feed = usePetStore((s) => s.feed);
  const play = usePetStore((s) => s.play);
  const sleep = usePetStore((s) => s.sleep);

  // 👉 refs
  const sticker1Ref = useRef(null);
  const sticker2Ref = useRef(null);
  const screenMeshRef = useRef(null);
  const screenAnchorRef = useRef(null);
  const screenGroupRef = useRef(null);
  const screenBasePosRef = useRef(new THREE.Vector3());

  // 🎛️ MANUAL SCREEN CONTROLS (EDIT THESE)
  const isFullscreen = mode === "fullscreen";

  const [fsOpen, setFsOpen] = useState(false);

  useEffect(() => {
    if (isFullscreen) {
      setFsOpen(false);
      requestAnimationFrame(() => setFsOpen(true));
    } else {
      setFsOpen(false);
    }
  }, [isFullscreen]);

  const screenPosition = isFullscreen
    ? [0, 0.1, 0.2] // 🔥 better centered visually
    : [0, 0.563, 0.05];

  const screenRotation = [0, 0, 0];

  const screenScale = isFullscreen
    ? 5 // 🔥 bigger + more visible
    : 2.15;

  // upload hooks
  useEffect(() => {
    window.uploadSticker1 = (file) => {
      const url = URL.createObjectURL(file);
      const tex = new THREE.TextureLoader().load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      tex.center.set(0.5, 0.5);
      tex.rotation = 0;

      sticker1Ref.current = tex;
      setSticker1(tex);
    };

    window.uploadSticker2 = (file) => {
      const url = URL.createObjectURL(file);
      const tex = new THREE.TextureLoader().load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      tex.center.set(0.5, 0.5);
      tex.rotation = 0;

      sticker2Ref.current = tex;
      setSticker2(tex);
    };

    // 👉 rotation handlers (FIX principal)
    window.setSticker1Rotation = (value) => {
      const tex = sticker1Ref.current;
      if (tex) {
        tex.rotation = value;
        tex.needsUpdate = true;
      }
    };

    window.setSticker2Rotation = (value) => {
      const tex = sticker2Ref.current;
      if (tex) {
        tex.rotation = value;
        tex.needsUpdate = true;
      }
    };

    // 🎨 PET COLOR HANDLER
    

    return () => {
      delete window.uploadSticker1;
      delete window.uploadSticker2;
      delete window.setSticker1Rotation;
      delete window.setSticker2Rotation;
      delete window.setPetColor;
    };
  }, []);

  // 🔧 Allow DOM clicks above canvas
  useEffect(() => {
    if (gl && gl.domElement) {
      gl.domElement.style.pointerEvents = "none";
      gl.domElement.style.zIndex = "0"; // ensure canvas stays behind UI
      gl.domElement.style.position = "relative";
    }
  }, [gl]);

  colorMap.colorSpace = THREE.SRGBColorSpace;
  normalMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.colorSpace = THREE.NoColorSpace;

  colorMap.flipY = false;
  normalMap.flipY = false;
  roughnessMap.flipY = false;

  useEffect(() => {
    if (!scene) return;

    scene.traverse((child) => {
      if (!child.isMesh) return;
      const mat = child.material;
      if (!mat) return;

      const applyColor = (m) => {
        if (!m) return;

        // ensure valid color
        const safeColor = modelColor || "#ffffff";

        m.color.set(safeColor);
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;

        m.needsUpdate = true;
      };

      const name = child.name?.toLowerCase() || "";

      // 🔥 SCREEN DETECTION (robust)
      if (name.includes("screen") || name.includes("display") || name.includes("monitor")) {
        screenMeshRef.current = child;

        // 🚨 HIDE original mesh (so Html is visible)
        child.visible = false;

        return;
      }

      if (name.includes("sticker_1")) {
        if (!sticker1) {
          mat.map = null;
          mat.opacity = 0;
        } else {
          mat.map = sticker1;
          mat.opacity = 1;
          mat.map.needsUpdate = true;
        }

        mat.transparent = true;
        mat.alphaTest = 0.01;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.roughness = 1;

        mat.needsUpdate = true;
        return;
      }

      if (name.includes("sticker_2")) {
        if (!sticker2) {
          mat.map = null;
          mat.opacity = 0;
        } else {
          mat.map = sticker2;
          mat.opacity = 1;
          mat.map.needsUpdate = true;
        }

        mat.transparent = true;
        mat.alphaTest = 0.01;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
        mat.polygonOffset = true;
        mat.polygonOffsetFactor = -1;
        mat.roughness = 1;

        mat.needsUpdate = true;
        return;
      }

      mat.map = colorMap;
      mat.normalMap = normalMap;
      mat.roughnessMap = roughnessMap;

      mat.transparent = false;
      mat.opacity = 1;
      mat.alphaTest = 0;

      // 🎨 APPLY COLOR MULTIPLIER
      if (Array.isArray(mat)) {
        mat.forEach(applyColor);
      } else {
        applyColor(mat);
      }

      mat.roughness = 1;
      mat.normalScale = new THREE.Vector2(0.25, 0.25);

      mat.depthWrite = true;
      mat.needsUpdate = true;
    });

    if (!group.current.userData.initialized) {
      const box = getMeshBounds(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      group.current.position.set(-center.x, -center.y, -center.z);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 1.5 / maxDim;
      group.current.userData.baseScale = scale;
      group.current.scale.setScalar(scale);

      group.current.userData.initialized = true;
    }

    camera.position.set(0, 0.1, 3);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // store base screen position
    screenBasePosRef.current.set(
      screenPosition[0],
      screenPosition[1],
      screenPosition[2]
    );
  }, [scene, colorMap, normalMap, roughnessMap, sticker1, sticker2, modelColor, mode]);

  useFrame((state, delta) => {
    if (!group.current) return;

    const t = state.clock.elapsedTime;
    const base = group.current.userData.baseScale || 1;
    const breath = 1 + Math.sin(t * 2) * 0.015;
    group.current.scale.setScalar(base * breath);

    // 🎯 FIX ORBIT (smooth + correct direction)
    const damping = 5;

    if (isFullscreen) {
      // 🔥 reset + lock rotation
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        0,
        1 - Math.exp(-damping * delta)
      );

      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        0,
        1 - Math.exp(-damping * delta)
      );
    } else {
      const targetY = state.mouse.x * 0.25;
      const targetX = -state.mouse.y * 0.15;

      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        targetY,
        1 - Math.exp(-damping * delta)
      );

      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetX,
        1 - Math.exp(-damping * delta)
      );
    }

    if (screenGroupRef.current) {
      if (isFullscreen) {
        // 🔥 force fixed position in fullscreen (no drift)
        screenGroupRef.current.position.x = screenPosition[0];
        screenGroupRef.current.position.y = screenPosition[1];
      } else {
        const posStrength = 0.037;
        const deadzone = 0.05;

        const mx = Math.abs(state.mouse.x) < deadzone ? 0 : state.mouse.x;
        const my = Math.abs(state.mouse.y) < deadzone ? 0 : state.mouse.y;

        const targetX = screenBasePosRef.current.x + mx * posStrength;
        const targetY = screenBasePosRef.current.y + my * posStrength * 0.62; // less vertical movement

        const damping = 5;

        screenGroupRef.current.position.x = THREE.MathUtils.lerp(
          screenGroupRef.current.position.x,
          targetX,
          1 - Math.exp(-damping * delta)
        );

        screenGroupRef.current.position.y = THREE.MathUtils.lerp(
          screenGroupRef.current.position.y,
          targetY,
          1 - Math.exp(-damping * delta)
        );
      }
    }
  });

  return (
    <>
      {!debugUI && (
        <>
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <Environment files="/hdri.exr" background={false} blur={0.2} />
          <StarsField color={starsColor} seed={starsSeed} />
        </>
      )}

      <group ref={group}>
        <primitive object={scene} visible={!debugUI && mode !== "fullscreen"} />

        {!debugUI && !isFullscreen && (
          <group
            ref={screenGroupRef}
            position={screenPosition}
            rotation={screenRotation}
            scale={[screenScale, screenScale, screenScale]}
          >
            <Html
              transform
              center
              occlude={false}
              distanceFactor={0.4}
              zIndexRange={[1000, 0]}
              style={{
                width: "200px",
                height: "200px",
                pointerEvents: "auto",
                overflow: "hidden",
                borderRadius: "28px",
                clipPath: "inset(0 round 28px)",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PetScreen />
            </Html>
          </group>
        )}

        {/* --- END UI BUTTONS GROUP --- */}

      </group>
      {/* Fullscreen Html is now outside the 3D group and attached to document.body */}
      {!debugUI && isFullscreen && (
        <Html
          portal={document.body}
          prepend
          style={{
            position: "fixed",
            top: "27%", // Tweak fullscreen vertical placement here.
            left: "50%",
            transform: "translate(-50%, -62%)",
            pointerEvents: "auto",
            zIndex: 999999
          }}
        >
          {/* Tweak fullscreen shell height here. */}
          <div style={{
            width: "clamp(320px, 78vw, 860px)", // Tweak fullscreen shell width here.
            padding: "clamp(6px, 0.2vw, 12px)", // 🔥 breathing space on small screens
            height: "clamp(360px, 60vh, 720px)", // Tweak fullscreen shell height here.
            borderRadius: "24px",
            background: "rgba(255, 255, 255, 0.08)", // 🔥 glass base
            backdropFilter: "blur(20px)", // 🔥 glass blur
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.15)", // subtle edge
            boxShadow: "0 20px 80px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            transform: `scale(${fsOpen ? 1 : 0.85})`,
            transition: "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform"
          }}>
            {/* 🔥 glass overlay ABOVE screen */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "url('/src/hud/Overlay_Glass.webp') center / cover no-repeat",
              opacity: 1,
              pointerEvents: "none",
              zIndex: 100
            }} />

            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px",
              overflow: "hidden",
              background: "black", // 🔥 solid black screen base
              position: "relative",
              zIndex: 1
            }}>
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between"
            }}>

              {/* GAME SCREEN */}
              <div style={{
                flex: 1,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                isolation: "isolate"
              }}>
                <div style={{
                  position: "relative",
                  zIndex: 1,
                  width: "100%",
                  height: "100%"
                }}>
                  <PetScreen />
                </div>

                {/* JAUGES OVERLAY FULL WIDTH */}
                <div style={{
  position: "absolute",
  top: "8px",
  left: 0,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  pointerEvents: "auto",
  zIndex: 20
}}>
  <div style={{
    width: "min(340px, calc(100% - 24px))", // tweak largeur réelle du bloc de jauges ici
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    margin: "0 auto",
  }}>
    <JaugesPanel embedded />
  </div>
</div>
              </div>


            </div>
            </div>
          </div>
        </Html>
      )}
      {/* UI components removed: Scene is now 3D-only */}
      {debugUI && (
        <Html fullscreen style={{ pointerEvents: "none", zIndex: 9999 }}>
          {/* MAIN FRAME */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "400px",
              height: "120px",
              background: "rgba(255,0,0,0.4)",
              pointerEvents: "none"
            }}
          />

          {/* LEFT BLOCK */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "calc(50% - 180px)",
              width: "80px",
              height: "120px",
              background: "rgba(0,255,0,0.4)",
              pointerEvents: "none"
            }}
          />

          {/* RIGHT BLOCK */}
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "calc(50% + 100px)",
              width: "80px",
              height: "120px",
              background: "rgba(0,0,255,0.4)",
              pointerEvents: "none"
            }}
          />
        </Html>
      )}
    </>
  );
}

useGLTF.preload("/tamagotchi_model.glb");

import React, { useRef, useEffect, useState } from "react";
import { useGLTF, Environment, useTexture, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import StarsField from "./components/StarsField";
import PetScreen from "./tamagotchi/components/PetScreen";
import { usePetStore } from "./tamagotchi/store/usePetStore";

function getMeshBounds(root) {
  const meshBox = new THREE.Box3();
  const childBox = new THREE.Box3();
  const hasMesh = { current: false };

  root.updateWorldMatrix(true, true);
  const inverseRootMatrix = root.matrixWorld.clone().invert();

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;

    hasMesh.current = true;

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    child.updateWorldMatrix(true, false);
    childBox
      .copy(child.geometry.boundingBox)
      .applyMatrix4(child.matrixWorld)
      .applyMatrix4(inverseRootMatrix);

    meshBox.union(childBox);
  });

  return hasMesh.current ? meshBox : new THREE.Box3().setFromObject(root);
}

export default function Scene({ starsSeed, mode }) {
  const group = useRef();
  const modelWrapperRef = useRef();
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
    : [0, 0.568, 0.05];

  const screenRotation = [0, 0, 0];

  const modelWrapperPosition = [0, 0.1, 0];
  const modelWrapperScale = 1.75;

  const screenScale = isFullscreen
    ? 5 // 🔥 bigger + more visible
    : 2.05;

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

    const box = getMeshBounds(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    group.current.position.set(-center.x, -center.y, -center.z);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.5 / maxDim;
    group.current.userData.baseScale = scale;
    group.current.scale.setScalar(scale);

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

    const base = group.current.userData.baseScale || 1;
    group.current.scale.setScalar(base);

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

    if (modelWrapperRef.current) {
      modelWrapperRef.current.position.set(...modelWrapperPosition);
      modelWrapperRef.current.scale.setScalar(modelWrapperScale);
    }
  });

  return (
    <>
      {!debugUI && (
        <>
          <ambientLight intensity={1.2} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          {!isFullscreen ? (
            <>
              <Environment files="/hdri.exr" background={false} blur={0.2} />
              <StarsField color={starsColor} seed={starsSeed} />
            </>
          ) : null}
        </>
      )}

      <group ref={modelWrapperRef} position={modelWrapperPosition} scale={[modelWrapperScale, modelWrapperScale, modelWrapperScale]}>
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
                width: "220px",
                height: "220px",
                pointerEvents: "auto",
                overflow: "hidden",
                borderRadius: "35px",
                clipPath: "inset(0 round 35px)",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  transformOrigin: "center center",
                }}
              >
                <PetScreen />
              </div>
            </Html>
          </group>
        )}

        {/* --- END UI BUTTONS GROUP --- */}

        </group>
      </group>
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

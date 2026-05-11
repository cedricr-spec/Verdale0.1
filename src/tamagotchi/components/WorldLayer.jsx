import React from "react";
import WorldAtlasLayer from "./WorldAtlasLayer";
import WorldInteractionFxLayer from "./WorldInteractionFxLayer";

export default function WorldLayer({ viewportFrame }) {
  return (
    <>
      <WorldAtlasLayer viewportFrame={viewportFrame} />
      <WorldInteractionFxLayer viewportFrame={viewportFrame} />
    </>
  );
}

import React, { useMemo } from "react";
import { useWorldStore } from "../store/worldSlice";
import { getTreesAround, getGrassAround, getRocksAround, getFlowersAround } from "../utils/decorGenerator";

import tree1 from "../../spritesheets/trees/tree1.webp";
import tree2 from "../../spritesheets/trees/tree2.webp";
import tree3 from "../../spritesheets/trees/tree3.webp";
import tree4 from "../../spritesheets/trees/tree4.webp";
import tree5 from "../../spritesheets/trees/tree5.webp";
import tree6 from "../../spritesheets/trees/tree6.webp";
import tree7 from "../../spritesheets/trees/tree7.webp";
import tree8 from "../../spritesheets/trees/tree8.webp";

import grass1 from "../../spritesheets/bushes-grass/grass1.webp";
import grass2 from "../../spritesheets/bushes-grass/grass2.webp";
import grass3 from "../../spritesheets/bushes-grass/grass3.webp";
import grass4 from "../../spritesheets/bushes-grass/grass4.webp";
import grass5 from "../../spritesheets/bushes-grass/grass5.webp";
import grass6 from "../../spritesheets/bushes-grass/grass6.webp";
import grass7 from "../../spritesheets/bushes-grass/grass7.webp";

import bigrock1 from "../../spritesheets/rocks/bigrock1.webp";
import rock1 from "../../spritesheets/rocks/rock1.webp";
import rock2 from "../../spritesheets/rocks/rock2.webp";

import flower1 from "../../spritesheets/flowers/flower1.webp";
import flower2 from "../../spritesheets/flowers/flower2.webp";
import flower3 from "../../spritesheets/flowers/flower3.webp";
import flower4 from "../../spritesheets/flowers/flower4.webp";
import flower5 from "../../spritesheets/flowers/flower5.webp";
import flower6 from "../../spritesheets/flowers/flower6.webp";
import flower7 from "../../spritesheets/flowers/flower7.webp";

const TREE_ASSETS = [tree1, tree2, tree3, tree4, tree5, tree6, tree7, tree8];
const GRASS_ASSETS = [grass1, grass2, grass3, grass4, grass5, grass6, grass7];
const ROCK_ASSETS = [bigrock1, rock1, rock2];
const FLOWER_ASSETS = [flower1, flower2, flower3, flower4, flower5, flower6, flower7];
const TREE_DEPTH_SPLIT = 65;

const LAYER_STYLE_BACK = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: 1,
};

const LAYER_STYLE_FRONT = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: 3,
};

function getSpriteTransform(item, worldOffset) {
  return `translate(${item.x + worldOffset.x}px, ${item.y + worldOffset.y}px) translate(-50%, -100%) scale(${item.flip ? -item.scale : item.scale}, ${item.scale})`;
}

function getSpriteStyle(item, worldOffset, extraStyle = {}) {
  return {
    position: "absolute",
    width: item.width,
    height: item.height,
    transform: getSpriteTransform(item, worldOffset),
    transformOrigin: "bottom center",
    imageRendering: "pixelated",
    ...extraStyle,
  };
}

export default function DecorLayer() {
  const worldOffset = useWorldStore((s) => s.worldOffset);

  const playerX = -worldOffset.x;
  const playerY = -worldOffset.y;

  const trees = useMemo(() => getTreesAround(playerX, playerY), [playerX, playerY]);
  const grass = useMemo(() => getGrassAround(playerX, playerY), [playerX, playerY]);
  const rocks = useMemo(() => getRocksAround(playerX, playerY), [playerX, playerY]);
  const flowers = useMemo(() => getFlowersAround(playerX, playerY), [playerX, playerY]);

  return (
    <>
      <div data-decor-layer style={LAYER_STYLE_BACK}>
        {flowers.map((flower) => (
          <img
            key={`flower_${flower.id}`}
            src={FLOWER_ASSETS[flower.spriteIndex % FLOWER_ASSETS.length]}
            style={getSpriteStyle(flower, worldOffset)}
          />
        ))}

        {grass.map((blade) => (
          <img
            key={`grass_${blade.id}`}
            src={GRASS_ASSETS[blade.spriteIndex % GRASS_ASSETS.length]}
            style={getSpriteStyle(blade, worldOffset, { opacity: 1 })}
          />
        ))}

        {rocks.map((rock) => (
          <img
            key={`rock_${rock.id}`}
            src={ROCK_ASSETS[rock.spriteIndex % ROCK_ASSETS.length]}
            style={getSpriteStyle(rock, worldOffset)}
          />
        ))}

        {trees.map((tree) => (
          <img
            key={`tree_back_${tree.id}`}
            src={TREE_ASSETS[tree.spriteIndex % TREE_ASSETS.length]}
            style={getSpriteStyle(tree, worldOffset, {
              clipPath: `inset(${TREE_DEPTH_SPLIT}% 0 0 0)`,
            })}
          />
        ))}
      </div>

      <div style={LAYER_STYLE_FRONT}>
        {trees.map((tree) => (
          <img
            key={`tree_front_${tree.id}`}
            src={TREE_ASSETS[tree.spriteIndex % TREE_ASSETS.length]}
            style={getSpriteStyle(tree, worldOffset, {
              clipPath: `inset(0 0 ${100 - TREE_DEPTH_SPLIT}% 0)`,
            })}
          />
        ))}
      </div>
    </>
  );
}

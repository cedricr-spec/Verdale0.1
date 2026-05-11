

import Phaser from "phaser"
import { CHARACTER_SHADOW_ASSET } from "./assetManifest"
import {
  getNextPetFrameIndex,
  getPetFrameDelay,
  getPetSpriteRenderModel,
} from "../lib/petSpriteRenderModel"
import { useCharacterStore } from "../store/useCharacterStore"
import { useWorldStore } from "../store/worldSlice"
import {
  CHARACTER_BODY_DEPTH,
  CHARACTER_SHADOW_DEPTH,
} from "./renderDepths"

export default class PlayerRenderer {
  constructor(scene) {
    this.scene = scene
    this.sprite = null
    this.shadow = null
    this.characterId = null
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.animationState = null
    this.model = null
    this.visible = false
    this.loadingTextureKey = null
  }

  setVisible(visible) {
    this.visible = Boolean(visible)
    this.sprite?.setVisible(this.visible)
    this.shadow?.setVisible(this.visible && Boolean(this.model?.shadow))
  }

  update() {
    if (!this.visible) return

    this.sync()

    if (!this.model) return

    const frameDelay = getPetFrameDelay(this.model.animation)
    if (this.scene.time.now - this.lastFrameTime > frameDelay) {
      this.lastFrameTime = this.scene.time.now
      this.frameIndex = getNextPetFrameIndex({
        currentFrameIndex: this.frameIndex,
        animation: this.model.animation,
      })
      this.sync()
    }
  }

  sync() {
    const cam = this.scene.cameras.main
    const characterState = useCharacterStore.getState()
    const { facingDirection } = useWorldStore.getState()

    const baseModel = getPetSpriteRenderModel({
      activeCharacterId: characterState.activeCharacterId,
      persistentState: characterState.persistentState,
      transientState: characterState.transientState,
      movementActive: characterState.movementActive,
      facingDirection,
      frameIndex: this.frameIndex,
      viewportWidth: cam.width,
      viewportHeight: cam.height,
    })

    if (!baseModel?.spritesheet) return

    const characterChanged = this.characterId !== baseModel.characterId
    const animationChanged = this.animationState !== baseModel.animationState

    if (characterChanged) {
      this.destroySpriteObjects()
      this.characterId = baseModel.characterId
      this.frameIndex = 0
      this.animationState = null
      this.lastFrameTime = 0
    }

    if (animationChanged) {
      this.animationState = baseModel.animationState
      this.frameIndex = 0
      this.lastFrameTime = 0
    }

    const model = getPetSpriteRenderModel({
      activeCharacterId: characterState.activeCharacterId,
      persistentState: characterState.persistentState,
      transientState: characterState.transientState,
      movementActive: characterState.movementActive,
      facingDirection,
      frameIndex: this.frameIndex,
      viewportWidth: cam.width,
      viewportHeight: cam.height,
    })

    if (!model?.spritesheet) return

    const textureKey = `player_${model.characterId}`
    if (!this.ensureTexture(textureKey, model.spritesheet)) return

    const texture = this.scene.textures.get(textureKey)
    texture.setFilter?.(Phaser.Textures.FilterMode.NEAREST)

    const frameKey = this.ensureFrame(texture, model, textureKey)
    if (!frameKey) return

    if (!this.sprite) {
      this.sprite = this.scene.add
        .image(model.centerX, model.centerY, textureKey, frameKey)
        .setOrigin(0.5, 0.5)
        .setDepth(CHARACTER_BODY_DEPTH)
        .setScrollFactor(0)
        .setVisible(this.visible)
    }

    this.sprite
      .setTexture(textureKey, frameKey)
      .setPosition(model.centerX, model.centerY)
      .setScale(model.flipX ? -model.scale : model.scale, model.scale)
      .setVisible(this.visible)

    this.syncShadow(model)
    this.model = model
  }

  ensureTexture(textureKey, src) {
    if (this.scene.textures.exists(textureKey)) return true

    if (this.loadingTextureKey === textureKey) return false

    this.loadingTextureKey = textureKey
    this.scene.load.image(textureKey, src)
    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingTextureKey = null
      this.sync()
    })
    this.scene.load.once("loaderror", () => {
      this.loadingTextureKey = null
    })
    this.scene.load.start()
    return false
  }

  ensureFrame(texture, model, textureKey) {
    const frameKey = `${textureKey}_${model.animationState}_f${model.frameIndex}`
    if (!texture.has(frameKey)) {
      texture.add(
        frameKey,
        0,
        model.frameX,
        model.frameY,
        model.frameWidth,
        model.frameHeight
      )
    }

    return texture.has(frameKey) ? frameKey : null
  }

  syncShadow(model) {
    const shadowConfig = model.shadow
    const shadowTextureKey = CHARACTER_SHADOW_ASSET.key

    if (!shadowConfig || !this.scene.textures.exists(shadowTextureKey)) {
      this.shadow?.setVisible(false)
      return
    }

    if (!this.shadow) {
      this.shadow = this.scene.add
        .image(model.centerX, model.centerY, shadowTextureKey)
        .setOrigin(0.5, 0.5)
        .setDepth(CHARACTER_SHADOW_DEPTH)
        .setScrollFactor(0)
        .setVisible(this.visible)
    }

    const baseScale = model.character.scale || 1
    const shadowScale = shadowConfig.scale || baseScale

    this.shadow
      .setPosition(
        Math.round(model.centerX + (shadowConfig.offsetX || 0) * model.scale),
        Math.round(model.centerY + (shadowConfig.offsetY || 0) * model.scale)
      )
      .setDisplaySize(
        (shadowConfig.width || 17) * shadowScale,
        (shadowConfig.height || 6) * shadowScale
      )
      .setAlpha(shadowConfig.opacity ?? 1)
      .setVisible(this.visible)
  }

  destroySpriteObjects() {
    this.sprite?.destroy()
    this.sprite = null
    this.shadow?.destroy()
    this.shadow = null
    this.model = null
  }

  destroy() {
    this.destroySpriteObjects()
    this.loadingTextureKey = null
    this.characterId = null
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.animationState = null
    this.visible = false
  }
}

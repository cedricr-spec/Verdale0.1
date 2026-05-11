import Phaser from "phaser"
import { getItemDefinition } from "../config/itemsRegistry"
import { getItemEquipmentProfile } from "../config/normalizedItemRegistry"
import { useInventoryStore } from "../store/useInventoryStore"
import { getPetCollisionBounds } from "../systems/CollisionSystem"
import {
  EQUIPMENT_HIDDEN_ANIMATION_STATES,
  EQUIPMENT_IDLE_BOB_FRAMES,
  EQUIPMENT_RUN_BOB_FRAMES,
  getEquipmentActionDuration,
  getEquipmentActionPose as resolveEquipmentActionPose,
  getEquipmentHoldTransform,
} from "./equipmentAnimationConfig"
import { getEntityDepthFromFeetY } from "./renderDepths"

export default class PhaserPetSprite {
  constructor(scene) {
    this.scene = scene
    this.sprite = null
    this.characterId = null
    this.textureKey = null
    this.loadingTextureKey = null
    this.equipmentSprite = null
    this.equipmentTextureKey = null
    this.loadingEquipmentTextureKey = null
    this.currentEquipmentBob = 0
    this.equipmentAction = null
    this.handleEquipmentAction = this.handleEquipmentAction.bind(this)

    if (typeof window !== "undefined") {
      window.addEventListener("phaser-equipment-action", this.handleEquipmentAction)
    }
  }

  update(model, visible, options = {}) {
    if (!model?.spritesheet) {
      this.hideEquipment()
      return false
    }

    const feetScreenY = Math.round(
      getPetCollisionBounds({ x: model.centerX, y: model.centerY }).bottom
    )
    const entityDepth = getEntityDepthFromFeetY(feetScreenY)

    if (this.characterId !== model.characterId) {
      this.resetCharacter(model.characterId)
    }

    const textureKey = this.getTextureKey(model)
    if (!this.ensureTexture(textureKey, model.spritesheet)) {
      this.sprite?.setVisible(false)
      this.hideEquipment()
      return false
    }

    const texture = this.scene.textures.get(textureKey)
    texture.setFilter?.(Phaser.Textures.FilterMode.NEAREST)

    const frameKey = this.ensureFrame(texture, textureKey, model)
    if (!frameKey) {
      this.sprite?.setVisible(false)
      this.hideEquipment()
      return false
    }

    if (!this.sprite) {
      this.sprite = this.scene.add
        .image(model.centerX, model.centerY, textureKey, frameKey)
        .setOrigin(0.5, 0.5)
        .setDepth(entityDepth)
        .setScrollFactor(0)
    }

    this.sprite
      .setTexture(textureKey, frameKey)
      .setPosition(model.centerX, model.centerY)
      .setDepth(entityDepth)
      .setScale(model.flipX ? -model.scale : model.scale, model.scale)
      .setVisible(Boolean(visible))

    if (options.showEquipment === false) {
      this.hideEquipment()
    } else {
      this.updateEquipment(model, visible, entityDepth)
    }

    return true
  }

  handleEquipmentAction(event) {
    const actionType = event?.detail?.type || null
    if (!actionType) return
    const itemId = event?.detail?.itemId || null
    const animationSet = itemId ? getItemEquipmentProfile(itemId)?.animationSet || null : null

    this.equipmentAction = {
      type: actionType,
      itemId,
      animationSet,
      startedAt: this.scene?.time?.now || 0,
      duration: getEquipmentActionDuration(actionType, animationSet),
    }
  }

  getEquipmentActionPose(animationSet = null, facing = "right") {
    if (!this.equipmentAction || !this.scene) {
      return { x: 0, y: 0, bob: 0, rotation: 0 }
    }

    const now = this.scene.time.now
    const elapsed = Math.max(0, now - this.equipmentAction.startedAt)
    const duration = Math.max(
      1,
      this.equipmentAction.duration ||
        getEquipmentActionDuration(this.equipmentAction.type, animationSet)
    )

    if (elapsed >= duration) {
      this.equipmentAction = null
      return { x: 0, y: 0, bob: 0, rotation: 0 }
    }

    const progress = elapsed / duration
    return resolveEquipmentActionPose({
      actionType: this.equipmentAction.type,
      animationSet: animationSet || this.equipmentAction.animationSet || null,
      progress,
      facing,
    })
  }

  updateEquipment(model, visible, entityDepth) {
    const equipmentInfo = this.resolveActiveEquipmentInfo()

    if (
      !visible ||
      !equipmentInfo ||
      EQUIPMENT_HIDDEN_ANIMATION_STATES.has(model.animationState)
    ) {
      this.hideEquipment()
      return false
    }

    const textureKey = this.getEquipmentTextureKey(equipmentInfo.itemId)
    if (!this.ensureEquipmentTexture(textureKey, equipmentInfo.atlasSource)) {
      this.hideEquipment()
      return false
    }

    const texture = this.scene.textures.get(textureKey)
    texture.setFilter?.(Phaser.Textures.FilterMode.NEAREST)

    const frameKey = this.ensureEquipmentFrame(texture, textureKey, equipmentInfo)
    if (!frameKey) {
      this.hideEquipment()
      return false
    }

    const facing = model.facingDirection === "left" ? "left" : "right"
    const offset = equipmentInfo.equipment.offsets?.[facing] ||
      equipmentInfo.equipment.offsets?.right ||
      { x: 0, y: 0, depth: "front" }
    const flipX = facing === "left"
    const depthOffset = offset.depth === "behind" ? -0.02 : 0.02
    const equipmentScale = Math.max(1, model.scale || 1) * 0.5
    const holdTransform = getEquipmentHoldTransform(
      equipmentInfo.equipment.animationSet,
      facing
    )
    const idleBob = model.animationState === "idle"
      ? EQUIPMENT_IDLE_BOB_FRAMES[model.frameIndex % EQUIPMENT_IDLE_BOB_FRAMES.length]
      : 0
    const runBob = model.animationState === "run"
      ? EQUIPMENT_RUN_BOB_FRAMES[model.frameIndex % EQUIPMENT_RUN_BOB_FRAMES.length]
      : 0
    const actionPose = this.getEquipmentActionPose(equipmentInfo.equipment.animationSet, facing)
    const actionBob = actionPose.bob
    const actionRotation = Phaser.Math.DegToRad(actionPose.rotation)
    const targetEquipmentBob = idleBob + runBob
    this.currentEquipmentBob += (targetEquipmentBob - this.currentEquipmentBob) * 0.18
    const equipmentBob = this.currentEquipmentBob + actionBob
    const x = Math.round(
      model.centerX +
      (offset.x || 0) * equipmentScale +
      actionPose.x
    )
    const y = Math.round(
      model.centerY +
      (offset.y || 0) * equipmentScale +
      equipmentBob +
      actionPose.y
    )

    const originX = holdTransform.originX
    const originY = holdTransform.originY
    const scaleX = flipX ? -equipmentScale : equipmentScale
    const scaleY = equipmentScale
    const frameWidth = equipmentInfo.atlasRect.width || equipmentInfo.atlasRect.w || 16
    const frameHeight = equipmentInfo.atlasRect.height || equipmentInfo.atlasRect.h || 16
    const pivotX = Math.round(x - (0.5 - originX) * frameWidth * scaleX)
    const pivotY = Math.round(y - (0.5 - originY) * frameHeight * scaleY)

    if (!this.equipmentSprite) {
      this.equipmentSprite = this.scene.add
        .image(x, y, textureKey, frameKey)
        .setOrigin(originX, originY)
        .setScrollFactor(0)
    }

    this.equipmentSprite
      .setTexture(textureKey, frameKey)
      .setOrigin(originX, originY)
      .setPosition(pivotX, pivotY)
      .setDepth(entityDepth + depthOffset)
      .setRotation(actionRotation)
      .setScale(scaleX, scaleY)
      .setVisible(true)

    return true
  }

  resolveActiveEquipmentInfo() {
    const inventoryState = useInventoryStore.getState()
    const activeIndex = inventoryState.activeUsableSlotIndex
    const stack = Number.isInteger(activeIndex) ? inventoryState.usableSlots?.[activeIndex] : null
    const itemId = stack?.itemId || null
    if (!itemId) return null

    const definition = getItemDefinition(itemId)
    const equipment = getItemEquipmentProfile(itemId)
    if (!equipment?.holdable) return null

    const sprite = definition?.sprite || null
    const atlasSource = definition?.atlasSource ||
      definition?.atlas?.source ||
      definition?.spritesheet ||
      definition?.spriteSheet ||
      sprite?.sheet ||
      null
    const atlasRect = definition?.atlasRect ||
      definition?.atlas?.rect ||
      definition?.spriteRect ||
      (sprite ? {
        x: sprite.x || 0,
        y: sprite.y || 0,
        width: sprite.w || sprite.width || 16,
        height: sprite.h || sprite.height || 16,
      } : null)
    if (!atlasSource || !atlasRect) return null

    return {
      itemId,
      equipment,
      atlasSource,
      atlasRect,
    }
  }

  getEquipmentTextureKey(itemId) {
    return `phaser_equipment_${itemId}`
  }

  ensureEquipmentTexture(textureKey, src) {
    if (this.scene.textures.exists(textureKey)) return true
    if (this.loadingEquipmentTextureKey === textureKey) return false

    this.loadingEquipmentTextureKey = textureKey
    this.scene.load.image(textureKey, src)
    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingEquipmentTextureKey = null
    })
    this.scene.load.once("loaderror", () => {
      this.loadingEquipmentTextureKey = null
    })
    this.scene.load.start()
    return false
  }

  ensureEquipmentFrame(texture, textureKey, equipmentInfo) {
    const rect = equipmentInfo.atlasRect
    const width = rect.width || rect.w || 16
    const height = rect.height || rect.h || 16
    const frameKey = `${textureKey}_${rect.x || 0}_${rect.y || 0}_${width}_${height}`

    if (!texture.has(frameKey)) {
      texture.add(frameKey, 0, rect.x || 0, rect.y || 0, width, height)
    }

    return texture.has(frameKey) ? frameKey : null
  }

  hideEquipment() {
    this.equipmentSprite?.setVisible(false)
  }

  ensureTexture(textureKey, src) {
    if (this.scene.textures.exists(textureKey)) return true
    if (this.loadingTextureKey === textureKey) return false

    this.loadingTextureKey = textureKey
    this.scene.load.image(textureKey, src)
    this.scene.load.once(`filecomplete-image-${textureKey}`, () => {
      this.loadingTextureKey = null
    })
    this.scene.load.once("loaderror", () => {
      this.loadingTextureKey = null
    })
    this.scene.load.start()
    return false
  }

  ensureFrame(texture, textureKey, model) {
    const frameKey = `${textureKey}_${model.animationState}_${model.frameIndex}`

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

  getTextureKey(model) {
    return `phaser_pet_${model.characterId}`
  }

  resetCharacter(characterId) {
    this.sprite?.destroy()
    this.sprite = null
    this.characterId = characterId
    this.textureKey = null
    this.loadingTextureKey = null
    this.currentEquipmentBob = 0
    this.hideEquipment()
  }

  setVisible(visible) {
    this.sprite?.setVisible(Boolean(visible))
    if (!visible) this.hideEquipment()
  }

  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("phaser-equipment-action", this.handleEquipmentAction)
    }
    this.sprite?.destroy()
    this.equipmentSprite?.destroy()
    this.sprite = null
    this.equipmentSprite = null
    this.characterId = null
    this.textureKey = null
    this.loadingTextureKey = null
    this.equipmentTextureKey = null
    this.loadingEquipmentTextureKey = null
    this.currentEquipmentBob = 0
    this.equipmentAction = null
    this.scene = null
  }
}

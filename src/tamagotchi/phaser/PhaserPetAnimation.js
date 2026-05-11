import { useCharacterStore } from "../store/useCharacterStore"
import {
  getNextPhaserPetFrameIndex,
  getPhaserPetFrameDelay,
} from "./PhaserPetModel"

export default class PhaserPetAnimation {
  constructor(scene) {
    this.scene = scene
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.animationState = null
  }

  reset() {
    this.frameIndex = 0
    this.lastFrameTime = 0
    this.animationState = null
  }

  syncAnimationState(animationState) {
    if (this.animationState === animationState) return false

    this.animationState = animationState
    this.frameIndex = 0
    this.lastFrameTime = this.scene?.time?.now || 0
    return true
  }

  update(animation) {
    if (!animation) return this.frameIndex

    const delay = getPhaserPetFrameDelay(animation)
    const now = this.scene.time.now

    if (!this.lastFrameTime) {
      this.lastFrameTime = now
      return this.frameIndex
    }

    if (now - this.lastFrameTime < delay) {
      return this.frameIndex
    }

    this.lastFrameTime = now
    const previousFrameIndex = this.frameIndex
    this.frameIndex = getNextPhaserPetFrameIndex({
      currentFrameIndex: this.frameIndex,
      animation,
    })

    this.handleCompletedNonLoopAnimation(animation, previousFrameIndex)
    return this.frameIndex
  }

  handleCompletedNonLoopAnimation(animation, previousFrameIndex) {
    if (animation?.loop !== false) return

    const lastFrameIndex = Math.max(0, (animation.frames || 1) - 1)
    const reachedLastFrame = previousFrameIndex >= lastFrameIndex
    if (!reachedLastFrame) return

    const { transientState, previousPersistentState, clearTransientState } = useCharacterStore.getState()
    if (!transientState) return

    const nextState = animation.holdLastFrame ? previousPersistentState : animation.nextState
    clearTransientState(nextState)
  }

  destroy() {
    this.reset()
    this.scene = null
  }
}
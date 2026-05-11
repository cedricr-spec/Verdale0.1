import {
  DEBUG_VILLAGE_DOORS,
  VILLAGE_WORLD_TILE_SIZE,
  clearAllVillageDoorTileOverrides,
  clearVillageDoorTileOverride,
  getNearestVillageDoor,
  getVillageDoorById,
  getVillageDoors,
  setVillageDoorTileOverride,
} from '../utils/worldVillage';

const DOOR_FRAME_DURATION_MS = 120;
const DOOR_DEBUG_DEPTH = 96;

export default class VillageDoorManager {
  constructor(scene) {
    this.scene = scene;
    this.doors = getVillageDoors().map((door) => ({
      ...door,
      state: 'closed',
      frameIndex: 0,
      frameElapsedMs: 0,
      activeEntities: new Set(),
    }));
    this.doorsById = new Map(this.doors.map((door) => [door.id, door]));

    if (DEBUG_VILLAGE_DOORS) {
      this.doors.forEach((door) => {
        if (!Number.isFinite(door.worldTileX) || !Number.isFinite(door.worldTileY)) {
          console.warn(`[Village Doors] runtime door "${door.id}" missing world tile coords.`, door);
        }
        if (!door.closedGid) {
          console.warn(`[Village Doors] runtime door "${door.id}" has closedGid=0.`, door);
        }
      });
    }

    if (DEBUG_VILLAGE_DOORS) {
      this.debugGraphics = scene.add.graphics();
      this.debugGraphics
        .setDepth(DOOR_DEBUG_DEPTH)
        .setScrollFactor(0)
        .setVisible(true);
    } else {
      this.debugGraphics = null;
    }
  }

  getVillageDoors() {
    return this.doors;
  }

  getDoorById(doorId) {
    return this.doorsById.get(doorId) || null;
  }

  getNearestDoor(x, y, maxDistance = Infinity) {
    const baseDoor = getNearestVillageDoor(x, y, maxDistance);
    return baseDoor ? this.getDoorById(baseDoor.id) : null;
  }

  getNearbyDoors(x, y, maxDistance = Infinity) {
    return this.doors
      .map((door) => {
        const centerX = (door.bounds.left + door.bounds.right) * 0.5;
        const centerY = (door.bounds.top + door.bounds.bottom) * 0.5;
        return {
          door,
          distance: Math.hypot(centerX - x, centerY - y),
        };
      })
      .filter(({ distance }) => distance <= maxDistance)
      .sort((left, right) => left.distance - right.distance)
      .map(({ door }) => door);
  }

  isDoorOpen(doorId) {
    const door = this.getDoorById(doorId);
    return Boolean(door && door.state === 'open');
  }

  getDoorAnimationDurationMs(doorId) {
    const door = this.getDoorById(doorId);
    if (!door?.frameGids?.length) {
      return 0;
    }

    return Math.max(0, door.frameGids.length - 1) * DOOR_FRAME_DURATION_MS;
  }

  openDoor(doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    if (!door.frameGids?.length) {
      door.state = 'open';
      return door;
    }

    if (door.state === 'open' || door.state === 'opening') {
      return door;
    }

    if (DEBUG_VILLAGE_DOORS) {
      console.info('[Village Doors] opening', doorId);
    }
    door.state = 'opening';
    door.frameElapsedMs = 0;
    door.frameIndex = Math.max(0, door.frameIndex);
    this.applyDoorTileOverride(door);
    return door;
  }

  closeDoor(doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    if (door.activeEntities.size > 0) {
      return door;
    }

    if (door.state === 'closed' || door.state === 'closing') {
      return door;
    }

    if (DEBUG_VILLAGE_DOORS) {
      console.info('[Village Doors] closing', doorId);
    }
    door.state = 'closing';
    door.frameElapsedMs = 0;
    if (door.frameGids?.length && door.frameIndex <= 0) {
      door.frameIndex = door.frameGids.length - 1;
    }
    this.applyDoorTileOverride(door);
    return door;
  }

  enterDoor(entity, doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    door.activeEntities.add(entity?.id || String(entity));
    this.openDoor(doorId);
    return door;
  }

  exitDoor(entity, doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    door.activeEntities.add(entity?.id || String(entity));
    this.openDoor(doorId);
    return door;
  }

  forceCloseDoor(doorId) {
    const door = this.getDoorById(doorId);
    if (!door) return;
    door.state = 'closed';
    door.frameIndex = 0;
    door.frameElapsedMs = 0;
    door.activeEntities.clear();
    clearVillageDoorTileOverride(door.worldTileX, door.worldTileY);
  }

  releaseDoorEntity(entity, doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    door.activeEntities.delete(entity?.id || String(entity));
    if (door.activeEntities.size === 0) {
      this.closeDoor(doorId);
    }
    return door;
  }

  getDoorEntryPoint(doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    return {
      x: (door.bounds.left + door.bounds.right) * 0.5,
      y: door.bounds.bottom,
    };
  }

  getDoorEntryTilePoint(doorId) {
    const door = this.getDoorById(doorId);
    if (!door) {
      return null;
    }

    return {
      x: door.worldTileX * VILLAGE_WORLD_TILE_SIZE + VILLAGE_WORLD_TILE_SIZE * 0.5,
      y: (door.worldTileY + 2) * VILLAGE_WORLD_TILE_SIZE,
    };
  }

  getDoorExitPoint(doorId, offsetY = 2) {
    const entryPoint = this.getDoorEntryPoint(doorId);
    if (!entryPoint) {
      return null;
    }

    return {
      x: entryPoint.x,
      y: entryPoint.y + offsetY,
    };
  }

  getDoorApproachPoint(doorId) {
    return this.getDoorEntryPoint(doorId);
  }

  applyDoorTileOverride(door) {
    if (!door?.frameGids?.length) {
      return;
    }

    const nextGid = door.frameGids[door.frameIndex];
    if (!nextGid || door.frameIndex === 0 && door.state === 'closed') {
      clearVillageDoorTileOverride(door.worldTileX, door.worldTileY);
      return;
    }

    setVillageDoorTileOverride(door.worldTileX, door.worldTileY, nextGid);
  }

  updateDoorState(door, deltaMs) {
    if (!door.frameGids?.length) {
      return;
    }

    if (door.state !== 'opening' && door.state !== 'closing') {
      return;
    }

    door.frameElapsedMs += deltaMs;
    while (door.frameElapsedMs >= DOOR_FRAME_DURATION_MS) {
      door.frameElapsedMs -= DOOR_FRAME_DURATION_MS;

      if (door.state === 'opening') {
        if (door.frameIndex < door.frameGids.length - 1) {
          door.frameIndex += 1;
          this.applyDoorTileOverride(door);
        } else {
          door.state = 'open';
          break;
        }
      } else if (door.state === 'closing') {
        if (door.frameIndex > 0) {
          door.frameIndex -= 1;
          this.applyDoorTileOverride(door);
        } else {
          door.state = 'closed';
          clearVillageDoorTileOverride(door.worldTileX, door.worldTileY);
          break;
        }
      }
    }
  }

  drawDebug(worldOffset) {
    if (!this.debugGraphics) {
      return;
    }

    const cam = this.scene.cameras.main;
    this.debugGraphics.clear();
    this.debugGraphics.fillStyle(0xfacc15, 0.18);
    this.debugGraphics.lineStyle(1, 0xfde047, 0.75);

    this.doors.forEach((door) => {
      const drawX = Math.round(cam.width * 0.5 + (worldOffset?.x || 0) + door.bounds.left);
      const drawY = Math.round(cam.height * 0.5 + (worldOffset?.y || 0) + door.bounds.top);
      this.debugGraphics.fillRect(drawX, drawY, door.bounds.width, door.bounds.height);
      this.debugGraphics.strokeRect(drawX, drawY, door.bounds.width, door.bounds.height);
    });
  }

  update(worldOffset, deltaMs) {
    this.doors.forEach((door) => this.updateDoorState(door, deltaMs));
    if (DEBUG_VILLAGE_DOORS) {
      this.drawDebug(worldOffset);
    }
  }

  destroy() {
    clearAllVillageDoorTileOverrides();
    this.debugGraphics?.destroy();
    this.debugGraphics = null;
    this.doors = [];
    this.doorsById.clear();
    this.scene = null;
  }
}

export function getVillageDoorsRuntime(manager) {
  return manager?.getVillageDoors?.() || [];
}

export function getNearestDoor(manager, x, y, maxDistance) {
  return manager?.getNearestDoor?.(x, y, maxDistance) || null;
}

export function openDoor(manager, doorId) {
  return manager?.openDoor?.(doorId) || null;
}

export function closeDoor(manager, doorId) {
  return manager?.closeDoor?.(doorId) || null;
}

export function enterDoor(manager, entity, doorId) {
  return manager?.enterDoor?.(entity, doorId) || null;
}

export function exitDoor(manager, entity, doorId) {
  return manager?.exitDoor?.(entity, doorId) || null;
}

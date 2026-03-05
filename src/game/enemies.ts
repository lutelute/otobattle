import type { Enemy, EnemyShape, ClefType } from './types'
import { WHITE_NOTE_NAMES, BLACK_NOTE_NAMES } from './notes'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_RADIUS, SPAWN_MARGIN, SHARP_UNLOCK_WAVE, BASS_CLEF_UNLOCK_WAVE,
} from './constants'
import { randomFloat, randomInt, normalize, scale } from '../utils/math'

let globalEnemyId = 0
export function resetEnemyId() { globalEnemyId = 0 }

export function spawnEnemy(
  centerX: number,
  centerY: number,
  speed: number,
  wave: number,
): Enemy {
  const side = randomInt(0, 3)
  let x: number, y: number

  switch (side) {
    case 0:
      x = randomFloat(0, CANVAS_BASE_WIDTH)
      y = -SPAWN_MARGIN
      break
    case 1:
      x = CANVAS_BASE_WIDTH + SPAWN_MARGIN
      y = randomFloat(0, CANVAS_BASE_HEIGHT)
      break
    case 2:
      x = randomFloat(0, CANVAS_BASE_WIDTH)
      y = CANVAS_BASE_HEIGHT + SPAWN_MARGIN
      break
    default:
      x = -SPAWN_MARGIN
      y = randomFloat(0, CANVAS_BASE_HEIGHT)
      break
  }

  const dir = normalize({ x: centerX - x, y: centerY - y })
  const vel = scale(dir, speed)

  // Pick note: sharps unlocked after SHARP_UNLOCK_WAVE
  const useSharp = wave >= SHARP_UNLOCK_WAVE && Math.random() < 0.3
  const pool = useSharp ? BLACK_NOTE_NAMES : WHITE_NOTE_NAMES
  const note = pool[randomInt(0, pool.length - 1)]

  // Pick clef: bass clef unlocked after BASS_CLEF_UNLOCK_WAVE
  const clef: ClefType = (wave >= BASS_CLEF_UNLOCK_WAVE && Math.random() < 0.4) ? 'bass' : 'treble'

  const shapes: EnemyShape[] = ['square', 'diamond', 'circle', 'triangle', 'hexagon', 'cross']
  const id = ++globalEnemyId

  return {
    id,
    pos: { x, y },
    vel,
    note,
    clef,
    radius: ENEMY_BASE_RADIUS,
    alive: true,
    spawnTime: performance.now() / 1000,
    hitFlash: 0,
    shape: shapes[id % shapes.length],
  }
}

export function spawnWaveEnemies(
  count: number,
  centerX: number,
  centerY: number,
  speed: number,
  wave: number,
): Enemy[] {
  const enemies: Enemy[] = []
  for (let i = 0; i < count; i++) {
    enemies.push(spawnEnemy(centerX, centerY, speed, wave))
  }
  return enemies
}

export function moveEnemies(enemies: Enemy[], dt: number): void {
  for (const e of enemies) {
    if (!e.alive) continue
    e.pos.x += e.vel.x * dt
    e.pos.y += e.vel.y * dt
    if (e.hitFlash > 0) e.hitFlash -= dt
  }
}

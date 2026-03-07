import type { Enemy, EnemyShape, ClefType, NoteName, NoteRangeConfig } from './types'
import { ALL_NOTE_NAMES, WHITE_NOTE_NAMES, BLACK_NOTE_NAMES } from './notes'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_RADIUS, SPAWN_MARGIN, SHARP_UNLOCK_WAVE, BASS_CLEF_UNLOCK_WAVE,
  ALTO_CLEF_UNLOCK_WAVE, INVADER_UNLOCK_WAVE, INVADER_SPEED_X, INVADER_DROP_STEP,
  INVADER_MARGIN, INVADER_ROW_START_Y,
} from './constants'
import { randomFloat, randomInt, normalize, scale } from '../utils/math'

let globalEnemyId = 0
export function resetEnemyId() { globalEnemyId = 0 }

/** Filter a note pool to only include notes within the configured range (chromatic order) */
export function filterNotesByRange(pool: NoteName[], noteRange?: NoteRangeConfig): NoteName[] {
  if (!noteRange) return pool
  const minIdx = ALL_NOTE_NAMES.indexOf(noteRange.minNote)
  const maxIdx = ALL_NOTE_NAMES.indexOf(noteRange.maxNote)
  if (minIdx < 0 || maxIdx < 0) return pool
  const filtered = pool.filter(note => {
    const idx = ALL_NOTE_NAMES.indexOf(note)
    return idx >= minIdx && idx <= maxIdx
  })
  return filtered.length > 0 ? filtered : pool
}

export function spawnEnemy(
  centerX: number,
  centerY: number,
  speed: number,
  wave: number,
  noteRange?: NoteRangeConfig,
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

  // Pick note: sharps unlocked after SHARP_UNLOCK_WAVE, filtered by noteRange
  const useSharp = wave >= SHARP_UNLOCK_WAVE && Math.random() < 0.3
  const basePool = useSharp ? BLACK_NOTE_NAMES : WHITE_NOTE_NAMES
  const pool = filterNotesByRange(basePool, noteRange)
  const note = pool[randomInt(0, pool.length - 1)]

  // Pick clef: bass clef unlocked after BASS_CLEF_UNLOCK_WAVE, alto after ALTO_CLEF_UNLOCK_WAVE
  let clef: ClefType = 'treble'
  if (noteRange?.clefFilter) {
    clef = noteRange.clefFilter
  } else if (wave >= ALTO_CLEF_UNLOCK_WAVE && Math.random() < 0.3) {
    clef = 'alto'
  } else if (wave >= BASS_CLEF_UNLOCK_WAVE && Math.random() < 0.4) {
    clef = 'bass'
  }

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
    enemyType: 'normal',
  }
}

export function spawnInvaderRow(wave: number, noteRange?: NoteRangeConfig): Enemy[] {
  const count = randomInt(3, 5)
  const spacing = (CANVAS_BASE_WIDTH - INVADER_MARGIN * 2) / (count + 1)
  const startY = INVADER_ROW_START_Y
  const shapes: EnemyShape[] = ['square', 'diamond', 'circle', 'triangle', 'hexagon', 'cross']

  const useSharp = wave >= SHARP_UNLOCK_WAVE && Math.random() < 0.3
  const basePool = useSharp ? BLACK_NOTE_NAMES : WHITE_NOTE_NAMES
  const pool = filterNotesByRange(basePool, noteRange)

  const enemies: Enemy[] = []
  for (let i = 0; i < count; i++) {
    const id = ++globalEnemyId
    const note = pool[randomInt(0, pool.length - 1)]
    let clef: ClefType = 'treble'
    if (wave >= ALTO_CLEF_UNLOCK_WAVE && Math.random() < 0.3) {
      clef = 'alto'
    } else if (wave >= BASS_CLEF_UNLOCK_WAVE && Math.random() < 0.4) {
      clef = 'bass'
    }
    enemies.push({
      id,
      pos: { x: INVADER_MARGIN + spacing * (i + 1), y: startY },
      vel: { x: INVADER_SPEED_X, y: 0 },
      note,
      clef,
      radius: ENEMY_BASE_RADIUS,
      alive: true,
      spawnTime: performance.now() / 1000,
      hitFlash: 0,
      shape: shapes[id % shapes.length],
      enemyType: 'invader',
      invaderState: {
        rowIndex: i,
        direction: 1,
        dropTarget: startY,
      },
    })
  }
  return enemies
}

export function spawnWaveEnemies(
  count: number,
  centerX: number,
  centerY: number,
  speed: number,
  wave: number,
  noteRange?: NoteRangeConfig,
): Enemy[] {
  const enemies: Enemy[] = []

  // 毎ウェーブ、インベーダー列＋通常敵を混在で生成
  if (wave >= INVADER_UNLOCK_WAVE) {
    enemies.push(...spawnInvaderRow(wave, noteRange))
    // 通常敵は1体減らす（インベーダー列がある分）
    const normalCount = Math.max(1, count - 1)
    for (let i = 0; i < normalCount; i++) {
      enemies.push(spawnEnemy(centerX, centerY, speed, wave, noteRange))
    }
  } else {
    for (let i = 0; i < count; i++) {
      enemies.push(spawnEnemy(centerX, centerY, speed, wave, noteRange))
    }
  }

  return enemies
}

export function moveEnemies(enemies: Enemy[], dt: number): void {
  // インベーダー型は隊列全体で連動して動く（全invaderを1グループとして扱う）
  // NOTE: 現在のゲーム設計では1ウェーブに最大1列のインベーダーのみ生成し、
  // 全敵が倒されてから次ウェーブが生成されるため、複数列は共存しない。

  // まず隊列内で端に到達したかチェック（予測位置で判定）
  let invaderNeedsDrop = false
  for (const e of enemies) {
    if (!e.alive || e.enemyType !== 'invader' || !e.invaderState) continue
    const nextX = e.pos.x + e.vel.x * dt
    if (nextX >= CANVAS_BASE_WIDTH - INVADER_MARGIN || nextX <= INVADER_MARGIN) {
      invaderNeedsDrop = true
      break
    }
  }

  for (const e of enemies) {
    if (!e.alive) continue
    if (e.hitFlash > 0) e.hitFlash -= dt

    if (e.enemyType === 'invader' && e.invaderState) {
      if (invaderNeedsDrop) {
        // 方向反転 + 一段降下
        e.invaderState.direction = (e.invaderState.direction === 1 ? -1 : 1) as 1 | -1
        e.vel.x = INVADER_SPEED_X * e.invaderState.direction
        e.invaderState.dropTarget = e.pos.y + INVADER_DROP_STEP
        e.pos.y += INVADER_DROP_STEP
      } else {
        e.pos.x += e.vel.x * dt
        // 浮動小数点誤差によるマージン超過を防止
        if (e.pos.x < INVADER_MARGIN) e.pos.x = INVADER_MARGIN
        else if (e.pos.x > CANVAS_BASE_WIDTH - INVADER_MARGIN) e.pos.x = CANVAS_BASE_WIDTH - INVADER_MARGIN
      }
    } else {
      // 通常敵
      e.pos.x += e.vel.x * dt
      e.pos.y += e.vel.y * dt
    }
  }
}

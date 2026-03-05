import type { GameState, GameInput, GameMode, DifficultySettings, NoteRangeConfig, DisplaySettings, ModeState } from './types'
import {
  PLAYER_MAX_HP, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED,
  ENEMIES_BASE_COUNT,
} from './constants'
import { moveEnemies, resetEnemyId } from './enemies'
import { checkEnemyPlayerCollision, updateParticles } from './collision'
import { updateNoteFrenzyMode } from './modes/noteFrenzy'
import { updateScalesMode, createScalesState } from './modes/scales'

/** Create initial ModeState for the given game mode */
export function createModeState(mode: GameMode): ModeState {
  switch (mode) {
    case 'noteFrenzy':
      return { progress: 0, data: {} }
    case 'scales':
      return { progress: 0, data: createScalesState() as unknown as Record<string, unknown> }
    case 'chords':
      return { progress: 0, data: {} }
    case 'perfectPitch':
      return { progress: 0, data: {} }
    case 'fullSong':
      return { progress: 0, data: {} }
  }
}

export function createInitialState(
  mode: GameMode = 'noteFrenzy',
  settings?: Partial<DisplaySettings>,
  difficulty?: DifficultySettings,
  noteRange?: NoteRangeConfig,
): GameState {
  resetEnemyId()
  return {
    player: {
      pos: { x: CANVAS_BASE_WIDTH / 2, y: CANVAS_BASE_HEIGHT / 2 },
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      invincibleUntil: 0,
      damageFlash: 0,
    },
    enemies: [],
    particles: [],
    beams: [],
    score: 0,
    wave: 0,
    waveTimer: 0.5, // short delay before first wave
    enemiesPerWave: ENEMIES_BASE_COUNT,
    enemySpeed: ENEMY_BASE_SPEED,
    nextEnemyId: 0,
    phase: 'playing',
    waveAnnounceTimer: 0,
    time: 0,
    lastNoteAttack: null,
    noteAttackTimer: 0,
    combo: 0,
    lastAttackTime: 0,
    settings: { notationFormat: 'solfege', theme: 'dark', instrument: 'piano', ...settings },
    mode,
    modeState: createModeState(mode),
    difficulty,
    noteRange,
  }
}

/**
 * Common update logic shared across all game modes.
 *
 * Handles: enemy movement, enemy-player collision, damage flash,
 * dead enemy removal, particle updates, beam decay, game-over check.
 */
function updateCommon(state: GameState, dt: number): void {
  // Move enemies
  moveEnemies(state.enemies, dt)

  // Check collisions
  checkEnemyPlayerCollision(state.enemies, state.player, state.time)

  // Update damage flash
  if (state.player.damageFlash > 0) {
    state.player.damageFlash -= dt
  }

  // Remove dead enemies
  state.enemies = state.enemies.filter(e => e.alive)

  // Update particles
  updateParticles(state.particles, dt)

  // Update beams
  for (let i = state.beams.length - 1; i >= 0; i--) {
    state.beams[i].life -= dt
    if (state.beams[i].life <= 0) state.beams.splice(i, 1)
  }

  // Check game over
  if (state.player.hp <= 0) {
    state.phase = 'gameover'
  }
}

export function updateGame(state: GameState, dt: number, input: GameInput): void {
  if (state.phase === 'gameover') return
  if (state.phase === 'modeSelect') return

  state.time += dt

  // Dispatch to mode-specific update function
  const mode = state.mode ?? 'noteFrenzy'
  let skipCommon = false

  switch (mode) {
    case 'noteFrenzy':
      skipCommon = updateNoteFrenzyMode(state, dt, input)
      break
    case 'scales':
      skipCommon = updateScalesMode(state, dt, input)
      break
    case 'chords':
      // TODO: dispatch to updateChordsMode when implemented
      skipCommon = updateNoteFrenzyMode(state, dt, input)
      break
    case 'perfectPitch':
      // TODO: dispatch to updatePerfectPitchMode when implemented
      skipCommon = updateNoteFrenzyMode(state, dt, input)
      break
    case 'fullSong':
      // TODO: dispatch to updateFullSongMode when implemented
      skipCommon = updateNoteFrenzyMode(state, dt, input)
      break
  }

  if (!skipCommon) {
    updateCommon(state, dt)
  }
}

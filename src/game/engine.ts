import type { GameState, GameInput, DisplaySettings } from './types'
import {
  PLAYER_MAX_HP, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED, ENEMY_SPEED_INCREMENT,
  ENEMIES_BASE_COUNT, ENEMIES_INCREMENT,
  WAVE_ANNOUNCE_DURATION, WAVE_INTERVAL,
  NOTE_ATTACK_DISPLAY_DURATION, COMBO_TIMEOUT,
  BEAM_LIFE, COLORS,
} from './constants'
import { spawnWaveEnemies, moveEnemies, resetEnemyId } from './enemies'
import { attackWithNote, checkEnemyPlayerCollision, updateParticles } from './collision'

export function createInitialState(settings?: Partial<DisplaySettings>): GameState {
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
    settings: { showSolfege: true, theme: 'dark', instrument: 'piano', ...settings },
  }
}

export function updateGame(state: GameState, dt: number, input: GameInput): void {
  if (state.phase === 'gameover') return

  state.time += dt

  // Wave announce phase
  if (state.phase === 'waveAnnounce') {
    state.waveAnnounceTimer -= dt
    if (state.waveAnnounceTimer <= 0) {
      state.phase = 'playing'
      // Spawn enemies for this wave
      const cx = CANVAS_BASE_WIDTH / 2
      const cy = CANVAS_BASE_HEIGHT / 2
      const newEnemies = spawnWaveEnemies(
        state.enemiesPerWave, cx, cy, state.enemySpeed, state.wave,
      )
      state.enemies.push(...newEnemies)
    }
    // Still process particles and note display during announce
    updateParticles(state.particles, dt)
    if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt
    return
  }

  // Handle note attack input
  if (input.activeNote) {
    // Only attack if this is a new note (not held from previous frame)
    if (state.lastNoteAttack !== input.activeNote || state.noteAttackTimer <= 0) {
      const { kills, hitPositions } = attackWithNote(input.activeNote, state.enemies, state.particles)
      state.lastNoteAttack = input.activeNote
      state.noteAttackTimer = NOTE_ATTACK_DISPLAY_DURATION

      // ビーム生成: プレイヤー → 撃破位置
      const beamColor = COLORS.noteColors[input.activeNote]
      for (const pos of hitPositions) {
        state.beams.push({
          from: { x: state.player.pos.x, y: state.player.pos.y },
          to: { x: pos.x, y: pos.y },
          color: beamColor,
          life: BEAM_LIFE,
          maxLife: BEAM_LIFE,
        })
      }

      if (kills > 0) {
        // Combo system
        if (state.time - state.lastAttackTime < COMBO_TIMEOUT) {
          state.combo += kills
        } else {
          state.combo = kills
        }
        state.lastAttackTime = state.time
        const comboMultiplier = Math.max(1, Math.floor(state.combo / 3))
        state.score += kills * 100 * comboMultiplier
      }
    }
  } else {
    if (state.noteAttackTimer <= 0) {
      state.lastNoteAttack = null
    }
  }

  if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt

  // Move enemies
  moveEnemies(state.enemies, dt)

  // Check collisions
  checkEnemyPlayerCollision(state.enemies, state.player, state.time)

  // インベーダーが画面最下段に到達したらダメージ＆消滅
  for (const e of state.enemies) {
    if (!e.alive || e.enemyType !== 'invader') continue
    if (e.pos.y >= CANVAS_BASE_HEIGHT - 20) {
      e.alive = false
      if (state.time >= state.player.invincibleUntil) {
        state.player.hp--
        state.player.invincibleUntil = state.time + 1.5
        state.player.damageFlash = 0.3
      }
    }
  }

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
    return
  }

  // Wave management
  if (state.enemies.length === 0) {
    state.waveTimer -= dt
    if (state.waveTimer <= 0) {
      state.wave++
      state.enemiesPerWave = ENEMIES_BASE_COUNT + (state.wave - 1) * ENEMIES_INCREMENT
      state.enemySpeed = ENEMY_BASE_SPEED + (state.wave - 1) * ENEMY_SPEED_INCREMENT
      state.phase = 'waveAnnounce'
      state.waveAnnounceTimer = WAVE_ANNOUNCE_DURATION
      state.waveTimer = WAVE_INTERVAL
    }
  }
}

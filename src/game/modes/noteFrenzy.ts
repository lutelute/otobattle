import type { GameState, GameInput, BeamStyle } from '../types'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED, ENEMY_SPEED_INCREMENT,
  ENEMIES_BASE_COUNT, ENEMIES_INCREMENT,
  WAVE_ANNOUNCE_DURATION, WAVE_INTERVAL,
  NOTE_ATTACK_DISPLAY_DURATION, COMBO_TIMEOUT,
  BEAM_LIFE, COLORS,
} from '../constants'
import { spawnWaveEnemies } from '../enemies'
import { attackWithNote, updateParticles } from '../collision'

/**
 * NoteFrenzy mode update function.
 *
 * Handles mode-specific logic:
 * - Wave announce phase (enemy spawning via spawnWaveEnemies)
 * - Note attack input processing (beam creation, combo system)
 * - Invader bottom-screen damage check
 * - Wave management (advancing waves when all enemies defeated)
 *
 * Common logic (enemy movement, particle updates, beam decay, damage flash,
 * enemy-player collision, dead enemy removal, game-over check) stays in engine.ts.
 *
 * @returns true if common logic should be skipped (during waveAnnounce phase)
 */
export function updateNoteFrenzyMode(
  state: GameState,
  dt: number,
  input: GameInput,
): boolean {
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
    return true // Skip common logic during announce
  }

  // Handle note attack input
  if (input.activeNote) {
    // Only attack if this is a new note (not held from previous frame)
    if (state.lastNoteAttack !== input.activeNote || state.noteAttackTimer <= 0) {
      const { kills, hitPositions } = attackWithNote(input.activeNote, state.enemies, state.particles)
      state.lastNoteAttack = input.activeNote
      state.noteAttackTimer = NOTE_ATTACK_DISPLAY_DURATION

      // Beam generation: player -> hit positions
      const beamColor = COLORS.noteColors[input.activeNote]
      const beamStyle: BeamStyle = state.combo >= 5 ? 'lightning' : state.combo >= 3 ? 'zigzag' : 'straight'
      for (const pos of hitPositions) {
        state.beams.push({
          from: { x: state.player.pos.x, y: state.player.pos.y },
          to: { x: pos.x, y: pos.y },
          color: beamColor,
          life: BEAM_LIFE,
          maxLife: BEAM_LIFE,
          style: beamStyle,
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

  // Invader bottom-screen damage check
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

  // Wave management - check alive enemies (dead ones are filtered in common logic)
  const hasAliveEnemies = state.enemies.some(e => e.alive)
  if (!hasAliveEnemies) {
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

  return false // Proceed with common logic
}

import type { GameState, GameInput, NoteName, BeamStyle, ClefType } from '../types'
import type { ScalesState, ScaleType, ScaleDirection } from './types'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED, ENEMY_SPEED_INCREMENT,
  WAVE_ANNOUNCE_DURATION, WAVE_INTERVAL,
  NOTE_ATTACK_DISPLAY_DURATION, COMBO_TIMEOUT,
  BEAM_LIFE, COLORS,
  SCALE_PROGRESSION, SCALE_TYPE_UNLOCK,
  BASS_CLEF_UNLOCK_WAVE, ALTO_CLEF_UNLOCK_WAVE,
} from '../constants'
import { spawnEnemy } from '../enemies'
import { attackWithNote, updateParticles } from '../collision'
import { getScaleNotes, normalizeNoteName } from '../musicTheory'

// ─── Internal extended state ─────────────────────────────────────────

/**
 * Internal state extending ScalesState with implementation details.
 * Stored in state.modeState.data as Record<string, unknown>.
 */
interface ScalesData extends ScalesState {
  /** Whether the current ascending+descending cycle is complete */
  scaleComplete: boolean
  /** Index in SCALE_PROGRESSION for current key */
  keyIndex: number
  /** Original key name for tonal library (may use flat notation like 'Bb') */
  tonalKey: string
}

/** Read ScalesData from GameState.modeState.data */
function getScalesData(state: GameState): ScalesData {
  return state.modeState!.data as unknown as ScalesData
}

/** Write ScalesData back to GameState.modeState.data */
function setScalesData(state: GameState, data: ScalesData): void {
  state.modeState!.data = data as unknown as Record<string, unknown>
}

// ─── Initialization ──────────────────────────────────────────────────

/**
 * Create initial Scales mode state data.
 * Called by engine.ts createModeState() to initialize mode-specific data.
 */
export function createScalesState(): ScalesState {
  const tonalKey = SCALE_PROGRESSION[0] // 'C'
  const scaleType: ScaleType = 'major'
  const scaleNotes = getScaleNotes(tonalKey, scaleType)
  const normalizedKey = normalizeNoteName(tonalKey)

  // Return as ScalesData (extended) but typed as ScalesState for the public API.
  // Extra fields (scaleComplete, keyIndex, tonalKey) are stored in the
  // Record<string, unknown> data bag and accessed internally via getScalesData().
  const data: ScalesData = {
    progress: 0,
    currentScale: scaleType,
    scaleKey: normalizedKey ?? 'C',
    currentDegree: 0,
    direction: 'ascending' as ScaleDirection,
    scaleNotes,
    clef: 'treble',
    scaleComplete: false,
    keyIndex: 0,
    tonalKey,
  }

  return data
}

// ─── Scale sequence helpers ──────────────────────────────────────────

/**
 * Get the expected note for the current position in the scale sequence.
 *
 * Ascending:  scaleNotes[0] → scaleNotes[length-1]
 * Descending: scaleNotes[length-2] → scaleNotes[0]  (skip top note)
 *
 * Full cycle for 7-note scale (e.g. C major):
 *   C → D → E → F → G → A → B → A → G → F → E → D → C  (13 notes)
 */
function getCurrentTargetNote(data: ScalesData): NoteName | null {
  if (data.scaleNotes.length === 0 || data.scaleComplete) return null

  if (data.direction === 'ascending') {
    if (data.currentDegree >= data.scaleNotes.length) return null
    return data.scaleNotes[data.currentDegree]
  } else {
    // Descending: skip the top note (already played at end of ascending)
    // currentDegree 0 → scaleNotes[length-2]
    // currentDegree 1 → scaleNotes[length-3]
    // ...
    // currentDegree (length-2) → scaleNotes[0] (root)
    const index = data.scaleNotes.length - 2 - data.currentDegree
    if (index < 0 || index >= data.scaleNotes.length) return null
    return data.scaleNotes[index]
  }
}

/**
 * Advance to the next degree in the scale.
 * @returns true if the full ascending + descending cycle is complete
 */
function advanceDegree(data: ScalesData): boolean {
  if (data.direction === 'ascending') {
    if (data.currentDegree >= data.scaleNotes.length - 1) {
      // Finished ascending (just played top note), switch to descending
      data.direction = 'descending'
      data.currentDegree = 0
      return false
    }
    data.currentDegree++
    return false
  } else {
    // Descending: (length - 1) steps total (0 through length-2)
    const maxDescendStep = data.scaleNotes.length - 2
    if (data.currentDegree >= maxDescendStep) {
      // Just played the root note, scale complete!
      data.scaleComplete = true
      return true
    }
    data.currentDegree++
    return false
  }
}

/**
 * Get available scale types for the current wave based on SCALE_TYPE_UNLOCK.
 */
function getAvailableScaleTypes(wave: number): ScaleType[] {
  const available: ScaleType[] = []
  for (const [scaleType, unlockWave] of Object.entries(SCALE_TYPE_UNLOCK)) {
    if (wave >= unlockWave) {
      available.push(scaleType as ScaleType)
    }
  }
  return available.length > 0 ? available : ['major']
}

/**
 * Pick a clef for the current wave, matching noteFrenzy unlock pattern.
 * All notes within a scale use the same clef for consistency.
 */
function pickClefForWave(wave: number): ClefType {
  if (wave >= ALTO_CLEF_UNLOCK_WAVE && Math.random() < 0.3) return 'alto'
  if (wave >= BASS_CLEF_UNLOCK_WAVE && Math.random() < 0.4) return 'bass'
  return 'treble'
}

// ─── Enemy spawning ──────────────────────────────────────────────────

/**
 * Spawn a single enemy with the current scale degree's note.
 * Reuses the standard spawnEnemy for positioning/velocity, then overrides
 * the note and clef to match the scale sequence.
 */
function spawnScaleEnemy(state: GameState, data: ScalesData): void {
  const targetNote = getCurrentTargetNote(data)
  if (!targetNote) return

  const cx = CANVAS_BASE_WIDTH / 2
  const cy = CANVAS_BASE_HEIGHT / 2

  const enemy = spawnEnemy(cx, cy, state.enemySpeed, state.wave)
  enemy.note = targetNote
  enemy.clef = data.clef

  state.enemies.push(enemy)
}

// ─── Wave management ─────────────────────────────────────────────────

/**
 * Advance to the next wave with a new key (circle of fifths) and
 * possibly a new scale type based on unlock progression.
 *
 * Wave 0→1: keep initial scale data (C major), just enter announce phase.
 * Wave N→N+1 (N≥1): advance key, pick scale type, regenerate notes.
 */
function advanceToNextWave(state: GameState, data: ScalesData): void {
  state.wave++

  if (state.wave > 1) {
    // Advance key through circle of fifths
    data.keyIndex = (data.keyIndex + 1) % SCALE_PROGRESSION.length
    data.tonalKey = SCALE_PROGRESSION[data.keyIndex]
    const normalizedKey = normalizeNoteName(data.tonalKey)
    data.scaleKey = normalizedKey ?? 'C'

    // Pick scale type based on unlocks
    const availableTypes = getAvailableScaleTypes(state.wave)
    data.currentScale = availableTypes[
      Math.floor(Math.random() * availableTypes.length)
    ]

    // Regenerate scale notes
    data.scaleNotes = getScaleNotes(data.tonalKey, data.currentScale)

    // Fallback if tonal returns empty (invalid key/scale combination)
    if (data.scaleNotes.length === 0) {
      data.scaleNotes = getScaleNotes('C', 'major')
      data.tonalKey = 'C'
      data.scaleKey = 'C'
      data.currentScale = 'major'
    }

    // Pick clef for the entire scale
    data.clef = pickClefForWave(state.wave)
  }

  // Reset for ascending
  data.direction = 'ascending'
  data.currentDegree = 0
  data.scaleComplete = false

  // Increase difficulty (apply speed multiplier from difficulty settings)
  const speedMult = state.difficulty?.speedMultiplier ?? 1.0
  state.enemySpeed = (ENEMY_BASE_SPEED + (state.wave - 1) * ENEMY_SPEED_INCREMENT) * speedMult

  // Update progress
  data.progress = data.keyIndex / SCALE_PROGRESSION.length

  setScalesData(state, data)

  // Enter wave announce phase
  state.phase = 'waveAnnounce'
  state.waveAnnounceTimer = WAVE_ANNOUNCE_DURATION
  state.waveTimer = WAVE_INTERVAL
}

// ─── Progress tracking ──────────────────────────────────────────────

/**
 * Update the mode progress indicator (0.0 – 1.0) within the current scale.
 *
 * For a 7-note scale the full cycle has 13 steps:
 *   ascending 0–6 (7 notes) + descending 0–5 (6 notes, skip top)
 */
function updateProgress(state: GameState, data: ScalesData): void {
  if (data.scaleComplete) {
    state.modeState!.progress = 1.0
    data.progress = 1.0
    return
  }

  const scaleLen = data.scaleNotes.length
  if (scaleLen === 0) return

  // Total steps in a full ascending + descending cycle
  const totalSteps = scaleLen + (scaleLen - 1) // e.g. 7 + 6 = 13

  // Completed steps so far
  const completedSteps = data.direction === 'ascending'
    ? data.currentDegree
    : scaleLen + data.currentDegree

  const progress = completedSteps / totalSteps
  data.progress = progress
  state.modeState!.progress = progress
}

// ─── Main update function ────────────────────────────────────────────

/**
 * Scales mode update function.
 *
 * Handles mode-specific logic:
 * - Wave announce phase (scale initialization, first enemy spawn)
 * - Note attack input: only the correct scale degree note kills the enemy
 * - Enemy spawning: one at a time in scale order (ascending then descending)
 * - Wave management: one wave = one complete scale (ascending + descending)
 * - Scale key progression via circle of fifths
 * - Scale type unlocking based on SCALE_TYPE_UNLOCK
 *
 * Common logic (enemy movement, particle updates, beam decay, damage flash,
 * enemy-player collision, dead enemy removal, game-over check) stays in engine.ts.
 *
 * @returns true if common logic should be skipped (during waveAnnounce phase)
 */
export function updateScalesMode(
  state: GameState,
  dt: number,
  input: GameInput,
): boolean {
  const data = getScalesData(state)

  // ── Wave announce phase ──────────────────────────────────────────
  if (state.phase === 'waveAnnounce') {
    state.waveAnnounceTimer -= dt
    if (state.waveAnnounceTimer <= 0) {
      state.phase = 'playing'
      // Spawn first enemy of the scale
      spawnScaleEnemy(state, data)
    }
    // Still process particles and note display during announce
    updateParticles(state.particles, dt)
    if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt
    return true // Skip common logic during announce
  }

  // ── Note attack input ────────────────────────────────────────────
  let handledKill = false

  if (input.activeNote) {
    const targetNote = getCurrentTargetNote(data)

    // Only the correct next note in the scale sequence can kill the enemy
    if (targetNote && input.activeNote === targetNote) {
      if (state.lastNoteAttack !== input.activeNote || state.noteAttackTimer <= 0) {
        const { kills, hitPositions } = attackWithNote(
          input.activeNote, state.enemies, state.particles,
        )
        state.lastNoteAttack = input.activeNote
        state.noteAttackTimer = NOTE_ATTACK_DISPLAY_DURATION

        // Beam generation: player → hit positions
        const beamColor = COLORS.noteColors[input.activeNote]
        const beamStyle: BeamStyle =
          state.combo >= 5 ? 'lightning' :
          state.combo >= 3 ? 'zigzag' : 'straight'

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
          handledKill = true

          // Combo system
          if (state.time - state.lastAttackTime < COMBO_TIMEOUT) {
            state.combo += kills
          } else {
            state.combo = kills
          }
          state.lastAttackTime = state.time
          const comboMultiplier = Math.max(1, Math.floor(state.combo / 3))
          state.score += kills * 100 * comboMultiplier

          // Advance to next degree in the scale
          const scaleComplete = advanceDegree(data)
          setScalesData(state, data)

          if (scaleComplete) {
            // Scale cycle complete — start wave transition timer
            state.waveTimer = WAVE_INTERVAL
          } else {
            // Spawn the next enemy in the sequence
            spawnScaleEnemy(state, data)
          }
        }
      }
    }
    // Wrong note: do nothing (no kill, no HP loss)
  } else {
    if (state.noteAttackTimer <= 0) {
      state.lastNoteAttack = null
    }
  }

  if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt

  // ── Enemy respawn / wave management ──────────────────────────────
  // Handle enemies that died from causes other than correct note input
  // (e.g. enemy-player collision in the previous frame's common logic)
  if (!handledKill) {
    const hasAliveEnemies = state.enemies.some(e => e.alive)
    if (!hasAliveEnemies) {
      if (data.scaleComplete || state.wave === 0) {
        // Scale complete or initial state: count down to next wave
        state.waveTimer -= dt
        if (state.waveTimer <= 0) {
          advanceToNextWave(state, data)
        }
      } else {
        // Enemy died from collision — respawn for the same degree
        // (player still needs to play this note to advance)
        spawnScaleEnemy(state, data)
      }
    }
  }

  // ── Update progress indicator ────────────────────────────────────
  updateProgress(state, data)

  return false // Proceed with common logic
}

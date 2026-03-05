import type { GameState, GameInput, NoteName, BeamStyle, ClefType, EnemyShape } from '../types'
import type { ChordsState } from './types'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED, ENEMY_SPEED_INCREMENT,
  WAVE_ANNOUNCE_DURATION, WAVE_INTERVAL,
  NOTE_ATTACK_DISPLAY_DURATION, COMBO_TIMEOUT,
  BEAM_LIFE, COLORS,
  CHORD_TYPE_UNLOCK, CHORD_INPUT_WINDOW,
  BASS_CLEF_UNLOCK_WAVE, ALTO_CLEF_UNLOCK_WAVE,
} from '../constants'
import { spawnEnemy } from '../enemies'
import { attackWithChord, updateParticles } from '../collision'
import { getChordNotes } from '../musicTheory'
import { randomInt } from '../../utils/math'

// ─── Chord name generation helpers ──────────────────────────────────

/** Root notes used for chord generation (natural notes + common sharps) */
const CHORD_ROOTS: string[] = [
  'C', 'D', 'E', 'F', 'G', 'A', 'B',
  'C#', 'D#', 'F#', 'G#', 'A#',
]

/**
 * Internal state extending ChordsState with implementation details.
 * Stored in state.modeState.data as Record<string, unknown>.
 */
interface ChordsData extends ChordsState {
  /** Whether the current chord has been completed */
  chordComplete: boolean
  /** Accumulated chord types unlocked so far */
  unlockedTypes: string[]
}

/** Read ChordsData from GameState.modeState.data */
function getChordsData(state: GameState): ChordsData {
  return state.modeState!.data as unknown as ChordsData
}

/** Write ChordsData back to GameState.modeState.data */
function setChordsData(state: GameState, data: ChordsData): void {
  state.modeState!.data = data as unknown as Record<string, unknown>
}

// ─── Initialization ──────────────────────────────────────────────────

/**
 * Create initial Chords mode state data.
 * Called by engine.ts createModeState() to initialize mode-specific data.
 */
export function createChordsState(): ChordsState {
  const data: ChordsData = {
    progress: 0,
    currentChord: 'C',
    chordGroupId: 0,
    activeChordNotes: ['C', 'E', 'G'],
    matchedNotes: [],
    chordInputStartTime: 0,
    nextGroupId: 1,
    chordComplete: false,
    unlockedTypes: ['major', 'minor'],
  }
  return data
}

// ─── Chord type progression ─────────────────────────────────────────

/**
 * Get available chord types for the current wave based on CHORD_TYPE_UNLOCK.
 * Progressive difficulty: triads (wave 1-3) → 7th chords (wave 4-6) → extended (wave 7+)
 */
function getAvailableChordTypes(wave: number): string[] {
  const available: string[] = []
  for (const [chordType, unlockWave] of Object.entries(CHORD_TYPE_UNLOCK)) {
    if (wave >= unlockWave) {
      available.push(chordType)
    }
  }
  return available.length > 0 ? available : ['major']
}

/**
 * Generate a random chord name from available types and roots.
 * Returns the tonal-compatible chord name (e.g. 'Cmaj7', 'Dm', 'G7').
 */
function generateChordName(wave: number): string {
  const types = getAvailableChordTypes(wave)
  const chordType = types[randomInt(0, types.length - 1)]
  const root = CHORD_ROOTS[randomInt(0, CHORD_ROOTS.length - 1)]

  // Map internal type names to tonal-compatible chord symbols
  const typeToSymbol: Record<string, string> = {
    'major': '',         // C = C major
    'minor': 'm',        // Cm = C minor
    'dim': 'dim',        // Cdim
    'aug': 'aug',        // Caug
    'maj7': 'maj7',      // Cmaj7
    'min7': 'm7',        // Cm7
    'dom7': '7',         // C7
    'dim7': 'dim7',      // Cdim7
    'min9': 'm9',        // Cm9
    'maj9': 'maj9',      // Cmaj9
    'dom9': '9',         // C9
    '13': '13',          // C13
    'alt': '7alt',       // C7alt
  }

  const symbol = typeToSymbol[chordType] ?? ''
  return `${root}${symbol}`
}

// ─── Enemy spawning ──────────────────────────────────────────────────

/**
 * Pick a clef for the current wave, matching noteFrenzy unlock pattern.
 */
function pickClefForWave(wave: number): ClefType {
  if (wave >= ALTO_CLEF_UNLOCK_WAVE && Math.random() < 0.3) return 'alto'
  if (wave >= BASS_CLEF_UNLOCK_WAVE && Math.random() < 0.4) return 'bass'
  return 'treble'
}

/**
 * Spawn a chord group: 2-4 enemies simultaneously, each showing one note
 * of the chord. All enemies share the same chordGroupId.
 */
function spawnChordGroup(state: GameState, data: ChordsData): void {
  const chordName = generateChordName(state.wave)
  const notes = getChordNotes(chordName)

  // Fallback: if tonal returns empty or single note, use C major triad
  const chordNotes = notes.length >= 2 ? notes : getChordNotes('C')
  const finalNotes = chordNotes.length >= 2 ? chordNotes : ['C' as NoteName, 'E' as NoteName, 'G' as NoteName]

  // Limit to 4 notes max for playability
  const spawnNotes = finalNotes.slice(0, 4)

  const groupId = data.nextGroupId++
  const groupIdStr = `chord-${groupId}`
  const clef = pickClefForWave(state.wave)
  const shapes: EnemyShape[] = ['square', 'diamond', 'circle', 'triangle', 'hexagon', 'cross']

  // Update chords data
  data.currentChord = chordName
  data.chordGroupId = groupId
  data.activeChordNotes = spawnNotes
  data.matchedNotes = []
  data.chordInputStartTime = 0
  data.chordComplete = false

  // Spawn enemies - use spawnEnemy for positioning then override note + groupId
  for (const note of spawnNotes) {
    const cx = CANVAS_BASE_WIDTH / 2
    const cy = CANVAS_BASE_HEIGHT / 2
    const enemy = spawnEnemy(cx, cy, state.enemySpeed, state.wave)
    enemy.note = note
    enemy.clef = clef
    enemy.chordGroupId = groupIdStr
    enemy.shape = shapes[enemy.id % shapes.length]
    state.enemies.push(enemy)
  }

  setChordsData(state, data)
}

// ─── Wave management ─────────────────────────────────────────────────

/**
 * Determine how many chord groups to spawn per wave.
 * Early waves: 1-2 groups, later waves: 2-4 groups.
 */
function chordsPerWave(wave: number): number {
  if (wave <= 2) return 1
  if (wave <= 5) return 2
  if (wave <= 8) return 3
  return 4
}

/**
 * Advance to the next wave with potentially harder chord types.
 */
function advanceToNextWave(state: GameState, data: ChordsData): void {
  state.wave++

  // Update unlocked types
  data.unlockedTypes = getAvailableChordTypes(state.wave)

  // Increase difficulty (apply speed multiplier from difficulty settings)
  const speedMult = state.difficulty?.speedMultiplier ?? 1.0
  state.enemySpeed = (ENEMY_BASE_SPEED + (state.wave - 1) * ENEMY_SPEED_INCREMENT) * speedMult

  // Update progress based on wave (approximate)
  const maxWaves = 20
  data.progress = Math.min(1.0, (state.wave - 1) / maxWaves)

  setChordsData(state, data)

  // Enter wave announce phase
  state.phase = 'waveAnnounce'
  state.waveAnnounceTimer = WAVE_ANNOUNCE_DURATION
  state.waveTimer = WAVE_INTERVAL
}

// ─── Partial match tracking ──────────────────────────────────────────

/**
 * Update the matched notes for partial chord input.
 * Tracks which notes the player has correctly pressed within the input window.
 */
function updateMatchedNotes(
  data: ChordsData,
  activeNotes: NoteName[],
  currentTime: number,
): void {
  if (activeNotes.length === 0) return

  // Start the input window timer on first note press
  if (data.chordInputStartTime === 0) {
    data.chordInputStartTime = currentTime
  }

  // Check if we're within the input window
  if (currentTime - data.chordInputStartTime > CHORD_INPUT_WINDOW) {
    // Window expired, reset
    data.matchedNotes = []
    data.chordInputStartTime = currentTime
  }

  // Track matched notes (notes that are both active and part of the chord)
  const newMatched: NoteName[] = []
  for (const note of data.activeChordNotes) {
    if (activeNotes.includes(note)) {
      newMatched.push(note)
    }
  }
  data.matchedNotes = newMatched
}

// ─── Main update function ────────────────────────────────────────────

/**
 * Chords mode update function.
 *
 * Handles mode-specific logic:
 * - Wave announce phase (chord group spawning)
 * - Chord attack input: all notes of a chord group must be pressed
 *   within CHORD_INPUT_WINDOW to kill the group
 * - Partial match tracking in ChordsState.matchedNotes
 * - Beam generation from player to all chord group enemies on match
 * - Progressive difficulty: triads → 7th chords → extended chords
 * - Wave management: one wave = N chord groups defeated
 *
 * Common logic (enemy movement, particle updates, beam decay, damage flash,
 * enemy-player collision, dead enemy removal, game-over check) stays in engine.ts.
 *
 * @returns true if common logic should be skipped (during waveAnnounce phase)
 */
export function updateChordsMode(
  state: GameState,
  dt: number,
  input: GameInput,
): boolean {
  const data = getChordsData(state)

  // ── Wave announce phase ──────────────────────────────────────────
  if (state.phase === 'waveAnnounce') {
    state.waveAnnounceTimer -= dt
    if (state.waveAnnounceTimer <= 0) {
      state.phase = 'playing'
      // Spawn first chord group of the wave
      spawnChordGroup(state, data)
    }
    // Still process particles and note display during announce
    updateParticles(state.particles, dt)
    if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt
    return true // Skip common logic during announce
  }

  // ── Chord attack input ────────────────────────────────────────────
  const activeNotes = input.activeNotes ?? (input.activeNote ? [input.activeNote] : [])
  let handledKill = false

  if (activeNotes.length > 0) {
    // Update partial match tracking
    updateMatchedNotes(data, activeNotes, state.time)
    setChordsData(state, data)

    // Attempt chord attack: check if all notes of any chord group are pressed
    const { kills, hitPositions } = attackWithChord(activeNotes, state.enemies, state.particles)

    if (kills > 0) {
      handledKill = true
      state.noteAttackTimer = NOTE_ATTACK_DISPLAY_DURATION
      state.lastNoteAttack = activeNotes[0] ?? null

      // Beam generation: player → all hit positions (one beam per killed enemy)
      const beamStyle: BeamStyle =
        state.combo >= 5 ? 'lightning' :
        state.combo >= 3 ? 'zigzag' : 'straight'

      for (const pos of hitPositions) {
        // Find the note at this position for correct beam color
        // Use a default color based on first active note
        const beamColor = COLORS.noteColors[activeNotes[0]] ?? '#ffffff'
        state.beams.push({
          from: { x: state.player.pos.x, y: state.player.pos.y },
          to: { x: pos.x, y: pos.y },
          color: beamColor,
          life: BEAM_LIFE,
          maxLife: BEAM_LIFE,
          style: beamStyle,
        })
      }

      // Combo system
      if (state.time - state.lastAttackTime < COMBO_TIMEOUT) {
        state.combo += kills
      } else {
        state.combo = kills
      }
      state.lastAttackTime = state.time
      const comboMultiplier = Math.max(1, Math.floor(state.combo / 3))
      // Chord kills are worth more (whole chord = bonus)
      state.score += kills * 150 * comboMultiplier

      // Reset matched notes after successful chord
      data.matchedNotes = []
      data.chordInputStartTime = 0
      data.chordComplete = true
      setChordsData(state, data)
    }
  } else {
    if (state.noteAttackTimer <= 0) {
      state.lastNoteAttack = null
    }
    // Reset input window when no notes are pressed
    if (data.chordInputStartTime > 0 &&
        state.time - data.chordInputStartTime > CHORD_INPUT_WINDOW) {
      data.matchedNotes = []
      data.chordInputStartTime = 0
      setChordsData(state, data)
    }
  }

  if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt

  // ── Invader bottom-screen damage check ─────────────────────────
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

  // ── Enemy respawn / wave management ────────────────────────────
  if (!handledKill) {
    const hasAliveEnemies = state.enemies.some(e => e.alive)
    if (!hasAliveEnemies) {
      if (state.wave === 0) {
        // Initial state: count down to first wave
        state.waveTimer -= dt
        if (state.waveTimer <= 0) {
          advanceToNextWave(state, data)
        }
      } else {
        // Check if we need more chord groups this wave
        // Count how many groups we've completed (based on nextGroupId vs wave start)
        const groupsThisWave = data.nextGroupId - data.chordGroupId
        const targetGroups = chordsPerWave(state.wave)

        if (groupsThisWave < targetGroups && data.chordComplete) {
          // Spawn next chord group in this wave
          spawnChordGroup(state, data)
        } else if (!data.chordComplete) {
          // Current chord group died from collision — respawn it
          spawnChordGroup(state, data)
        } else {
          // All chord groups for this wave are done
          state.waveTimer -= dt
          if (state.waveTimer <= 0) {
            advanceToNextWave(state, data)
          }
        }
      }
    }
  }

  // ── Update progress indicator ──────────────────────────────────
  state.modeState!.progress = data.progress

  return false // Proceed with common logic
}

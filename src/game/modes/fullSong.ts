import type { GameState, GameInput, BeamStyle } from '../types'
import type { FullSongState, MidiNoteEvent } from './types'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  ENEMY_BASE_SPEED,
  NOTE_ATTACK_DISPLAY_DURATION, COMBO_TIMEOUT,
  BEAM_LIFE, COLORS,
} from '../constants'
import { spawnEnemy } from '../enemies'
import { attackWithNote } from '../collision'

// ─── Internal extended state ─────────────────────────────────────────

/**
 * Internal state extending FullSongState with implementation details.
 * Stored in state.modeState.data as Record<string, unknown>.
 */
interface FullSongData extends FullSongState {
  /** Whether the song is fully complete (all notes spawned and cleared) */
  songComplete: boolean
  /** Total number of notes in the timeline */
  totalNotes: number
  /** Number of spawned enemies that were killed */
  notesHit: number
  /** Game time when song started playing */
  songStartTime: number
}

/** Read FullSongData from GameState.modeState.data */
function getFullSongData(state: GameState): FullSongData {
  return state.modeState!.data as unknown as FullSongData
}

/** Write FullSongData back to GameState.modeState.data */
function setFullSongData(state: GameState, data: FullSongData): void {
  state.modeState!.data = data as unknown as Record<string, unknown>
}

// ─── Initialization ──────────────────────────────────────────────────

/**
 * Create initial Full Song mode state data.
 * Called after MIDI file is parsed and track is selected.
 *
 * @param timeline - Note events extracted from the selected MIDI track
 * @param songName - File/track name for display
 * @param songDuration - Total song duration in seconds
 * @param selectedTrack - Index of the selected MIDI track
 */
export function createFullSongState(
  timeline: MidiNoteEvent[],
  songName: string = 'Untitled',
  songDuration: number = 0,
  selectedTrack: number = 0,
): FullSongState {
  const computedDuration = songDuration || (
    timeline.length > 0
      ? timeline[timeline.length - 1].time + timeline[timeline.length - 1].duration
      : 0
  )

  const data: FullSongData = {
    progress: 0,
    midiTimeline: timeline,
    currentNoteIndex: 0,
    songProgress: 0,
    selectedTrack,
    songDuration: computedDuration,
    songName,
    availableTracks: [],
    songComplete: false,
    totalNotes: timeline.length,
    notesHit: 0,
    songStartTime: 0,
  }

  return data
}

// ─── Enemy spawning ──────────────────────────────────────────────────

/**
 * Spawn an enemy for a MIDI note event.
 * Reuses the standard spawnEnemy for positioning/velocity from a random edge,
 * then overrides the note to match the MIDI timeline.
 */
function spawnSongEnemy(state: GameState, noteEvent: MidiNoteEvent): void {
  const cx = CANVAS_BASE_WIDTH / 2
  const cy = CANVAS_BASE_HEIGHT / 2

  const enemy = spawnEnemy(cx, cy, ENEMY_BASE_SPEED, 1)
  enemy.note = noteEvent.note

  state.enemies.push(enemy)
}

// ─── Main update function ────────────────────────────────────────────

/**
 * Full Song mode update function.
 *
 * Handles mode-specific logic:
 * - Timeline-based enemy spawning (enemies spawn when game time reaches MIDI note times)
 * - Note attack input processing (same as noteFrenzy — match note name to kill)
 * - Song progress tracking (currentNoteIndex / totalNotes, elapsed / duration)
 * - Song completion detection (all enemies spawned and cleared)
 *
 * Common logic (enemy movement, particle updates, beam decay, damage flash,
 * enemy-player collision, dead enemy removal, game-over check) stays in engine.ts.
 *
 * @returns true if common logic should be skipped
 */
export function updateFullSongMode(
  state: GameState,
  dt: number,
  input: GameInput,
): boolean {
  const data = getFullSongData(state)

  // Handle empty timeline edge case
  if (data.midiTimeline.length === 0) {
    data.songComplete = true
    setFullSongData(state, data)
    state.phase = 'gameover'
    return true
  }

  // Initialize song start time on first frame
  if (data.songStartTime === 0 && state.time > 0) {
    data.songStartTime = state.time
  }

  // Elapsed time since song started
  const elapsed = state.time - data.songStartTime

  // ── Timeline-based spawning ──────────────────────────────────────
  // Spawn enemies when game time reaches their scheduled time
  while (
    data.currentNoteIndex < data.midiTimeline.length &&
    elapsed >= data.midiTimeline[data.currentNoteIndex].time
  ) {
    spawnSongEnemy(state, data.midiTimeline[data.currentNoteIndex])
    data.currentNoteIndex++
  }

  // Update song progress
  data.songProgress = elapsed
  if (data.songDuration > 0) {
    data.progress = Math.min(1.0, elapsed / data.songDuration)
    state.modeState!.progress = data.progress
  }

  // ── Note attack input (same as noteFrenzy) ───────────────────────
  if (input.activeNote) {
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
        data.notesHit += kills

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

  // ── Song completion check ────────────────────────────────────────
  const allSpawned = data.currentNoteIndex >= data.midiTimeline.length
  const allCleared = !state.enemies.some(e => e.alive)

  if (allSpawned && allCleared && !data.songComplete) {
    data.songComplete = true
    setFullSongData(state, data)
    state.phase = 'gameover'
    return true
  }

  setFullSongData(state, data)
  return false // Proceed with common logic (enemy movement, collision, etc.)
}

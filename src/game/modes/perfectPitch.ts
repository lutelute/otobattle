import type { GameState, GameInput, NoteName, NoteRangeConfig } from '../types'
import type { PerfectPitchState } from './types'
import {
  CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT,
  PERFECT_PITCH_TIMEOUT, PERFECT_PITCH_REPLAY_LIMIT,
  WAVE_ANNOUNCE_DURATION, COLORS,
} from '../constants'
import { updateParticles } from '../collision'
import { ALL_NOTE_NAMES, WHITE_NOTE_NAMES } from '../notes'
import { filterNotesByRange } from '../enemies'
import { playReferenceNote, replayReferenceNote } from '../../audio/noteSynth'

// ─── Internal extended state ─────────────────────────────────────────

/**
 * Internal state extending PerfectPitchState with implementation details.
 * Stored in state.modeState.data as Record<string, unknown>.
 */
interface PerfectPitchData extends PerfectPitchState {
  /** Total challenges completed across all waves */
  challengesCompleted: number
  /** Number of challenges to complete per wave */
  challengesPerWave: number
  /** Challenges completed in the current wave */
  challengesInWave: number
  /** Available notes for the current difficulty level */
  allowedNotes: NoteName[]
  /** Phase of the challenge: 'playing' = audio playing, 'waiting' = waiting for input, 'feedback' = showing result */
  challengePhase: 'playing' | 'waiting' | 'feedback'
  /** Feedback timer (seconds remaining in feedback phase) */
  feedbackTimer: number
  /** Whether the last answer was correct (for feedback display) */
  lastAnswerCorrect: boolean
  /** Whether audio has been triggered for the current challenge */
  audioTriggered: boolean
  /** Best streak achieved */
  bestStreak: number
}

/** Read PerfectPitchData from GameState.modeState.data */
function getPerfectPitchData(state: GameState): PerfectPitchData {
  return state.modeState!.data as unknown as PerfectPitchData
}

/** Write PerfectPitchData back to GameState.modeState.data */
function setPerfectPitchData(state: GameState, data: PerfectPitchData): void {
  state.modeState!.data = data as unknown as Record<string, unknown>
}

// ─── Initialization ──────────────────────────────────────────────────

/**
 * Build the allowed notes array based on the current wave.
 * Wave 1: C, D, E (3 notes)
 * Wave 2: C, D, E, F (4 notes)
 * Wave N: first min(N+2, 12) notes from chromatic scale
 *
 * Only uses white keys until all 7 are unlocked, then adds sharps.
 * Optionally filtered by noteRange configuration.
 */
function buildAllowedNotes(wave: number, noteRange?: NoteRangeConfig): NoteName[] {
  const noteCount = Math.min(wave + 2, 12)

  let notes: NoteName[]
  if (noteCount <= 7) {
    // Use white keys first: C, D, E, F, G, A, B
    notes = WHITE_NOTE_NAMES.slice(0, noteCount)
  } else {
    // All white keys + add sharps progressively
    const sharpsNeeded = noteCount - 7
    const sharpOrder: NoteName[] = ['F#', 'C#', 'G#', 'D#', 'A#']
    const sharps = sharpOrder.slice(0, sharpsNeeded)

    // Return in chromatic order for consistency
    notes = ALL_NOTE_NAMES.filter(
      n => WHITE_NOTE_NAMES.includes(n) || sharps.includes(n),
    )
  }

  // Filter by noteRange configuration
  return filterNotesByRange(notes, noteRange)
}

/**
 * Create initial Perfect Pitch mode state data.
 * Called by engine.ts createModeState() to initialize mode-specific data.
 */
export function createPerfectPitchState(): PerfectPitchState {
  const allowedNotes = buildAllowedNotes(1)
  const targetNote = allowedNotes[Math.floor(Math.random() * allowedNotes.length)]

  const data: PerfectPitchData = {
    progress: 0,
    targetNote,
    isPlaying: false,
    guessCount: 0,
    streak: 0,
    replaysRemaining: PERFECT_PITCH_REPLAY_LIMIT,
    timeRemaining: PERFECT_PITCH_TIMEOUT,
    challengesCompleted: 0,
    challengesPerWave: 5,
    challengesInWave: 0,
    allowedNotes,
    challengePhase: 'playing',
    feedbackTimer: 0,
    lastAnswerCorrect: false,
    audioTriggered: false,
    bestStreak: 0,
  }

  return data
}

// ─── Challenge management ────────────────────────────────────────────

/**
 * Pick a random target note from the allowed range.
 * Avoids picking the same note twice in a row if possible.
 */
function pickRandomNote(allowedNotes: NoteName[], previousNote: NoteName): NoteName {
  if (allowedNotes.length <= 1) return allowedNotes[0]

  let note: NoteName
  do {
    note = allowedNotes[Math.floor(Math.random() * allowedNotes.length)]
  } while (note === previousNote && allowedNotes.length > 1)

  return note
}

/**
 * Start a new challenge: pick target note, reset timers, trigger audio.
 * timePressure affects the timeout (higher = less time).
 * noteRange filters the available notes.
 */
function startNewChallenge(
  data: PerfectPitchData,
  wave: number,
  timePressure: number = 1.0,
  noteRange?: NoteRangeConfig,
): void {
  const previousNote = data.targetNote
  data.allowedNotes = buildAllowedNotes(wave, noteRange)
  data.targetNote = pickRandomNote(data.allowedNotes, previousNote)
  data.replaysRemaining = PERFECT_PITCH_REPLAY_LIMIT
  data.timeRemaining = PERFECT_PITCH_TIMEOUT / timePressure
  data.guessCount = 0
  data.challengePhase = 'playing'
  data.isPlaying = true
  data.audioTriggered = false
}

/**
 * Advance to the next wave when enough challenges are completed.
 */
function advanceToNextWave(state: GameState, data: PerfectPitchData): void {
  state.wave++
  data.challengesInWave = 0
  data.challengesPerWave = Math.min(5 + state.wave - 1, 10)
  data.allowedNotes = buildAllowedNotes(state.wave, state.noteRange)

  // Update progress
  const maxWaves = 20
  data.progress = Math.min(1.0, (state.wave - 1) / maxWaves)

  setPerfectPitchData(state, data)

  // Enter wave announce phase
  state.phase = 'waveAnnounce'
  state.waveAnnounceTimer = WAVE_ANNOUNCE_DURATION
}

// ─── Main update function ────────────────────────────────────────────

/**
 * Perfect Pitch mode update function.
 *
 * Handles mode-specific logic:
 * - Challenge flow: play reference tone -> wait for input -> validate -> feedback -> next
 * - No enemies or staff notation - purely audio-based ear training
 * - Score for correct identification, HP loss for wrong answer or timeout
 * - Replay button support (tracked via replaysRemaining)
 * - Difficulty scales by expanding note range each wave
 *
 * @returns true if common logic should be skipped
 */
export function updatePerfectPitchMode(
  state: GameState,
  dt: number,
  input: GameInput,
): boolean {
  const data = getPerfectPitchData(state)

  // ── Wave announce phase ──────────────────────────────────────────
  if (state.phase === 'waveAnnounce') {
    state.waveAnnounceTimer -= dt
    if (state.waveAnnounceTimer <= 0) {
      state.phase = 'playing'
      const timePressure = state.difficulty?.timePressure ?? 1.0
      startNewChallenge(data, state.wave, timePressure, state.noteRange)
      setPerfectPitchData(state, data)
    }
    updateParticles(state.particles, dt)
    return true // Skip common logic during announce
  }

  // ── Initial wave transition (wave 0 -> 1) ─────────────────────
  if (state.wave === 0) {
    state.waveTimer -= dt
    if (state.waveTimer <= 0) {
      advanceToNextWave(state, data)
    }
    return true
  }

  // ── Challenge phase: 'playing' (audio playback) ────────────────
  if (data.challengePhase === 'playing') {
    if (!data.audioTriggered) {
      data.audioTriggered = true
      data.isPlaying = true
      setPerfectPitchData(state, data)

      // Fire-and-forget: play the reference note
      playReferenceNote(data.targetNote).then(() => {
        // Audio started playing - the synth handles duration internally
      })
    }

    // Transition to waiting after a short delay for the audio to start
    // The reference note plays for ~1.5s but we let the player guess while it plays
    data.challengePhase = 'waiting'
    data.isPlaying = false
    setPerfectPitchData(state, data)
    return true
  }

  // ── Challenge phase: 'waiting' (waiting for player input) ──────
  if (data.challengePhase === 'waiting') {
    // Count down timeout
    data.timeRemaining -= dt
    setPerfectPitchData(state, data)

    // Check for timeout
    if (data.timeRemaining <= 0) {
      // Timeout = wrong answer
      data.challengePhase = 'feedback'
      data.feedbackTimer = 1.5
      data.lastAnswerCorrect = false
      data.streak = 0

      // Deal damage
      if (state.time >= state.player.invincibleUntil) {
        state.player.hp--
        state.player.invincibleUntil = state.time + 1.5
        state.player.damageFlash = 0.3
      }

      setPerfectPitchData(state, data)

      // Check game over
      if (state.player.hp <= 0) {
        state.phase = 'gameover'
      }
      return true
    }

    // Handle player input
    if (input.activeNote) {
      // Only process if this is a new note press
      if (state.lastNoteAttack !== input.activeNote || state.noteAttackTimer <= 0) {
        data.guessCount++
        state.lastNoteAttack = input.activeNote
        state.noteAttackTimer = 0.5

        if (input.activeNote === data.targetNote) {
          // Correct answer!
          data.challengePhase = 'feedback'
          data.feedbackTimer = 1.0
          data.lastAnswerCorrect = true
          data.streak++
          data.challengesCompleted++
          data.challengesInWave++

          if (data.streak > data.bestStreak) {
            data.bestStreak = data.streak
          }

          // Score: base 200 + streak bonus + time bonus
          const streakBonus = Math.min(data.streak, 10) * 50
          const timeBonus = Math.floor(data.timeRemaining / PERFECT_PITCH_TIMEOUT * 100)
          state.score += 200 + streakBonus + timeBonus

          // Combo system for visual feedback
          state.combo = data.streak

          // Generate success particles at center
          const cx = CANVAS_BASE_WIDTH / 2
          const cy = CANVAS_BASE_HEIGHT / 2
          const noteColor = COLORS.noteColors[data.targetNote] ?? '#ffffff'
          for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12
            const speed = 80 + Math.random() * 60
            state.particles.push({
              pos: { x: cx, y: cy },
              vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
              life: 0.6,
              maxLife: 0.6,
              color: noteColor,
              size: 4 + Math.random() * 4,
            })
          }
        } else {
          // Wrong answer
          data.challengePhase = 'feedback'
          data.feedbackTimer = 1.5
          data.lastAnswerCorrect = false
          data.streak = 0
          state.combo = 0

          // Deal damage
          if (state.time >= state.player.invincibleUntil) {
            state.player.hp--
            state.player.invincibleUntil = state.time + 1.5
            state.player.damageFlash = 0.3
          }

          // Check game over
          if (state.player.hp <= 0) {
            state.phase = 'gameover'
          }
        }

        setPerfectPitchData(state, data)
      }
    } else {
      if (state.noteAttackTimer <= 0) {
        state.lastNoteAttack = null
      }
    }

    if (state.noteAttackTimer > 0) state.noteAttackTimer -= dt

    // Update particles during waiting phase
    updateParticles(state.particles, dt)
    return true
  }

  // ── Challenge phase: 'feedback' (showing result) ───────────────
  if (data.challengePhase === 'feedback') {
    data.feedbackTimer -= dt
    updateParticles(state.particles, dt)

    if (data.feedbackTimer <= 0) {
      // Check if wave is complete
      if (data.challengesInWave >= data.challengesPerWave) {
        advanceToNextWave(state, data)
      } else {
        // Start next challenge
        const timePressure = state.difficulty?.timePressure ?? 1.0
        startNewChallenge(data, state.wave, timePressure, state.noteRange)
        setPerfectPitchData(state, data)
      }
    } else {
      setPerfectPitchData(state, data)
    }

    return true
  }

  // Update particles and beams even when nothing else is happening
  updateParticles(state.particles, dt)
  for (let i = state.beams.length - 1; i >= 0; i--) {
    state.beams[i].life -= dt
    if (state.beams[i].life <= 0) state.beams.splice(i, 1)
  }

  return true // Always skip common logic (no enemies to process)
}

/**
 * Handle replay request from the UI.
 * Decrements replaysRemaining and replays the reference note.
 * Should be called from a UI button handler.
 */
export function requestReplay(state: GameState): void {
  if (!state.modeState) return
  const data = getPerfectPitchData(state)

  if (data.challengePhase !== 'waiting') return
  if (data.replaysRemaining <= 0) return

  data.replaysRemaining--
  setPerfectPitchData(state, data)

  replayReferenceNote()
}

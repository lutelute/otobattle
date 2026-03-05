import { ensureAudioContext } from './audioContext'
import { NOTES } from '../game/notes'
import type { NoteName } from '../game/types'

const DEFAULT_DURATION = 1.5

/** Active reference note state for stop/replay */
let activeOscillators: OscillatorNode[] = []
let activeGains: GainNode[] = []
let lastPlayedNote: NoteName | null = null
let stopTimeout: ReturnType<typeof setTimeout> | null = null

/**
 * Play a clear, sustained reference tone for ear training.
 * Uses sine wave primary + subtle harmonics for warmth,
 * with a gentle ADSR envelope.
 */
export async function playReferenceNote(
  noteName: NoteName,
  duration: number = DEFAULT_DURATION,
): Promise<void> {
  stopReferenceNote()

  const ctx = await ensureAudioContext()
  if (ctx.state !== 'running') return

  const freq = NOTES[noteName].frequency
  lastPlayedNote = noteName

  const now = ctx.currentTime
  const attack = 0.05
  const decay = 0.1
  const sustainLevel = 0.18
  const release = 0.3
  const sustainEnd = now + duration - release

  // Master gain for the combined sound
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, now)
  master.connect(ctx.destination)

  // --- Primary sine oscillator ---
  const oscPrimary = ctx.createOscillator()
  const gainPrimary = ctx.createGain()
  oscPrimary.type = 'sine'
  oscPrimary.frequency.setValueAtTime(freq, now)
  gainPrimary.gain.setValueAtTime(0.8, now)
  oscPrimary.connect(gainPrimary)
  gainPrimary.connect(master)

  // --- 2nd harmonic (subtle warmth) ---
  const oscHarmonic2 = ctx.createOscillator()
  const gainHarmonic2 = ctx.createGain()
  oscHarmonic2.type = 'sine'
  oscHarmonic2.frequency.setValueAtTime(freq * 2, now)
  gainHarmonic2.gain.setValueAtTime(0.12, now)
  oscHarmonic2.connect(gainHarmonic2)
  gainHarmonic2.connect(master)

  // --- 3rd harmonic (very subtle) ---
  const oscHarmonic3 = ctx.createOscillator()
  const gainHarmonic3 = ctx.createGain()
  oscHarmonic3.type = 'sine'
  oscHarmonic3.frequency.setValueAtTime(freq * 3, now)
  gainHarmonic3.gain.setValueAtTime(0.05, now)
  oscHarmonic3.connect(gainHarmonic3)
  gainHarmonic3.connect(master)

  // ADSR envelope on master gain
  // Attack
  master.gain.linearRampToValueAtTime(0.25, now + attack)
  // Decay to sustain level
  master.gain.linearRampToValueAtTime(sustainLevel, now + attack + decay)
  // Sustain (held at sustainLevel)
  master.gain.setValueAtTime(sustainLevel, sustainEnd)
  // Release
  master.gain.linearRampToValueAtTime(0.001, sustainEnd + release)

  const oscs = [oscPrimary, oscHarmonic2, oscHarmonic3]
  const gains = [gainPrimary, gainHarmonic2, gainHarmonic3, master]

  for (const osc of oscs) {
    osc.start(now)
    osc.stop(now + duration + 0.05)
  }

  activeOscillators = oscs
  activeGains = gains

  stopTimeout = setTimeout(() => {
    activeOscillators = []
    activeGains = []
    stopTimeout = null
  }, duration * 1000 + 100)
}

/** Stop the currently playing reference note early with a quick fade-out. */
export function stopReferenceNote(): void {
  if (stopTimeout !== null) {
    clearTimeout(stopTimeout)
    stopTimeout = null
  }

  if (activeGains.length > 0 && activeOscillators.length > 0) {
    try {
      const ctx = activeOscillators[0].context
      const now = ctx.currentTime

      // Quick fade-out on all gain nodes
      for (const gain of activeGains) {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05)
      }

      // Stop oscillators shortly after fade
      for (const osc of activeOscillators) {
        try {
          osc.stop(now + 0.06)
        } catch {
          // Already stopped
        }
      }
    } catch {
      // Context may be closed
    }
  }

  activeOscillators = []
  activeGains = []
}

/** Replay the last played reference note. Does nothing if no note was played yet. */
export async function replayReferenceNote(): Promise<void> {
  if (lastPlayedNote !== null) {
    await playReferenceNote(lastPlayedNote)
  }
}

import { getAudioContext } from './audioContext'
import { NOTES } from '../game/notes'
import type { NoteName } from '../game/types'

export function playAttackSound(note: NoteName): void {
  const ctx = getAudioContext()
  if (ctx.state !== 'running') return

  const freq = NOTES[note].frequency

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(freq, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(freq * 2, ctx.currentTime + 0.1)

  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.2)
}

export function playDamageSound(): void {
  const ctx = getAudioContext()
  if (ctx.state !== 'running') return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)

  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}

export function playGameOverSound(): void {
  const ctx = getAudioContext()
  if (ctx.state !== 'running') return

  const notes = [392, 349, 330, 262] // G F E C descending

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2)

    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.2)
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.2 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime + i * 0.2)
    osc.stop(ctx.currentTime + i * 0.2 + 0.4)
  })
}

export function playWaveStartSound(): void {
  const ctx = getAudioContext()
  if (ctx.state !== 'running') return

  const notes = [262, 330, 392] // C E G ascending

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)

    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1)
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.1 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(ctx.currentTime + i * 0.1)
    osc.stop(ctx.currentTime + i * 0.1 + 0.2)
  })
}

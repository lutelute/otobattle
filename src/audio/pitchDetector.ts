import { ensureAudioContext } from './audioContext'
import type { NoteName, InstrumentType } from '../game/types'
import { frequencyToNote } from '../game/notes'

/**
 * 高精度・低遅延ピッチ検出（楽器別プロファイル対応）
 *
 * 戦略:
 * - 2つのバッファサイズを並用（高速検出用 + 高精度用）
 * - 楽器ごとにフィルター、閾値、周波数範囲を最適化
 * - 弦楽器: ビブラート対応でYIN閾値を緩め、LPF高め
 * - ピアノ: アタック明確でLPF狭め、高速検出重視
 * - 管楽器: クリーンな信号、標準設定
 */

const POLL_INTERVAL = 6      // ~166Hz ポーリング

/** 楽器別ピッチ検出プロファイル */
interface InstrumentProfile {
  label: string
  fastBuffer: number
  preciseBuffer: number
  yinThreshold: number
  yinFallbackMax: number    // fallback時の最大許容CMNDF値
  rmsThreshold: number
  silenceRms: number
  lpfFrequency: number      // ローパスフィルター周波数
  lpfQ: number
  freqMin: number           // 検出周波数下限
  freqMax: number           // 検出周波数上限
  silenceFrames: number     // 無音判定に必要な連続フレーム数
}

const INSTRUMENT_PROFILES: Record<InstrumentType, InstrumentProfile> = {
  piano: {
    label: 'ピアノ',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.25,
    yinFallbackMax: 0.50,
    rmsThreshold: 0.008,
    silenceRms: 0.003,
    lpfFrequency: 800,
    lpfQ: 0.7,
    freqMin: 200,
    freqMax: 700,
    silenceFrames: 3,
  },
  violin: {
    label: 'バイオリン',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.35,
    yinFallbackMax: 0.60,
    rmsThreshold: 0.006,
    silenceRms: 0.002,
    lpfFrequency: 1200,       // 倍音を残す
    lpfQ: 0.5,
    freqMin: 190,
    freqMax: 900,
    silenceFrames: 4,         // ビブラートの谷間で切れないよう長め
  },
  viola: {
    label: 'ビオラ',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.35,
    yinFallbackMax: 0.60,
    rmsThreshold: 0.006,
    silenceRms: 0.002,
    lpfFrequency: 1000,
    lpfQ: 0.5,
    freqMin: 120,
    freqMax: 800,
    silenceFrames: 4,
  },
  cello: {
    label: 'チェロ',
    fastBuffer: 2048,
    preciseBuffer: 4096,
    yinThreshold: 0.35,
    yinFallbackMax: 0.60,
    rmsThreshold: 0.006,
    silenceRms: 0.002,
    lpfFrequency: 800,
    lpfQ: 0.5,
    freqMin: 60,
    freqMax: 700,
    silenceFrames: 4,
  },
  guitar: {
    label: 'ギター',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.30,
    yinFallbackMax: 0.55,
    rmsThreshold: 0.008,
    silenceRms: 0.003,
    lpfFrequency: 900,
    lpfQ: 0.6,
    freqMin: 80,
    freqMax: 700,
    silenceFrames: 3,
  },
  flute: {
    label: 'フルート',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.20,
    yinFallbackMax: 0.45,
    rmsThreshold: 0.006,
    silenceRms: 0.002,
    lpfFrequency: 1500,       // 高域の倍音を残す
    lpfQ: 0.5,
    freqMin: 240,
    freqMax: 1200,
    silenceFrames: 3,
  },
  voice: {
    label: '声',
    fastBuffer: 1024,
    preciseBuffer: 2048,
    yinThreshold: 0.30,
    yinFallbackMax: 0.55,
    rmsThreshold: 0.010,
    silenceRms: 0.004,
    lpfFrequency: 900,
    lpfQ: 0.6,
    freqMin: 80,
    freqMax: 800,
    silenceFrames: 5,         // 発音のブレで切れないよう
  },
}

export { INSTRUMENT_PROFILES }
export type { InstrumentProfile }

export interface PitchDetectorState {
  fastAnalyser: AnalyserNode
  preciseAnalyser: AnalyserNode
  fastBuffer: Float32Array<ArrayBuffer>
  preciseBuffer: Float32Array<ArrayBuffer>
  stream: MediaStream
  confirmedNote: NoteName | null
  silenceCount: number
  intervalId: number
  onNote: (note: NoteName | null) => void
  profile: InstrumentProfile
  // 余韻対策
  peakRms: number           // アタック時のピークRMS
  cooldownUntil: number     // 同じ音の再トリガー防止タイムスタンプ
  lastNoteTime: number      // 最後に音を検出した時刻
  decayCount: number        // ピークから減衰し続けているフレーム数
  // マイク感度 (0.1〜3.0, デフォルト1.0) — 高いほど小さい音を拾う
  sensitivity: number
}

export function setSensitivity(state: PitchDetectorState, value: number): void {
  state.sensitivity = Math.max(0.1, Math.min(3.0, value))
}

export async function createPitchDetector(
  onNote: (note: NoteName | null) => void,
  instrument: InstrumentType = 'piano',
  sensitivity: number = 1.0,
): Promise<PitchDetectorState> {
  const profile = INSTRUMENT_PROFILES[instrument]
  const ctx = await ensureAudioContext()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      sampleRate: { ideal: 44100 },
      channelCount: { ideal: 1 },
    },
  })
  const source = ctx.createMediaStreamSource(stream)

  // 楽器別ローパスフィルター
  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = profile.lpfFrequency
  lpf.Q.value = profile.lpfQ
  source.connect(lpf)

  // 2つのAnalyser（異なるFFTサイズ）
  const fastAnalyser = ctx.createAnalyser()
  fastAnalyser.fftSize = profile.fastBuffer * 2
  fastAnalyser.smoothingTimeConstant = 0
  lpf.connect(fastAnalyser)

  const preciseAnalyser = ctx.createAnalyser()
  preciseAnalyser.fftSize = profile.preciseBuffer * 2
  preciseAnalyser.smoothingTimeConstant = 0
  lpf.connect(preciseAnalyser)

  const state: PitchDetectorState = {
    fastAnalyser,
    preciseAnalyser,
    fastBuffer: new Float32Array(profile.fastBuffer),
    preciseBuffer: new Float32Array(profile.preciseBuffer),
    stream,
    confirmedNote: null,
    silenceCount: 0,
    intervalId: 0,
    onNote,
    profile,
    peakRms: 0,
    cooldownUntil: 0,
    lastNoteTime: 0,
    decayCount: 0,
    sensitivity: Math.max(0.1, Math.min(3.0, sensitivity)),
  }

  state.intervalId = window.setInterval(() => pollPitch(state), POLL_INTERVAL)
  return state
}

/** 余韻クールダウン時間(ms) — 同じ音が再トリガーされるのを防ぐ */
const NOTE_COOLDOWN_MS = 300
/** ピークRMSに対してこの割合以下に減衰したら余韻とみなす */
const DECAY_RATIO = 0.35
/** 減衰検出に必要な連続フレーム数 */
const DECAY_FRAMES = 8

function pollPitch(state: PitchDetectorState): void {
  const { profile, sensitivity } = state
  const now = performance.now()
  // 感度でRMS閾値をスケール（感度が高い→閾値が低い→小さい音も拾う）
  const sensScale = 1 / sensitivity
  const effectiveSilenceRms = profile.silenceRms * sensScale
  const effectiveRmsThreshold = profile.rmsThreshold * sensScale

  // --- 高速バッファでRMSチェック ---
  state.fastAnalyser.getFloatTimeDomainData(state.fastBuffer)
  const rms = computeRMS(state.fastBuffer)

  // ── 無音判定 ──
  if (rms < effectiveSilenceRms) {
    state.silenceCount++
    if (state.silenceCount >= profile.silenceFrames && state.confirmedNote !== null) {
      state.confirmedNote = null
      state.peakRms = 0
      state.decayCount = 0
      state.onNote(null)
    }
    return
  }
  state.silenceCount = 0

  // ── 余韻（減衰）検出 ──
  // ピークRMSから大きく減衰していたら、余韻として無視
  if (state.peakRms > 0 && rms < state.peakRms * DECAY_RATIO) {
    state.decayCount++
    if (state.decayCount >= DECAY_FRAMES && state.confirmedNote !== null) {
      state.confirmedNote = null
      state.peakRms = 0
      state.decayCount = 0
      state.onNote(null)
    }
    return
  }
  state.decayCount = 0

  // ── RMS閾値チェック ──
  if (rms < effectiveRmsThreshold) return

  // ピークRMS更新（新しいアタックを検出）
  if (rms > state.peakRms) {
    state.peakRms = rms
  }

  // ── ピッチ検出 ──
  const sampleRate = state.fastAnalyser.context.sampleRate
  let freq = yinDetect(state.fastBuffer, sampleRate, profile)

  // 高速で検出できなかった or 低い音 → 高精度バッファで再試行
  if (freq === null || freq < 300) {
    state.preciseAnalyser.getFloatTimeDomainData(state.preciseBuffer)
    const preciseFreq = yinDetect(state.preciseBuffer, sampleRate, profile)
    if (preciseFreq !== null) {
      freq = preciseFreq
    }
  }

  if (freq === null) return

  const note = frequencyToNote(freq)
  if (note === null) return

  // ── 同じ音の再トリガー防止 ──
  if (note === state.confirmedNote) {
    // 既に同じ音が鳴っている → 何もしない（余韻で再トリガーしない）
    return
  }

  // クールダウン中なら無視
  if (now < state.cooldownUntil) return

  // 新しい音として反映
  state.confirmedNote = note
  state.lastNoteTime = now
  state.cooldownUntil = now + NOTE_COOLDOWN_MS
  state.peakRms = rms  // 新しい音のピークとしてリセット
  state.decayCount = 0
  state.onNote(note)
}

function computeRMS(buffer: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i]
  }
  return Math.sqrt(sum / buffer.length)
}

export function stopPitchDetector(state: PitchDetectorState): void {
  if (state.intervalId) window.clearInterval(state.intervalId)
  state.stream.getTracks().forEach(t => t.stop())
}

// ─── YIN pitch detection algorithm ───

function yinDetect(buffer: Float32Array, sampleRate: number, profile: InstrumentProfile): number | null {
  const halfLen = Math.floor(buffer.length / 2)
  const minTau = Math.max(2, Math.floor(sampleRate / profile.freqMax))
  const maxTau = Math.min(halfLen - 1, Math.ceil(sampleRate / profile.freqMin))

  if (maxTau <= minTau) return null

  // Step 1+2: Difference function + CMNDF (combined for efficiency)
  const cmndf = new Float32Array(maxTau + 1)
  cmndf[0] = 1
  let runningSum = 0

  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0
    for (let i = 0; i < halfLen; i++) {
      const d = buffer[i] - buffer[i + tau]
      sum += d * d
    }
    runningSum += sum
    cmndf[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1
  }

  // Step 3: Find first dip below threshold
  let bestTau = -1

  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmndf[tau] < profile.yinThreshold) {
      // Walk to valley minimum
      while (tau + 1 <= maxTau && cmndf[tau + 1] < cmndf[tau]) {
        tau++
      }
      bestTau = tau
      break
    }
  }

  // Fallback: global minimum with relaxed threshold
  if (bestTau === -1) {
    let minVal = 1
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau]
        bestTau = tau
      }
    }
    if (minVal > profile.yinFallbackMax) return null
  }

  if (bestTau <= 0) return null

  // Step 4: Parabolic interpolation
  const s0 = bestTau > 0 ? cmndf[bestTau - 1] : cmndf[bestTau]
  const s1 = cmndf[bestTau]
  const s2 = bestTau + 1 <= maxTau ? cmndf[bestTau + 1] : cmndf[bestTau]
  const denom = 2 * (s0 - 2 * s1 + s2)
  const betterTau = denom !== 0 ? bestTau + (s0 - s2) / denom : bestTau

  if (betterTau <= 0) return null
  const frequency = sampleRate / betterTau

  if (frequency < profile.freqMin || frequency > profile.freqMax) return null
  return frequency
}

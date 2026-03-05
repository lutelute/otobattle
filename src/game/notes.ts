import type { NoteName, NoteInfo, ClefType } from './types'

/**
 * 五線譜上の音符配置データベース
 *
 * steps: 第1線(底線)を基準(0)としたステップ数（上が正）
 *   各ステップ = 線→間 or 間→線 = lineGap/2
 *
 * ── ト音記号 ──
 *   第1線 = E4,  第2線 = G4,  第3線 = B4,  第4線 = D5,  第5線 = F5
 *   C4 = step -2 (加線), D4 = step -1, E4 = step 0, ... B4 = step 4
 *
 * ── ヘ音記号 ──
 *   第1線 = G2,  第2線 = B2,  第3線 = D3,  第4線 = F3,  第5線 = A3
 *   同じ音名をオクターブ3(C3-B3)として表示:
 *   C3 = step 3, D3 = step 4, E3 = step 5, F3 = step 6,
 *   G3 = step 7, A3 = step 8(top line), B3 = step 9(加線上)
 */

export interface StaffPlacement {
  steps: number        // 第1線基準のステップ数（上が正）
  onLine: boolean      // 線上の音か
  needsLedger: boolean // 加線が必要か
}

/** ト音記号: C4-B4 */
export const TREBLE_STAFF_PLACEMENT: Record<NoteName, StaffPlacement> = {
  'C':  { steps: -2, onLine: true,  needsLedger: true },   // 加線上（第1線の下）
  'C#': { steps: -2, onLine: true,  needsLedger: true },
  'D':  { steps: -1, onLine: false, needsLedger: false },  // 第1線の下の間
  'D#': { steps: -1, onLine: false, needsLedger: false },
  'E':  { steps:  0, onLine: true,  needsLedger: false },  // 第1線
  'F':  { steps:  1, onLine: false, needsLedger: false },  // 第1間
  'F#': { steps:  1, onLine: false, needsLedger: false },
  'G':  { steps:  2, onLine: true,  needsLedger: false },  // 第2線
  'G#': { steps:  2, onLine: true,  needsLedger: false },
  'A':  { steps:  3, onLine: false, needsLedger: false },  // 第2間
  'A#': { steps:  3, onLine: false, needsLedger: false },
  'B':  { steps:  4, onLine: true,  needsLedger: false },  // 第3線
}

/** ヘ音記号: C3-B3 として表示（音名は同じ） */
export const BASS_STAFF_PLACEMENT: Record<NoteName, StaffPlacement> = {
  'C':  { steps:  3, onLine: false, needsLedger: false },  // 第2間（B2線とD3線の間）
  'C#': { steps:  3, onLine: false, needsLedger: false },
  'D':  { steps:  4, onLine: true,  needsLedger: false },  // 第3線（中央線）
  'D#': { steps:  4, onLine: true,  needsLedger: false },
  'E':  { steps:  5, onLine: false, needsLedger: false },  // 第3間
  'F':  { steps:  6, onLine: true,  needsLedger: false },  // 第4線
  'F#': { steps:  6, onLine: true,  needsLedger: false },
  'G':  { steps:  7, onLine: false, needsLedger: false },  // 第4間
  'G#': { steps:  7, onLine: false, needsLedger: false },
  'A':  { steps:  8, onLine: true,  needsLedger: false },  // 第5線（最上線）
  'A#': { steps:  8, onLine: true,  needsLedger: false },
  'B':  { steps:  9, onLine: false, needsLedger: true  },  // 加線上（第5線の上）
}

/** 記号に応じた配置を返す */
export function getStaffPlacement(note: NoteName, clef: ClefType): StaffPlacement {
  return clef === 'bass' ? BASS_STAFF_PLACEMENT[note] : TREBLE_STAFF_PLACEMENT[note]
}

// 後方互換（既存コードがSTAFF_PLACEMENTを参照している場合）
export const STAFF_PLACEMENT = TREBLE_STAFF_PLACEMENT

export const NOTES: Record<NoteName, NoteInfo> = {
  'C':  { name: 'C',  frequency: 261.63, solfege: 'ド',    staffPosition: 0,  isSharp: false, color: '#ef4444' },
  'C#': { name: 'C#', frequency: 277.18, solfege: 'ド♯',   staffPosition: 1,  isSharp: true,  color: '#dc2626' },
  'D':  { name: 'D',  frequency: 293.66, solfege: 'レ',    staffPosition: 2,  isSharp: false, color: '#f97316' },
  'D#': { name: 'D#', frequency: 311.13, solfege: 'レ♯',   staffPosition: 3,  isSharp: true,  color: '#ea580c' },
  'E':  { name: 'E',  frequency: 329.63, solfege: 'ミ',    staffPosition: 4,  isSharp: false, color: '#eab308' },
  'F':  { name: 'F',  frequency: 349.23, solfege: 'ファ',  staffPosition: 5,  isSharp: false, color: '#22c55e' },
  'F#': { name: 'F#', frequency: 369.99, solfege: 'ファ♯', staffPosition: 6,  isSharp: true,  color: '#16a34a' },
  'G':  { name: 'G',  frequency: 392.00, solfege: 'ソ',    staffPosition: 7,  isSharp: false, color: '#3b82f6' },
  'G#': { name: 'G#', frequency: 415.30, solfege: 'ソ♯',   staffPosition: 8,  isSharp: true,  color: '#2563eb' },
  'A':  { name: 'A',  frequency: 440.00, solfege: 'ラ',    staffPosition: 9,  isSharp: false, color: '#6366f1' },
  'A#': { name: 'A#', frequency: 466.16, solfege: 'ラ♯',   staffPosition: 10, isSharp: true,  color: '#4f46e5' },
  'B':  { name: 'B',  frequency: 493.88, solfege: 'シ',    staffPosition: 11, isSharp: false, color: '#a855f7' },
}

/** All 12 notes in chromatic order */
export const ALL_NOTE_NAMES: NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

/** White keys only */
export const WHITE_NOTE_NAMES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Black keys only */
export const BLACK_NOTE_NAMES: NoteName[] = ['C#', 'D#', 'F#', 'G#', 'A#']

/**
 * Convert frequency to nearest note name.
 * オクターブを無視して最も近い音名を返す（C4-B4にマッピング）
 * Returns null if too far (>50 cents)
 */
export function frequencyToNote(freq: number): NoteName | null {
  if (freq < 50 || freq > 2000) return null

  // まず基準オクターブ(C4=261.63)に正規化
  let normalized = freq
  while (normalized < 261.63 / 1.06) normalized *= 2  // C4の半音下まで引き上げ
  while (normalized > 523.25 * 1.06) normalized /= 2  // B4の半音上まで引き下げ

  let closest: NoteName | null = null
  let minCents = Infinity

  for (const note of ALL_NOTE_NAMES) {
    const cents = Math.abs(1200 * Math.log2(normalized / NOTES[note].frequency))
    if (cents < minCents) {
      minCents = cents
      closest = note
    }
  }

  return minCents <= 50 ? closest : null
}

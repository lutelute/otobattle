import { Scale, Chord, ScaleType, ChordType, Note } from 'tonal'
import type { NoteName } from './types'
import { ALL_NOTE_NAMES } from './notes'

/**
 * 音楽理論ユーティリティ — tonal ライブラリのラッパー
 *
 * OtoBattle では音名をシャープ表記（C, C#, D, D#, ...）で統一しているため、
 * tonal が返すフラット表記（Eb, Bb, Ab, ...）をシャープ表記に変換する必要がある。
 * このモジュールは tonal の出力を OtoBattle の NoteName 型に正規化して返す。
 */

/** フラット→シャープ変換マップ（一般的なフラット表記のみ） */
const FLAT_TO_SHARP: Record<string, NoteName> = {
  'Eb': 'D#',
  'Ab': 'G#',
  'Db': 'C#',
  'Gb': 'F#',
  'Bb': 'A#',
  // エンハーモニック: Cb=B, Fb=E
  'Cb': 'B',
  'Fb': 'E',
}

/** 自然音名（フラットもシャープもつかない）の直接マップ */
const NATURAL_TO_NOTE: Record<string, NoteName> = {
  'C': 'C',
  'D': 'D',
  'E': 'E',
  'F': 'F',
  'G': 'G',
  'A': 'A',
  'B': 'B',
}

/** シャープ表記の直接マップ */
const SHARP_TO_NOTE: Record<string, NoteName> = {
  'C#': 'C#',
  'D#': 'D#',
  'F#': 'F#',
  'G#': 'G#',
  'A#': 'A#',
  // ダブルシャープ等は Note.enharmonic で処理
}

/**
 * tonal の出力する音名を OtoBattle の NoteName 型に正規化する。
 * オクターブ番号は除去し、フラット表記はシャープ表記に変換する。
 *
 * 例: "Eb4" → "D#", "Bb" → "A#", "C" → "C", "F#5" → "F#"
 *
 * @returns 正規化された NoteName。変換できない場合は null。
 */
export function normalizeNoteName(tonalNote: string): NoteName | null {
  // オクターブ番号を除去してピッチクラスを取得
  const pitchClass = Note.pitchClass(tonalNote)
  if (!pitchClass) return null

  // 直接マッピングを試みる（自然音・シャープ音）
  if (pitchClass in NATURAL_TO_NOTE) return NATURAL_TO_NOTE[pitchClass]
  if (pitchClass in SHARP_TO_NOTE) return SHARP_TO_NOTE[pitchClass]
  if (pitchClass in FLAT_TO_SHARP) return FLAT_TO_SHARP[pitchClass]

  // ダブルシャープ・ダブルフラット等は tonal のエンハーモニック変換に委譲
  const enharmonic = Note.enharmonic(pitchClass)
  if (enharmonic && enharmonic in NATURAL_TO_NOTE) return NATURAL_TO_NOTE[enharmonic]
  if (enharmonic && enharmonic in SHARP_TO_NOTE) return SHARP_TO_NOTE[enharmonic]

  return null
}

/**
 * スケール（音階）の構成音を NoteName[] で返す。
 *
 * @param key - 調（キー）。例: "C", "F#", "Bb"
 * @param scaleType - スケールの種類。例: "major", "minor", "dorian"
 * @returns スケールの構成音。無効なスケールの場合は空配列。
 *
 * @example
 * getScaleNotes('C', 'major')  // → ['C', 'D', 'E', 'F', 'G', 'A', 'B']
 * getScaleNotes('F', 'major')  // → ['F', 'G', 'A', 'A#', 'C', 'D', 'E']
 * getScaleNotes('A', 'minor')  // → ['A', 'B', 'C', 'D', 'E', 'F', 'G']
 */
export function getScaleNotes(key: string, scaleType: string): NoteName[] {
  const scale = Scale.get(`${key} ${scaleType}`)
  if (scale.empty) return []

  const notes: NoteName[] = []
  for (const n of scale.notes) {
    const normalized = normalizeNoteName(n)
    if (normalized) notes.push(normalized)
  }
  return notes
}

/**
 * コード（和音）の構成音を NoteName[] で返す。
 *
 * @param chordName - コード名。例: "Cmaj7", "Fm7", "Bbm", "G7"
 * @returns コードの構成音。無効なコードの場合は空配列。
 *
 * @example
 * getChordNotes('Cmaj7')  // → ['C', 'E', 'G', 'B']
 * getChordNotes('Fm7')    // → ['F', 'G#', 'C', 'D#']
 * getChordNotes('Bbm')    // → ['A#', 'C#', 'F']
 */
export function getChordNotes(chordName: string): NoteName[] {
  const chord = Chord.get(chordName)
  if (chord.empty) return []

  const notes: NoteName[] = []
  for (const n of chord.notes) {
    const normalized = normalizeNoteName(n)
    if (normalized) notes.push(normalized)
  }
  return notes
}

/**
 * 利用可能なスケールタイプ名のリストを返す。
 * 難易度に応じた段階的アンロックに使用できる。
 *
 * リストは一般的なスケールから順に、よく使うものが先に来る。
 * tonal の ScaleType.names() の順序がおおよそ一般的→特殊の順。
 */
export function getScaleTypes(): string[] {
  return ScaleType.names()
}

/**
 * 利用可能なコードタイプ名のリストを返す。
 * 難易度に応じた段階的アンロックに使用できる。
 *
 * リストは基本的なコードから順に並ぶ。
 * tonal の ChordType.names() の順序がおおよそシンプル→複雑の順。
 */
export function getChordTypes(): string[] {
  return ChordType.names()
}

/**
 * 指定されたスケールに含まれる音かどうかを判定する。
 *
 * @param note - 判定する音名
 * @param key - 調（キー）
 * @param scaleType - スケールの種類
 */
export function isNoteInScale(note: NoteName, key: string, scaleType: string): boolean {
  const scaleNotes = getScaleNotes(key, scaleType)
  return scaleNotes.includes(note)
}

/**
 * 指定されたコードに含まれる音かどうかを判定する。
 *
 * @param note - 判定する音名
 * @param chordName - コード名
 */
export function isNoteInChord(note: NoteName, chordName: string): boolean {
  const chordNotes = getChordNotes(chordName)
  return chordNotes.includes(note)
}

/**
 * 全12音のうち、指定キー・スケールに含まれる音だけをフィルタして返す。
 * 敵スポーン時の出題対象ノートを絞り込むのに使用。
 */
export function filterNotesByScale(key: string, scaleType: string): NoteName[] {
  const scaleNotes = getScaleNotes(key, scaleType)
  return ALL_NOTE_NAMES.filter(n => scaleNotes.includes(n))
}

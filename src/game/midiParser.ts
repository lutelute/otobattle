import { Midi } from '@tonejs/midi'
import type { NoteName } from './types'
import { normalizeNoteName } from './musicTheory'

/**
 * MIDIファイルパーサーユーティリティ — @tonejs/midi のラッパー
 *
 * Full Song モードで使用。ユーザーがアップロードした .mid ファイルを解析し、
 * 敵スポーンタイムラインに変換するための関数群を提供する。
 *
 * 注意:
 * - `new Midi(arrayBuffer)` を使用（`Midi.fromUrl()` は使わない）
 * - 音名はオクターブを除去し、OtoBattle の NoteName 型に正規化する
 * - フラット表記は musicTheory.normalizeNoteName() でシャープ表記に変換する
 * - パフォーマンス対策として最大ノート数を制限する
 */

/** MIDIファイルから抽出した1ノートのタイムライン情報 */
export interface MidiNoteEvent {
  /** ノートの開始時間（秒） */
  time: number
  /** 正規化された音名（オクターブなし、シャープ表記） */
  note: NoteName
  /** ノートの長さ（秒） */
  duration: number
}

/** トラック情報（トラック選択UIで使用） */
export interface MidiTrackInfo {
  /** トラック名（MIDIメタデータから） */
  name: string
  /** トラック内のノート数 */
  noteCount: number
}

/** パース済みMIDIデータ（Midiインスタンスのラッパー型） */
export type ParsedMidiData = Midi

/** パフォーマンス対策: 1曲あたりの最大ノート数 */
const MAX_SONG_NOTES = 2000

/**
 * ArrayBuffer から MIDI ファイルを解析する。
 *
 * FileReader.readAsArrayBuffer() で取得した ArrayBuffer を受け取り、
 * @tonejs/midi でパースした結果を返す。
 *
 * @param arrayBuffer - MIDIファイルの生バイナリデータ
 * @returns パース済みMIDIデータ
 * @throws MIDIファイルの形式が不正な場合
 *
 * @example
 * const buffer = await file.arrayBuffer()
 * const midiData = parseMidiFile(buffer)
 */
export function parseMidiFile(arrayBuffer: ArrayBuffer): ParsedMidiData {
  return new Midi(arrayBuffer)
}

/**
 * MIDIデータの全トラック情報を取得する。
 * トラック選択UIで、どのトラックにどれだけノートがあるかを表示するために使用。
 *
 * @param midiData - parseMidiFile() で取得したパース済みMIDIデータ
 * @returns トラック情報の配列（名前とノート数）
 *
 * @example
 * const tracks = getTrackInfo(midiData)
 * // → [{ name: 'Piano', noteCount: 245 }, { name: 'Bass', noteCount: 120 }]
 */
export function getTrackInfo(midiData: ParsedMidiData): MidiTrackInfo[] {
  return midiData.tracks.map(track => ({
    name: track.name || 'Untitled',
    noteCount: track.notes.length,
  }))
}

/**
 * 指定トラックからノートタイムラインを抽出する。
 *
 * MIDIノートの音名をオクターブ除去・フラット→シャープ変換して
 * OtoBattle の NoteName 型に正規化する。変換できないノートはスキップ。
 * パフォーマンス対策として MAX_SONG_NOTES でノート数を制限する。
 *
 * @param midiData - parseMidiFile() で取得したパース済みMIDIデータ
 * @param trackIndex - 抽出するトラックのインデックス（0始まり）
 * @returns 時間順にソートされたノートイベントの配列
 *
 * @example
 * const timeline = extractNoteTimeline(midiData, 0)
 * // → [{ time: 0.0, note: 'C', duration: 0.5 }, { time: 0.5, note: 'E', duration: 0.25 }, ...]
 */
export function extractNoteTimeline(
  midiData: ParsedMidiData,
  trackIndex: number,
): MidiNoteEvent[] {
  if (trackIndex < 0 || trackIndex >= midiData.tracks.length) {
    return []
  }

  const track = midiData.tracks[trackIndex]
  const timeline: MidiNoteEvent[] = []

  for (const midiNote of track.notes) {
    // note.pitch はピッチクラス（例: "C", "Eb"）を返す
    // フォールバック: note.name（例: "C4"）からオクターブを除去
    const rawPitch = midiNote.pitch || midiNote.name.replace(/\d+$/, '')
    const noteName = normalizeNoteName(rawPitch)

    if (noteName === null) continue

    timeline.push({
      time: midiNote.time,
      note: noteName,
      duration: midiNote.duration,
    })
  }

  // 時間順にソート（同時刻のノートは元の順序を維持）
  timeline.sort((a, b) => a.time - b.time)

  // 最大ノート数で切り詰め
  if (timeline.length > MAX_SONG_NOTES) {
    return timeline.slice(0, MAX_SONG_NOTES)
  }

  return timeline
}

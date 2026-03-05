import type { NoteName, ClefType } from '../types'

// ─── Note Frenzy Mode ────────────────────────────────────────────────

/** Note Frenzy モードの状態（既存ゲームプレイを抽出） */
export interface NoteFrenzyState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
}

// ─── Scales Mode ─────────────────────────────────────────────────────

/** スケール種別 */
export type ScaleType = 'major' | 'natural minor' | 'harmonic minor' | 'melodic minor'

/** スケール方向（上行/下行） */
export type ScaleDirection = 'ascending' | 'descending'

/** Scales モードの状態 */
export interface ScalesState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
  /** 現在のスケール種別 */
  currentScale: ScaleType
  /** スケールのキー（例: 'C', 'G', 'D'） */
  scaleKey: NoteName
  /** 現在のスケール度数（0=ルート, 1=2nd, ... 6=7th） */
  currentDegree: number
  /** スケールの方向 */
  direction: ScaleDirection
  /** スケール内のノート一覧 */
  scaleNotes: NoteName[]
  /** 使用する記号 */
  clef: ClefType
}

// ─── Chords Mode ─────────────────────────────────────────────────────

/** コードグループの状態 */
export interface ChordGroup {
  /** コードグループの一意ID */
  groupId: number
  /** コード名（例: 'Cmaj7', 'Dm', 'G7'） */
  chordName: string
  /** コードを構成するノート */
  notes: NoteName[]
}

/** Chords モードの状態 */
export interface ChordsState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
  /** 現在のコード名（例: 'Cmaj7'） */
  currentChord: string
  /** 現在のコードグループID */
  chordGroupId: number
  /** コードを構成する全ノート */
  activeChordNotes: NoteName[]
  /** プレイヤーが正しく入力済みのノート */
  matchedNotes: NoteName[]
  /** コード入力の開始時刻（タイミングウィンドウ用） */
  chordInputStartTime: number
  /** 次のコードグループID採番用 */
  nextGroupId: number
}

// ─── Perfect Pitch Mode ──────────────────────────────────────────────

/** Perfect Pitch モードの状態 */
export interface PerfectPitchState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
  /** 正解の音 */
  targetNote: NoteName
  /** リファレンス音が再生中かどうか */
  isPlaying: boolean
  /** 現在のチャレンジでの推測回数 */
  guessCount: number
  /** 連続正解数 */
  streak: number
  /** リプレイ残り回数 */
  replaysRemaining: number
  /** チャレンジの残り時間（秒） */
  timeRemaining: number
}

// ─── Full Song Mode ──────────────────────────────────────────────────

/** MIDIタイムラインの1ノートイベント */
export interface MidiNoteEvent {
  /** ノートの発音時刻（秒） */
  time: number
  /** ノート名 */
  note: NoteName
  /** ノートの長さ（秒） */
  duration: number
}

/** MIDIトラック情報 */
export interface MidiTrackInfo {
  /** トラック名 */
  name: string
  /** トラック内のノート数 */
  noteCount: number
}

/** Full Song モードの状態 */
export interface FullSongState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
  /** MIDIノートのタイムライン */
  midiTimeline: MidiNoteEvent[]
  /** 次にスポーンするノートのインデックス */
  currentNoteIndex: number
  /** 曲の再生進捗（秒） */
  songProgress: number
  /** 選択中のトラックインデックス */
  selectedTrack: number
  /** 曲の総時間（秒） */
  songDuration: number
  /** 曲名（ファイル名から） */
  songName: string
  /** 利用可能なトラック一覧 */
  availableTracks: MidiTrackInfo[]
}

// ─── Mode State Union ────────────────────────────────────────────────

/** 各モードの状態を識別するための判別共用体 */
export type ModeModeState =
  | { mode: 'noteFrenzy'; state: NoteFrenzyState }
  | { mode: 'scales'; state: ScalesState }
  | { mode: 'chords'; state: ChordsState }
  | { mode: 'perfectPitch'; state: PerfectPitchState }
  | { mode: 'fullSong'; state: FullSongState }

// ─── Shared Mode Utility Types ───────────────────────────────────────

/** モード更新関数のシグネチャ */
export type ModeUpdateFn = (
  state: import('../types').GameState,
  dt: number,
  input: import('../types').GameInput,
) => void

/** モード初期化関数のシグネチャ */
export type ModeInitFn = () => ModeStateMap[keyof ModeStateMap]

/** GameMode から対応するモード状態への型マッピング */
export interface ModeStateMap {
  noteFrenzy: NoteFrenzyState
  scales: ScalesState
  chords: ChordsState
  perfectPitch: PerfectPitchState
  fullSong: FullSongState
}

/** 全モード共通の進捗フィールド */
export interface ModeProgressBase {
  progress: number
}

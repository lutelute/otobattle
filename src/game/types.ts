export interface Vec2 { x: number; y: number }

export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E'
  | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

export interface NoteInfo {
  name: NoteName
  frequency: number
  solfege: string
  staffPosition: number // semitone-based: 0=C, 1=C#, 2=D, ... 11=B
  isSharp: boolean
  color: string
}

/** 記号タイプ */
export type ClefType = 'treble' | 'bass' | 'alto'

/** 敵タイプ */
export type EnemyType = 'normal' | 'invader'

/** インベーダー型敵の状態 */
export interface InvaderState {
  rowIndex: number      // 隊列内のインデックス
  direction: 1 | -1    // 横移動方向（1=右, -1=左）
  dropTarget: number    // 降下目標Y座標
}

export interface Enemy {
  id: number
  pos: Vec2
  vel: Vec2
  note: NoteName
  clef: ClefType      // ト音記号 or ヘ音記号
  radius: number
  alive: boolean
  spawnTime: number
  hitFlash: number
  shape: EnemyShape   // 個体を区別するための形状
  enemyType: EnemyType
  invaderState?: InvaderState
}

/** 敵の形状バリエーション（同じ音でも形で区別可能） */
export type EnemyShape = 'square' | 'diamond' | 'circle' | 'triangle' | 'hexagon' | 'cross'

export interface Particle {
  pos: Vec2
  vel: Vec2
  life: number
  maxLife: number
  color: string
  size: number
}

/** ビームスタイル */
export type BeamStyle = 'straight' | 'zigzag' | 'lightning'

export interface Beam {
  from: Vec2
  to: Vec2
  color: string
  life: number
  maxLife: number
  style?: BeamStyle
}

export interface Player {
  pos: Vec2
  hp: number
  maxHp: number
  invincibleUntil: number
  damageFlash: number
}

/** 楽器タイプ */
export type InstrumentType = 'piano' | 'violin' | 'viola' | 'cello' | 'guitar' | 'flute' | 'voice'

/** ゲームモード */
export type GameMode = 'noteFrenzy' | 'scales' | 'chords' | 'perfectPitch' | 'fullSong'

/** 記譜法フォーマット */
export type NotationFormat = 'abc' | 'solfege' | 'staff'

/** 難易度設定 */
export interface DifficultySettings {
  speedMultiplier: number      // 敵の速度倍率（デフォルト: 1.0）
  spawnRateMultiplier: number  // 敵のスポーン頻度倍率（デフォルト: 1.0）
  timePressure: number         // 制限時間の厳しさ（デフォルト: 1.0）
}

/** 音域設定 */
export interface NoteRangeConfig {
  minNote: NoteName   // 出題する最低音（デフォルト: 'C'）
  maxNote: NoteName   // 出題する最高音（デフォルト: 'B'）
  clefFilter?: ClefType // 特定の記号のみに制限（省略時: 全記号）
}

/** モード固有の状態（各モードで拡張される） */
export interface ModeState {
  /** モード内の進捗 (0.0〜1.0) */
  progress: number
  /** モード固有のデータ（各モードが独自に使う） */
  data: Record<string, unknown>
}

/** 表示設定 */
export interface DisplaySettings {
  showSolfege: boolean  // カタカナ(ソルフェージュ)表記 on/off
  theme: 'dark' | 'light' // 背景テーマ
  instrument: InstrumentType // 使用楽器（ピッチ検出最適化用）
}

export interface GameState {
  player: Player
  enemies: Enemy[]
  particles: Particle[]
  beams: Beam[]
  score: number
  wave: number
  waveTimer: number
  enemiesPerWave: number
  enemySpeed: number
  nextEnemyId: number
  phase: 'title' | 'playing' | 'gameover' | 'waveAnnounce' | 'modeSelect'
  waveAnnounceTimer: number
  time: number
  lastNoteAttack: NoteName | null
  noteAttackTimer: number
  combo: number
  lastAttackTime: number
  settings: DisplaySettings
  /** 現在のゲームモード（省略時: 'noteFrenzy'） */
  mode?: GameMode
  /** モード固有の状態 */
  modeState?: ModeState
  /** 難易度設定 */
  difficulty?: DifficultySettings
  /** 音域設定 */
  noteRange?: NoteRangeConfig
}

export type GameInput = {
  activeNote: NoteName | null
  /** コード（和音）対応: 同時押しの全ノート */
  activeNotes?: NoteName[]
  source: 'keyboard' | 'piano' | 'mic' | 'midi' | null
}

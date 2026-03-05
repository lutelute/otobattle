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
  phase: 'title' | 'playing' | 'gameover' | 'waveAnnounce'
  waveAnnounceTimer: number
  time: number
  lastNoteAttack: NoteName | null
  noteAttackTimer: number
  combo: number
  lastAttackTime: number
  settings: DisplaySettings
}

export type GameInput = {
  activeNote: NoteName | null
  source: 'keyboard' | 'piano' | 'mic' | 'midi' | null
}

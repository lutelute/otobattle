export const CANVAS_BASE_WIDTH = 800
export const CANVAS_BASE_HEIGHT = 600

export const PLAYER_RADIUS = 20
export const PLAYER_MAX_HP = 5
export const INVINCIBLE_DURATION = 1.5
export const DAMAGE_FLASH_DURATION = 0.3

export const ENEMY_BASE_RADIUS = 18
export const ENEMY_BASE_SPEED = 25       // ゆっくり (was 40)
export const ENEMY_SPEED_INCREMENT = 3   // 速度上昇も緩やか (was 5)
export const ENEMIES_BASE_COUNT = 2      // 少なめから (was 3)
export const ENEMIES_INCREMENT = 1       // 緩やかに増加 (was 2)
export const SPAWN_MARGIN = 50

export const WAVE_ANNOUNCE_DURATION = 2.5
export const WAVE_INTERVAL = 4.0         // ウェーブ間の間隔を広げる

export const NOTE_ATTACK_DISPLAY_DURATION = 0.5
export const COMBO_TIMEOUT = 2.0

export const PARTICLE_COUNT_PER_KILL = 8
export const PARTICLE_LIFE = 0.6
export const BEAM_LIFE = 0.3

// Invader enemy constants
export const INVADER_UNLOCK_WAVE = 1
export const INVADER_SPEED_X = 30       // 横移動速度 (px/s)
export const INVADER_DROP_STEP = 30     // 一段降下のpx
export const INVADER_MARGIN = 40        // 左右の折り返し位置
export const INVADER_ROW_START_Y = 40   // 開始Y位置

// Wave at which sharp enemies start appearing
export const SHARP_UNLOCK_WAVE = 3

// Wave at which bass clef enemies start appearing
export const BASS_CLEF_UNLOCK_WAVE = 2

// Wave at which alto/C clef enemies start appearing
export const ALTO_CLEF_UNLOCK_WAVE = 4

// Beam zigzag/lightning effect constants
export const BEAM_ZIGZAG_AMPLITUDE = 8    // perpendicular offset (px)
export const BEAM_ZIGZAG_SEGMENTS = 10    // number of zigzag segments
export const BEAM_LIGHTNING_SEGMENTS = 6  // number of lightning segments

// Keyboard: letter = natural note, Shift+letter = sharp
// Handled in useKeyboardInput — no static map needed for sharps
export const KEY_NOTE_MAP: Record<string, import('./types').NoteName> = {
  'c': 'C', 'd': 'D', 'e': 'E', 'f': 'F',
  'g': 'G', 'a': 'A', 'b': 'B',
  'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F',
  'G': 'G', 'A': 'A', 'B': 'B',
}

// Shift + key → sharp
export const SHIFT_KEY_NOTE_MAP: Record<string, import('./types').NoteName> = {
  'C': 'C#', 'D': 'D#', 'F': 'F#', 'G': 'G#', 'A': 'A#',
  'c': 'C#', 'd': 'D#', 'f': 'F#', 'g': 'G#', 'a': 'A#',
}

export const COLORS = {
  bg: '#0f0f23',
  bgBottom: '#1a1a2e',
  bgGrid: '#1a1a3e',
  player: '#e94560',
  playerInvincible: '#e9456080',
  staff: '#334155',
  noteColors: {
    'C': '#ef4444', 'C#': '#dc2626',
    'D': '#f97316', 'D#': '#ea580c',
    'E': '#eab308',
    'F': '#22c55e', 'F#': '#16a34a',
    'G': '#3b82f6', 'G#': '#2563eb',
    'A': '#6366f1', 'A#': '#4f46e5',
    'B': '#a855f7',
  } as Record<import('./types').NoteName, string>,
  hud: '#e2e8f0',
  damageFlash: '#ff000040',
  waveText: '#fbbf24',
}

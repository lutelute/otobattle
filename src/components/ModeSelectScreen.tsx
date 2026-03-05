import type { GameMode } from '../game/types'

interface ModeCardInfo {
  mode: GameMode
  title: string
  emoji: string
  description: string
}

const MODE_CARDS: ModeCardInfo[] = [
  {
    mode: 'noteFrenzy',
    title: 'Note Frenzy',
    emoji: '\u{1F3B5}',
    description: 'ランダムな音符が迫る！正しい音を弾いて撃退せよ',
  },
  {
    mode: 'scales',
    title: 'Scales',
    emoji: '\u{1F3B9}',
    description: 'スケールの順番で音を弾こう。調性を極めろ',
  },
  {
    mode: 'chords',
    title: 'Chords',
    emoji: '\u{1F3B6}',
    description: '和音を同時に弾いて敵を倒せ。コード進行に挑戦',
  },
  {
    mode: 'perfectPitch',
    title: 'Perfect Pitch',
    emoji: '\u{1F442}',
    description: '聴こえた音を当てろ！耳を鍛える絶対音感トレーニング',
  },
  {
    mode: 'fullSong',
    title: 'Full Song',
    emoji: '\u{1F3BC}',
    description: 'MIDIファイルを読み込んで曲を通しでプレイ',
  },
]

interface ModeSelectScreenProps {
  onSelectMode: (mode: GameMode) => void
  onBack: () => void
  playerLevel: number
  children?: React.ReactNode
}

export function ModeSelectScreen({ onSelectMode, onBack, playerLevel: _playerLevel, children }: ModeSelectScreenProps) {
  // All modes unlocked for MVP; lock system will be added in Phase 8
  const isUnlocked = (_mode: GameMode) => true

  return (
    <div
      className="absolute inset-0 flex flex-col items-center z-10 overflow-y-auto"
      style={{
        fontFamily: 'var(--pixel-font)',
        background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {/* Back button */}
      <div className="w-full max-w-2xl px-4 pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '14px' }}>{'\u2190'}</span>
          HOME
        </button>
      </div>

      {/* Title */}
      <div className="text-center mt-4 mb-6">
        <h2
          className="text-3xl tracking-wider mb-2"
          style={{
            color: '#e94560',
            textShadow: '0 0 20px rgba(233,69,96,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          SELECT MODE
        </h2>
        <p
          className="text-[10px] tracking-widest"
          style={{ color: '#94a3b8', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          ゲームモードを選択
        </p>
      </div>

      {/* Mode cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4 pb-4 w-full max-w-2xl">
        {MODE_CARDS.map((card) => {
          const unlocked = isUnlocked(card.mode)

          return (
            <button
              key={card.mode}
              onClick={() => unlocked && onSelectMode(card.mode)}
              className="flex flex-col items-center text-center rounded-xl px-4 py-5 transition-all active:scale-95"
              style={{
                background: unlocked
                  ? 'rgba(0,0,0,0.4)'
                  : 'rgba(0,0,0,0.6)',
                border: unlocked
                  ? '1px solid rgba(255,255,255,0.08)'
                  : '1px solid rgba(255,255,255,0.04)',
                backdropFilter: 'blur(4px)',
                cursor: unlocked ? 'pointer' : 'not-allowed',
                opacity: unlocked ? 1 : 0.5,
              }}
              disabled={!unlocked}
            >
              {/* Emoji icon */}
              <span
                className="text-3xl mb-3"
                style={{
                  filter: unlocked ? 'none' : 'grayscale(1)',
                }}
              >
                {unlocked ? card.emoji : '\u{1F512}'}
              </span>

              {/* Title */}
              <h3
                className="text-sm tracking-wide mb-2"
                style={{
                  color: unlocked ? '#e94560' : '#64748b',
                  textShadow: unlocked
                    ? '0 0 8px rgba(233,69,96,0.3)'
                    : 'none',
                }}
              >
                {card.title}
              </h3>

              {/* Description */}
              <p
                className="text-[9px] leading-4"
                style={{
                  color: unlocked ? '#94a3b8' : '#475569',
                }}
              >
                {card.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Settings panel (difficulty & note range) */}
      {children && (
        <div className="px-4 pb-8 w-full max-w-2xl">
          {children}
        </div>
      )}
    </div>
  )
}

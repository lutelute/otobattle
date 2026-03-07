import type { GameMode } from '../game/types'
import type { ProgressionData } from '../game/progression'

/** Mode icon/label mapping for the best scores grid */
const MODE_DISPLAY: Record<GameMode, { emoji: string; label: string }> = {
  noteFrenzy:  { emoji: '\u{1F3B5}', label: 'Frenzy' },
  scales:      { emoji: '\u{1F3B9}', label: 'Scales' },
  chords:      { emoji: '\u{1F3B6}', label: 'Chords' },
  perfectPitch:{ emoji: '\u{1F442}', label: 'Pitch' },
  fullSong:    { emoji: '\u{1F3BC}', label: 'Song' },
}

interface ProgressionDisplayProps {
  progressionData: ProgressionData
  modeBestScores: Partial<Record<GameMode, number>>
}

export function ProgressionDisplay({ progressionData, modeBestScores }: ProgressionDisplayProps) {
  const { level, currentLevelXP, nextLevelXP } = progressionData
  const xpFillRatio = nextLevelXP > 0 ? Math.min(currentLevelXP / nextLevelXP, 1) : 0

  return (
    <div
      className="rounded-xl px-4 py-3 w-full"
      style={{
        fontFamily: 'var(--pixel-font)',
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Level badge + XP bar row */}
      <div className="flex items-center gap-3">
        {/* Level badge (circular with glowing border) */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(233,69,96,0.2) 0%, rgba(233,69,96,0.05) 100%)',
            border: '2px solid rgba(233,69,96,0.6)',
            boxShadow: '0 0 12px rgba(233,69,96,0.3), inset 0 0 8px rgba(233,69,96,0.1)',
          }}
        >
          <span
            className="text-sm font-bold"
            style={{
              color: '#e94560',
              textShadow: '0 0 8px rgba(233,69,96,0.4)',
            }}
          >
            {level}
          </span>
        </div>

        {/* XP info + progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[10px]" style={{ color: '#94a3b8' }}>
              LEVEL {level}
            </p>
            <p className="text-[9px]" style={{ color: '#64748b' }}>
              {currentLevelXP} / {nextLevelXP} XP
            </p>
          </div>

          {/* XP progress bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{
              height: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${xpFillRatio * 100}%`,
                background: 'linear-gradient(90deg, #e94560 0%, #f06292 100%)',
                boxShadow: '0 0 6px rgba(233,69,96,0.4)',
                transition: 'width 0.4s ease-out',
              }}
            />
          </div>
        </div>
      </div>

      {/* Per-mode best scores compact grid */}
      {Object.keys(modeBestScores).length > 0 && (
        <div
          className="grid grid-cols-5 gap-1 mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {(Object.keys(MODE_DISPLAY) as GameMode[]).map((mode) => {
            const score = modeBestScores[mode]
            const display = MODE_DISPLAY[mode]
            return (
              <div
                key={mode}
                className="flex flex-col items-center py-1 rounded-lg"
                style={{
                  background: score != null ? 'rgba(255,255,255,0.03)' : 'transparent',
                  opacity: score != null ? 1 : 0.4,
                }}
              >
                <span className="text-sm">{display.emoji}</span>
                <p
                  className="text-[8px] mt-0.5"
                  style={{ color: score != null ? '#94a3b8' : '#475569' }}
                >
                  {score != null ? score.toLocaleString() : '-'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

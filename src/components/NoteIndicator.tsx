import type { NoteName } from '../game/types'
import { NOTES } from '../game/notes'

interface NoteIndicatorProps {
  note: NoteName | null      // last attack note
  micNote?: NoteName | null  // currently detected mic note
}

export function NoteIndicator({ note, micNote }: NoteIndicatorProps) {
  const displayNote = note || micNote
  if (!displayNote) return null

  const info = NOTES[displayNote]
  const isAttack = !!note

  return (
    <div
      className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none select-none"
      style={{ fontFamily: 'var(--pixel-font)' }}
    >
      <span
        className={`text-3xl font-bold ${isAttack ? 'animate-bounce' : 'animate-pulse'}`}
        style={{
          color: info.color,
          textShadow: `0 0 24px ${info.color}a0, 0 0 48px ${info.color}40, 0 2px 4px rgba(0,0,0,0.8)`,
          opacity: isAttack ? 1 : 0.7,
          WebkitTextStroke: '0.5px rgba(0,0,0,0.3)',
        }}
      >
        {info.solfege}
      </span>
      {micNote && !note && (
        <div className="text-center mt-1">
          <span
            className="text-[8px]"
            style={{
              color: '#94a3b8',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            🎤 検出中
          </span>
        </div>
      )}
    </div>
  )
}

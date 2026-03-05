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
        className={`text-3xl font-bold drop-shadow-lg ${isAttack ? 'animate-bounce' : 'animate-pulse'}`}
        style={{
          color: info.color,
          textShadow: `0 0 20px ${info.color}80`,
          opacity: isAttack ? 1 : 0.6,
        }}
      >
        {info.solfege}
      </span>
      {micNote && !note && (
        <div className="text-center mt-1">
          <span className="text-[8px] text-gray-400">🎤 検出中</span>
        </div>
      )}
    </div>
  )
}

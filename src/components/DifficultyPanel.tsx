import { DIFFICULTY_PRESETS } from '../game/constants'
import type { DifficultySettings, NoteRangeConfig, NoteName } from '../game/types'

/** Difficulty preset key */
export type DifficultyPreset = keyof typeof DIFFICULTY_PRESETS

interface NoteRangePreset {
  label: string
  range: NoteRangeConfig
}

const NOTE_RANGE_PRESETS: NoteRangePreset[] = [
  { label: 'C-E (5音)', range: { minNote: 'C' as NoteName, maxNote: 'E' as NoteName } },
  { label: 'C-G (8音)', range: { minNote: 'C' as NoteName, maxNote: 'G' as NoteName } },
  { label: 'Full (12音)', range: { minNote: 'C' as NoteName, maxNote: 'B' as NoteName } },
]

const DIFFICULTY_OPTIONS: { key: DifficultyPreset; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'normal', label: 'Normal' },
  { key: 'hard', label: 'Hard' },
]

interface DifficultyPanelProps {
  difficulty: DifficultyPreset
  noteRange: NoteRangeConfig
  onChangeDifficulty: (preset: DifficultyPreset) => void
  onChangeNoteRange: (range: NoteRangeConfig) => void
}

/** Compact difficulty & note-range configuration panel */
export function DifficultyPanel({
  difficulty,
  noteRange,
  onChangeDifficulty,
  onChangeNoteRange,
}: DifficultyPanelProps) {
  const isRangeSelected = (preset: NoteRangePreset) =>
    preset.range.minNote === noteRange.minNote && preset.range.maxNote === noteRange.maxNote

  return (
    <div
      className="rounded-xl px-5 py-4 w-full max-w-2xl"
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Two-column horizontal layout */}
      <div className="flex gap-6">
        {/* Difficulty section */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] text-center mb-2 tracking-wide"
            style={{ color: '#94a3b8' }}
          >
            難易度
          </p>
          <div className="flex gap-2">
            {DIFFICULTY_OPTIONS.map(({ key, label }) => {
              const isSelected = difficulty === key
              return (
                <button
                  key={key}
                  onClick={() => onChangeDifficulty(key)}
                  className="flex-1 py-1.5 text-[10px] rounded-full transition-all"
                  style={{
                    background: isSelected ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? 'rgba(233,69,96,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    color: isSelected ? '#e94560' : '#94a3b8',
                    textShadow: isSelected ? '0 0 8px rgba(233,69,96,0.3)' : 'none',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Note range section */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] text-center mb-2 tracking-wide"
            style={{ color: '#94a3b8' }}
          >
            音域
          </p>
          <div className="flex gap-2">
            {NOTE_RANGE_PRESETS.map((preset) => {
              const isSelected = isRangeSelected(preset)
              return (
                <button
                  key={preset.label}
                  onClick={() => onChangeNoteRange(preset.range)}
                  className="flex-1 py-1.5 text-[10px] rounded-full transition-all"
                  style={{
                    background: isSelected ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? 'rgba(233,69,96,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    color: isSelected ? '#e94560' : '#94a3b8',
                    textShadow: isSelected ? '0 0 8px rgba(233,69,96,0.3)' : 'none',
                  }}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Helper: resolve a DifficultyPreset key to its DifficultySettings values */
export function resolveDifficulty(preset: DifficultyPreset): DifficultySettings {
  return DIFFICULTY_PRESETS[preset]
}

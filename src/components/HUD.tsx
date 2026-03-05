import type { DisplaySettings, InstrumentType } from '../game/types'
import { INSTRUMENT_PROFILES } from '../audio/pitchDetector'

const INSTRUMENT_ORDER: InstrumentType[] = ['piano', 'violin', 'viola', 'cello', 'guitar', 'flute', 'voice']

interface HUDProps {
  hp: number
  maxHp: number
  score: number
  wave: number
  combo: number
  settings: DisplaySettings
  onToggleSolfege: () => void
  onToggleTheme: () => void
  onChangeInstrument: (inst: InstrumentType) => void
  onHome: () => void
}

export function HUD({ hp, maxHp, score, wave, combo, settings, onToggleSolfege, onToggleTheme, onChangeInstrument, onHome }: HUDProps) {
  const cycleInstrument = () => {
    const idx = INSTRUMENT_ORDER.indexOf(settings.instrument)
    const next = INSTRUMENT_ORDER[(idx + 1) % INSTRUMENT_ORDER.length]
    onChangeInstrument(next)
  }

  return (
    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none select-none" style={{ fontFamily: 'var(--pixel-font)' }}>
      <div className="flex flex-col gap-1">
        {/* HP */}
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-xs">HP</span>
          <div className="flex gap-0.5">
            {Array.from({ length: maxHp }, (_, i) => (
              <div
                key={i}
                className={`w-4 h-4 border border-red-400 ${i < hp ? 'bg-red-500' : 'bg-transparent'}`}
              />
            ))}
          </div>
        </div>
        {/* Wave */}
        <span className="text-yellow-400 text-xs">WAVE {wave}</span>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-white text-sm">{score.toLocaleString()}</span>
        {combo >= 3 && (
          <span className="text-orange-400 text-xs animate-pulse">
            {combo} COMBO!
          </span>
        )}
        <div className="flex gap-1 pointer-events-auto flex-wrap justify-end">
          <button
            onClick={onHome}
            className="px-1.5 py-0.5 text-[8px] rounded bg-white/20 text-white/80 hover:bg-white/30"
            title="タイトルに戻る"
          >
            HOME
          </button>
          <button
            onClick={cycleInstrument}
            className="px-1.5 py-0.5 text-[8px] rounded bg-white/20 text-white/80 hover:bg-white/30"
            title="楽器切替"
          >
            {INSTRUMENT_PROFILES[settings.instrument].label}
          </button>
          <button
            onClick={onToggleSolfege}
            className="px-1.5 py-0.5 text-[8px] rounded bg-white/20 text-white/80 hover:bg-white/30"
          >
            {settings.showSolfege ? 'ABC' : 'ドレミ'}
          </button>
          <button
            onClick={onToggleTheme}
            className="px-1.5 py-0.5 text-[8px] rounded bg-white/20 text-white/80 hover:bg-white/30"
          >
            {settings.theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>
    </div>
  )
}

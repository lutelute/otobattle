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

  const isDark = settings.theme === 'dark'

  // Backdrop panel styles for readability on any background
  const panelBg = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.65)'
  const panelBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const textShadow = isDark
    ? '0 1px 3px rgba(0,0,0,0.8)'
    : '0 1px 2px rgba(255,255,255,0.6)'

  // Button styles for better contrast and touch targets
  const btnClass = isDark
    ? 'bg-white/15 text-white/90 hover:bg-white/25 border border-white/10'
    : 'bg-black/10 text-black/80 hover:bg-black/20 border border-black/10'

  return (
    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start pointer-events-none select-none" style={{ fontFamily: 'var(--pixel-font)' }}>
      {/* Left panel: HP + Wave */}
      <div
        className="flex flex-col gap-1.5 rounded-lg px-3 py-2"
        style={{
          background: panelBg,
          border: `1px solid ${panelBorder}`,
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* HP */}
        <div className="flex items-center gap-2">
          <span
            className="text-red-400 text-sm font-bold tracking-wide"
            style={{ textShadow }}
          >
            HP
          </span>
          <div className="flex gap-1">
            {Array.from({ length: maxHp }, (_, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-sm border-2 transition-colors ${
                  i < hp
                    ? 'border-red-400 bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]'
                    : isDark
                      ? 'border-red-400/30 bg-transparent'
                      : 'border-red-300/40 bg-transparent'
                }`}
              />
            ))}
          </div>
        </div>
        {/* Wave */}
        <span
          className="text-yellow-400 text-sm font-bold"
          style={{ textShadow }}
        >
          WAVE {wave}
        </span>
      </div>

      {/* Right panel: Score + Combo + Controls */}
      <div className="flex flex-col items-end gap-1.5">
        {/* Score panel */}
        <div
          className="rounded-lg px-3 py-1.5"
          style={{
            background: panelBg,
            border: `1px solid ${panelBorder}`,
            backdropFilter: 'blur(4px)',
          }}
        >
          <span
            className={`text-base font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}
            style={{ textShadow }}
          >
            {score.toLocaleString()}
          </span>
          {combo >= 3 && (
            <div className="text-right">
              <span
                className="text-sm font-bold animate-pulse"
                style={{
                  color: combo >= 10 ? '#f97316' : combo >= 5 ? '#fb923c' : '#fdba74',
                  textShadow: `0 0 8px ${combo >= 10 ? 'rgba(249,115,22,0.6)' : 'rgba(251,146,60,0.4)'}`,
                }}
              >
                {combo} COMBO!
              </span>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex gap-1.5 pointer-events-auto flex-wrap justify-end">
          <button
            onClick={onHome}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${btnClass}`}
            title="タイトルに戻る"
          >
            HOME
          </button>
          <button
            onClick={cycleInstrument}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${btnClass}`}
            title="楽器切替"
          >
            {INSTRUMENT_PROFILES[settings.instrument].label}
          </button>
          <button
            onClick={onToggleSolfege}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${btnClass}`}
          >
            {settings.showSolfege ? 'ABC' : 'ドレミ'}
          </button>
          <button
            onClick={onToggleTheme}
            className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${btnClass}`}
          >
            {settings.theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>
    </div>
  )
}

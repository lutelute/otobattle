import { ensureAudioContext } from '../audio/audioContext'
import { INSTRUMENT_PROFILES } from '../audio/pitchDetector'
import type { InstrumentType } from '../game/types'

const INSTRUMENT_ORDER: InstrumentType[] = ['piano', 'violin', 'viola', 'cello', 'guitar', 'flute', 'voice']

interface TitleScreenProps {
  onStart: () => void
  instrument: InstrumentType
  onChangeInstrument: (inst: InstrumentType) => void
}

export function TitleScreen({ onStart, instrument, onChangeInstrument }: TitleScreenProps) {
  const handleStart = async () => {
    await ensureAudioContext()
    onStart()
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e] z-10" style={{ fontFamily: 'var(--pixel-font)' }}>
      <h1 className="text-4xl text-red-400 mb-2 tracking-wider">OtoBattle</h1>
      <p className="text-sm text-gray-400 mb-6">音楽 × サバイバル</p>

      {/* 楽器選択 */}
      <div className="mb-6">
        <p className="text-[10px] text-gray-500 text-center mb-3">楽器を選択</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-sm">
          {INSTRUMENT_ORDER.map((inst) => {
            const profile = INSTRUMENT_PROFILES[inst]
            const isSelected = instrument === inst
            return (
              <button
                key={inst}
                onClick={() => onChangeInstrument(inst)}
                className={`px-3 py-2 text-[10px] rounded border transition-all ${
                  isSelected
                    ? 'border-red-400 text-red-400 bg-red-500/15'
                    : 'border-gray-600 text-gray-400 bg-gray-800/50 hover:border-gray-400'
                }`}
              >
                {profile.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={handleStart}
        className="px-10 py-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 active:scale-95 transition-all mb-8"
      >
        START
      </button>

      <div className="text-[9px] text-gray-500 leading-5 text-center max-w-xs">
        <p>敵の音符を見て、正しい音を鳴らせ！</p>
        <p className="mt-2">MIDIキーボード / マイク / タッチピアノ</p>
        <p className="mt-1">PCキーボード: C D E F G A B (Shift=♯)</p>
      </div>
    </div>
  )
}

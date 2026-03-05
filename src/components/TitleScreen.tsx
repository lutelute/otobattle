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
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      style={{
        fontFamily: 'var(--pixel-font)',
        background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {/* Title block */}
      <div className="text-center mb-8">
        <h1
          className="text-5xl tracking-wider mb-3"
          style={{
            color: '#e94560',
            textShadow: '0 0 20px rgba(233,69,96,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          OtoBattle
        </h1>
        <p
          className="text-sm tracking-widest"
          style={{ color: '#94a3b8', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          音楽 × サバイバル
        </p>
      </div>

      {/* Instrument selection panel */}
      <div
        className="mb-8 rounded-xl px-5 py-4 w-80 max-w-[90vw]"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <p
          className="text-[10px] text-center mb-3 tracking-wide"
          style={{ color: '#94a3b8' }}
        >
          楽器を選択
        </p>
        <div className="grid grid-cols-3 gap-2">
          {INSTRUMENT_ORDER.map((inst) => {
            const profile = INSTRUMENT_PROFILES[inst]
            const isSelected = instrument === inst
            return (
              <button
                key={inst}
                onClick={() => onChangeInstrument(inst)}
                className="py-2 text-[10px] rounded-lg transition-all"
                style={{
                  background: isSelected ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isSelected ? 'rgba(233,69,96,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  color: isSelected ? '#e94560' : '#94a3b8',
                  textShadow: isSelected ? '0 0 8px rgba(233,69,96,0.3)' : 'none',
                }}
              >
                {profile.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* PLAY button - navigates to mode selection */}
      <button
        onClick={handleStart}
        className="px-12 py-3.5 text-sm rounded-lg transition-all active:scale-95 mb-10"
        style={{
          background: 'linear-gradient(135deg, #e94560 0%, #c73a52 100%)',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 15px rgba(233,69,96,0.35), 0 1px 3px rgba(0,0,0,0.3)',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        PLAY
      </button>

      {/* Instructions */}
      <div
        className="text-center max-w-xs leading-6 rounded-lg px-4 py-3"
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <p className="text-[9px]" style={{ color: '#94a3b8' }}>
          敵の音符を見て、正しい音を鳴らせ！
        </p>
        <p className="text-[9px] mt-2" style={{ color: '#64748b' }}>
          MIDIキーボード / マイク / タッチピアノ
        </p>
        <p className="text-[9px] mt-1" style={{ color: '#64748b' }}>
          PCキーボード: C D E F G A B (Shift=♯)
        </p>
      </div>
    </div>
  )
}

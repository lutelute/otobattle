import { useRef, useState } from 'react'
import type { GameInput, NoteName } from '../game/types'
import { ALL_NOTE_NAMES } from '../game/notes'

interface PianoKeyboardProps {
  inputRef: React.MutableRefObject<GameInput>
  micEnabled: boolean
  micError: string | null
  onToggleMic: () => void
  midiConnected?: boolean
  midiDeviceName?: string | null
  midiError?: string | null
  activeMidiNote?: number | null
}

// 1オクターブの白鍵ノート名（順番）
const WHITE_NOTES: NoteName[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// 黒鍵: 白鍵インデックスの右側に配置
const BLACK_KEY_POSITIONS: { note: NoteName; afterWhiteIdx: number }[] = [
  { note: 'C#', afterWhiteIdx: 0 },
  { note: 'D#', afterWhiteIdx: 1 },
  { note: 'F#', afterWhiteIdx: 3 },
  { note: 'G#', afterWhiteIdx: 4 },
  { note: 'A#', afterWhiteIdx: 5 },
]

const OCTAVES = 4            // 4オクターブ
const OCTAVE_START = 2       // C2から開始
const TOTAL_WHITE_KEYS = WHITE_NOTES.length * OCTAVES  // 28

/** MIDIノート番号をkeyId形式 'note+octave' に変換 (60=C4, 61=C#4, etc.) */
function midiNoteToKeyId(midiNote: number): string {
  const noteName = ALL_NOTE_NAMES[midiNote % 12]
  const octave = Math.floor(midiNote / 12) - 1
  return `${noteName}${octave}`
}

export function PianoKeyboard({ inputRef, micEnabled, micError, onToggleMic, midiConnected, midiDeviceName, midiError, activeMidiNote }: PianoKeyboardProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null) // "note-octave" で一意識別
  const containerRef = useRef<HTMLDivElement>(null)

  // MIDIノート番号からkeyId形式に変換してハイライト対象を決定
  const midiKeyId = activeMidiNote != null ? midiNoteToKeyId(activeMidiNote) : null

  const handlePointerDown = (note: NoteName, keyId: string) => {
    inputRef.current = { activeNote: note, source: 'piano' }
    setActiveKey(keyId)
  }

  const handlePointerUp = () => {
    if (inputRef.current.source === 'piano') {
      inputRef.current = { activeNote: null, source: null }
    }
    setActiveKey(null)
  }

  const whiteKeyWidthPct = 100 / TOTAL_WHITE_KEYS

  // 白鍵を全オクターブ分生成
  const whiteKeys: { note: NoteName; octave: number; globalIdx: number }[] = []
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (let i = 0; i < WHITE_NOTES.length; i++) {
      whiteKeys.push({
        note: WHITE_NOTES[i],
        octave: OCTAVE_START + oct,
        globalIdx: oct * WHITE_NOTES.length + i,
      })
    }
  }

  // 黒鍵を全オクターブ分生成
  const blackKeys: { note: NoteName; octave: number; globalWhiteIdx: number }[] = []
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (const bk of BLACK_KEY_POSITIONS) {
      blackKeys.push({
        note: bk.note,
        octave: OCTAVE_START + oct,
        globalWhiteIdx: oct * WHITE_NOTES.length + bk.afterWhiteIdx,
      })
    }
  }

  return (
    <div className="bg-[#0f0f23] select-none flex flex-col">
      {/* Piano */}
      <div
        ref={containerRef}
        style={{
          padding: '3px 2px 2px',
          background: 'linear-gradient(180deg, #3d2414 0%, #2a1a0e 60%, #1a0f08 100%)',
          borderTop: '3px solid #5a3520',
        }}
      >
        <div className="relative" style={{ height: '110px' }}>
          {/* White keys */}
          <div className="flex h-full">
            {whiteKeys.map(({ note, octave }) => {
              const keyId = `${note}${octave}`
              const isActive = activeKey === keyId || midiKeyId === keyId
              const isC4Octave = octave === 4
              // C4オクターブの鍵盤は少しハイライト
              const highlight = isC4Octave

              return (
                <button
                  key={keyId}
                  className="relative touch-none"
                  style={{
                    flex: 1,
                    height: '100%',
                    margin: '0 0.5px',
                    borderRadius: '0 0 3px 3px',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive
                      ? 'linear-gradient(180deg, #e94560 0%, #c73a52 100%)'
                      : highlight
                        ? 'linear-gradient(180deg, #fffff0 0%, #f8f8ee 70%, #eeeede 90%, #ddddc8 100%)'
                        : 'linear-gradient(180deg, #f8f8f8 0%, #efefef 70%, #e0e0e0 90%, #d4d4d4 100%)',
                    boxShadow: isActive
                      ? 'inset 0 2px 6px rgba(0,0,0,0.3), 0 0 8px rgba(233,69,96,0.4)'
                      : 'inset 0 -3px 4px rgba(0,0,0,0.08), 0 2px 0 #999, -0.5px 0 0 #ccc, 0.5px 0 0 #ccc',
                    transform: isActive ? 'translateY(2px)' : 'translateY(0)',
                    transition: 'transform 50ms, box-shadow 50ms',
                    zIndex: 1,
                  }}
                  onPointerDown={() => handlePointerDown(note, keyId)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* Cキーにオクターブ番号を表示 */}
                  {note === 'C' && (
                    <div className="absolute bottom-1 left-0 right-0 text-center">
                      <div style={{
                        fontFamily: 'var(--pixel-font)',
                        fontSize: '7px',
                        color: isActive ? '#fff' : isC4Octave ? '#e94560' : '#888',
                      }}>
                        C{octave}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Black keys */}
          {blackKeys.map(({ note, octave, globalWhiteIdx }) => {
            const keyId = `${note}${octave}`
            const isActive = activeKey === keyId || midiKeyId === keyId
            const leftPct = (globalWhiteIdx + 1) * whiteKeyWidthPct - whiteKeyWidthPct * 0.3
            const widthPct = whiteKeyWidthPct * 0.6

            return (
              <button
                key={keyId}
                className="absolute top-0 touch-none"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  height: '58%',
                  borderRadius: '0 0 3px 3px',
                  border: 'none',
                  cursor: 'pointer',
                  background: isActive
                    ? 'linear-gradient(180deg, #e94560 0%, #a83248 100%)'
                    : 'linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 85%, #0a0a0a 100%)',
                  boxShadow: isActive
                    ? 'inset 0 2px 4px rgba(0,0,0,0.5), 0 0 6px rgba(233,69,96,0.5)'
                    : 'inset 0 -2px 3px rgba(255,255,255,0.08), 0 2px 0 #000, -0.5px 0 0 #2a2a2a, 0.5px 0 0 #2a2a2a',
                  transform: isActive ? 'translateY(2px)' : 'translateY(0)',
                  transition: 'transform 50ms, box-shadow 50ms',
                  zIndex: 2,
                }}
                onPointerDown={() => handlePointerDown(note, keyId)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={(e) => e.preventDefault()}
              />
            )
          })}
        </div>
      </div>

      {/* Input status bar */}
      <div className="flex justify-center items-center gap-3 py-1.5 bg-[#0f0f23] flex-wrap" style={{ fontFamily: 'var(--pixel-font)' }}>
        {/* MIDI status */}
        {midiConnected ? (
          <span className="text-[9px] px-3 py-1 rounded border border-blue-400/60 text-blue-300 bg-blue-500/15">
            MIDI: {midiDeviceName ?? 'Connected'}
          </span>
        ) : midiError ? (
          <span className="text-red-400 text-[9px]">{midiError}</span>
        ) : null}

        {/* Mic toggle */}
        <button
          onClick={onToggleMic}
          className={`text-[9px] px-3 py-1 rounded border ${
            micEnabled
              ? 'border-green-400/60 text-green-300 bg-green-500/15'
              : 'border-slate-500 text-slate-400 bg-slate-800/60'
          }`}
        >
          MIC {micEnabled ? 'ON' : 'OFF'}
        </button>
        {micError && (
          <span className="text-red-400 text-[9px]">{micError}</span>
        )}
      </div>
    </div>
  )
}

import { useRef, useCallback, useEffect } from 'react'
import { useGameLoop } from '../hooks/useGameLoop'
import { useKeyboardInput } from '../hooks/useKeyboardInput'
import { useAudio } from '../hooks/useAudio'
import { useMidiInput } from '../hooks/useMidiInput'
import { useCanvasSize } from '../hooks/useCanvasSize'
import { HUD } from './HUD'
import { PianoKeyboard } from './PianoKeyboard'
import { NoteIndicator } from './NoteIndicator'
import { GameOverScreen } from './GameOverScreen'
import { TitleScreen } from './TitleScreen'
import { playAttackSound, playDamageSound, playGameOverSound, playWaveStartSound } from '../audio/synth'
import { ensureAudioContext } from '../audio/audioContext'
import { saveBestScore } from '../utils/storage'
import { setSmuflReady } from '../game/renderer'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Bravuraフォント読み込み検出
  useEffect(() => {
    document.fonts.load('32px Bravura').then(() => {
      setSmuflReady(true)
    }).catch(() => {})
  }, [])

  useCanvasSize(canvasRef, containerRef)
  const { hud, inputRef, stateRef, startGame, goToTitle } = useGameLoop(canvasRef)

  const isPlaying = hud.phase === 'playing' || hud.phase === 'waveAnnounce'

  useKeyboardInput(inputRef, isPlaying)
  const { micEnabled, micError, detectedNote, enableMic, disableMic } = useAudio(inputRef, isPlaying, hud.settings.instrument)
  const { midiConnected, midiDeviceName, midiError } = useMidiInput(inputRef, isPlaying)

  const handleRestart = useCallback(async () => {
    await ensureAudioContext()
    startGame()
  }, [startGame])

  // Track previous state for sound effects
  const prevHpRef = useRef(hud.hp)
  const prevWaveRef = useRef(hud.wave)
  const prevPhaseRef = useRef(hud.phase)
  const prevNoteRef = useRef(hud.lastNoteAttack)

  // Sound effect triggers based on HUD state changes
  if (hud.hp < prevHpRef.current && hud.hp > 0) {
    playDamageSound()
  }
  if (hud.phase === 'gameover' && prevPhaseRef.current !== 'gameover') {
    playGameOverSound()
    saveBestScore(hud.score)
  }
  if (hud.wave > prevWaveRef.current) {
    playWaveStartSound()
  }
  if (hud.lastNoteAttack && hud.lastNoteAttack !== prevNoteRef.current) {
    playAttackSound(hud.lastNoteAttack)
  }
  prevHpRef.current = hud.hp
  prevWaveRef.current = hud.wave
  prevPhaseRef.current = hud.phase
  prevNoteRef.current = hud.lastNoteAttack

  return (
    <div className="relative w-full h-full flex flex-col">
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0" />

        {isPlaying && (
          <>
            <HUD
              hp={hud.hp} maxHp={hud.maxHp} score={hud.score} wave={hud.wave} combo={hud.combo}
              settings={hud.settings}
              onToggleSolfege={() => {
                stateRef.current.settings.showSolfege = !stateRef.current.settings.showSolfege
              }}
              onToggleTheme={() => {
                stateRef.current.settings.theme = stateRef.current.settings.theme === 'dark' ? 'light' : 'dark'
              }}
              onChangeInstrument={(inst) => {
                stateRef.current.settings.instrument = inst
              }}
              onHome={goToTitle}
            />
            <NoteIndicator note={hud.lastNoteAttack} micNote={detectedNote} />
          </>
        )}

        {hud.phase === 'title' && (
          <TitleScreen
            onStart={handleRestart}
            instrument={hud.settings.instrument}
            onChangeInstrument={(inst) => {
              stateRef.current.settings.instrument = inst
            }}
          />
        )}

        {hud.phase === 'gameover' && (
          <GameOverScreen score={hud.score} wave={hud.wave} onRestart={handleRestart} onHome={goToTitle} />
        )}
      </div>

      {isPlaying && (
        <PianoKeyboard
          inputRef={inputRef}
          micEnabled={micEnabled}
          micError={micError}
          onToggleMic={() => micEnabled ? disableMic() : enableMic()}
          midiConnected={midiConnected}
          midiDeviceName={midiDeviceName}
          midiError={midiError}
        />
      )}
    </div>
  )
}

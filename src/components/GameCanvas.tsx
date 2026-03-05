import { useRef, useCallback, useEffect, useState } from 'react'
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
import { ModeSelectScreen } from './ModeSelectScreen'
import { DifficultyPanel, resolveDifficulty } from './DifficultyPanel'
import type { DifficultyPreset } from './DifficultyPanel'
import { playAttackSound, playDamageSound, playGameOverSound, playWaveStartSound } from '../audio/synth'
import { ensureAudioContext } from '../audio/audioContext'
import { saveBestScore } from '../utils/storage'
import { setSmuflReady } from '../game/renderer'
import type { GameMode, NoteRangeConfig } from '../game/types'
import { requestReplay } from '../game/modes/perfectPitch'

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
  const { hud, inputRef, stateRef, startGame, goToModeSelect, goToTitle } = useGameLoop(canvasRef)

  const isPlaying = hud.phase === 'playing' || hud.phase === 'waveAnnounce'

  useKeyboardInput(inputRef, isPlaying)
  // Disable mic auto-start in Chords mode (mic cannot detect polyphonic chords)
  const isChordsMode = hud.mode === 'chords'
  const { micEnabled, micError, detectedNote, enableMic, disableMic } = useAudio(inputRef, isPlaying && !isChordsMode, hud.settings.instrument)
  const { midiConnected, midiDeviceName, midiError, activeMidiNote } = useMidiInput(inputRef, isPlaying)

  // Mode selection state (difficulty & note range are chosen before starting a game)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyPreset>('normal')
  const [selectedNoteRange, setSelectedNoteRange] = useState<NoteRangeConfig>({ minNote: 'C', maxNote: 'B' })

  const handleGoToModeSelect = useCallback(async () => {
    await ensureAudioContext()
    goToModeSelect()
  }, [goToModeSelect])

  const handleSelectMode = useCallback(async (mode: GameMode) => {
    await ensureAudioContext()
    startGame(mode, resolveDifficulty(selectedDifficulty), selectedNoteRange)
  }, [startGame, selectedDifficulty, selectedNoteRange])

  const handleRestart = useCallback(async () => {
    await ensureAudioContext()
    // Restart with the same mode and settings
    const currentMode = stateRef.current.mode ?? 'noteFrenzy'
    const currentDifficulty = stateRef.current.difficulty
    const currentNoteRange = stateRef.current.noteRange
    startGame(currentMode, currentDifficulty, currentNoteRange)
  }, [startGame, stateRef])

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
              mode={hud.mode}
              modeState={hud.modeState}
              onCycleNotation={() => {
                const order: import('../game/types').NotationFormat[] = ['abc', 'solfege', 'staff']
                const idx = order.indexOf(stateRef.current.settings.notationFormat)
                stateRef.current.settings.notationFormat = order[(idx + 1) % order.length]
              }}
              onToggleTheme={() => {
                stateRef.current.settings.theme = stateRef.current.settings.theme === 'dark' ? 'light' : 'dark'
              }}
              onChangeInstrument={(inst) => {
                stateRef.current.settings.instrument = inst
              }}
              onHome={goToTitle}
              onReplay={() => requestReplay(stateRef.current)}
            />
            <NoteIndicator note={hud.lastNoteAttack} micNote={detectedNote} />
          </>
        )}

        {hud.phase === 'title' && (
          <TitleScreen
            onStart={handleGoToModeSelect}
            instrument={hud.settings.instrument}
            onChangeInstrument={(inst) => {
              stateRef.current.settings.instrument = inst
            }}
          />
        )}

        {hud.phase === 'modeSelect' && (
          <ModeSelectScreen
            onSelectMode={handleSelectMode}
            onBack={goToTitle}
            playerLevel={1}
          >
            <DifficultyPanel
              difficulty={selectedDifficulty}
              noteRange={selectedNoteRange}
              onChangeDifficulty={setSelectedDifficulty}
              onChangeNoteRange={setSelectedNoteRange}
            />
          </ModeSelectScreen>
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
          micDisabled={isChordsMode}
          midiConnected={midiConnected}
          midiDeviceName={midiDeviceName}
          midiError={midiError}
          activeMidiNote={activeMidiNote}
        />
      )}
    </div>
  )
}

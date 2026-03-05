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
import { MidiFileUpload } from './MidiFileUpload'
import { playAttackSound, playDamageSound, playGameOverSound, playWaveStartSound } from '../audio/synth'
import { ensureAudioContext } from '../audio/audioContext'
import { saveBestScore, loadProgression, saveProgression, saveModeBestScore, getAllModeBestScores } from '../utils/storage'
import { calculateXP, addXP } from '../game/progression'
import type { ProgressionData } from '../game/progression'
import { setSmuflReady } from '../game/renderer'
import type { GameMode, NoteRangeConfig } from '../game/types'
import { requestReplay } from '../game/modes/perfectPitch'
import { createFullSongState } from '../game/modes/fullSong'
import type { MidiNoteEvent } from '../game/midiParser'

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

  // Progression state: loaded from localStorage on mount
  const [progression, setProgression] = useState<ProgressionData>(() => loadProgression())
  const [modeBestScores, setModeBestScores] = useState(() => getAllModeBestScores())

  // Game-over XP results (set when game ends, consumed by GameOverScreen)
  const [xpGained, setXpGained] = useState(0)
  const [leveledUp, setLeveledUp] = useState(false)
  const [newLevel, setNewLevel] = useState(0)

  // Mode selection state (difficulty & note range are chosen before starting a game)
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyPreset>('normal')
  const [selectedNoteRange, setSelectedNoteRange] = useState<NoteRangeConfig>({ minNote: 'C', maxNote: 'B' })

  // Full Song mode: MIDI file upload state
  const [showMidiUpload, setShowMidiUpload] = useState(false)

  // Reset MIDI upload state when phase changes away from modeSelect
  useEffect(() => {
    if (hud.phase !== 'modeSelect') {
      setShowMidiUpload(false)
    }
  }, [hud.phase])

  const handleGoToModeSelect = useCallback(async () => {
    await ensureAudioContext()
    goToModeSelect()
  }, [goToModeSelect])

  const handleSelectMode = useCallback(async (mode: GameMode) => {
    await ensureAudioContext()
    if (mode === 'fullSong') {
      // Show MIDI file upload UI instead of starting game immediately
      setShowMidiUpload(true)
      return
    }
    startGame(mode, resolveDifficulty(selectedDifficulty), selectedNoteRange)
  }, [startGame, selectedDifficulty, selectedNoteRange])

  /** Called when MIDI file is loaded and track selected in MidiFileUpload */
  const handleMidiReady = useCallback((
    timeline: MidiNoteEvent[],
    trackInfo: { name: string; songDuration: number; trackIndex: number },
  ) => {
    setShowMidiUpload(false)
    startGame('fullSong', resolveDifficulty(selectedDifficulty), selectedNoteRange)

    // Inject parsed timeline data into the full song mode state
    const fullSongData = createFullSongState(
      timeline,
      trackInfo.name,
      trackInfo.songDuration,
      trackInfo.trackIndex,
    )
    stateRef.current.modeState = {
      progress: 0,
      data: fullSongData as unknown as Record<string, unknown>,
    }
  }, [startGame, selectedDifficulty, selectedNoteRange, stateRef])

  const handleRestart = useCallback(async () => {
    await ensureAudioContext()
    const currentMode = stateRef.current.mode ?? 'noteFrenzy'
    // For fullSong mode, go back to MIDI file upload instead of restarting with empty timeline
    if (currentMode === 'fullSong') {
      goToModeSelect()
      setShowMidiUpload(true)
      return
    }
    const currentDifficulty = stateRef.current.difficulty
    const currentNoteRange = stateRef.current.noteRange
    startGame(currentMode, currentDifficulty, currentNoteRange)
  }, [startGame, stateRef, goToModeSelect])

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

    // Calculate XP and update progression
    const currentMode = stateRef.current.mode ?? 'noteFrenzy'
    const earned = calculateXP(hud.score, hud.wave, currentMode)
    const prevLevel = progression.level
    const updated = addXP(progression, earned)
    saveProgression(updated)
    saveModeBestScore(currentMode, hud.score)
    setProgression(updated)
    setModeBestScores(getAllModeBestScores())
    setXpGained(earned)
    setLeveledUp(updated.level > prevLevel)
    setNewLevel(updated.level)
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

        {hud.phase === 'modeSelect' && !showMidiUpload && (
          <ModeSelectScreen
            onSelectMode={handleSelectMode}
            onBack={goToTitle}
            playerLevel={progression.level}
            progressionData={progression}
            modeBestScores={modeBestScores}
          >
            <DifficultyPanel
              difficulty={selectedDifficulty}
              noteRange={selectedNoteRange}
              onChangeDifficulty={setSelectedDifficulty}
              onChangeNoteRange={setSelectedNoteRange}
            />
          </ModeSelectScreen>
        )}

        {showMidiUpload && (
          <MidiFileUpload
            onReady={handleMidiReady}
            onBack={() => setShowMidiUpload(false)}
          />
        )}

        {hud.phase === 'gameover' && (
          <GameOverScreen
            score={hud.score}
            wave={hud.wave}
            onRestart={handleRestart}
            onHome={goToTitle}
            xpGained={xpGained}
            leveledUp={leveledUp}
            newLevel={newLevel}
          />
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

import { useRef, useCallback, useEffect, useState } from 'react'
import type { GameState, GameInput, DisplaySettings } from '../game/types'
import { createInitialState, updateGame } from '../game/engine'
import { render } from '../game/renderer'

export interface HudState {
  hp: number
  maxHp: number
  score: number
  wave: number
  combo: number
  phase: GameState['phase']
  lastNoteAttack: GameState['lastNoteAttack']
  settings: DisplaySettings
}

export function useGameLoop(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const stateRef = useRef<GameState>(createInitialState())
  const inputRef = useRef<GameInput>({ activeNote: null, source: null })
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [hud, setHud] = useState<HudState>({
    hp: 5, maxHp: 5, score: 0, wave: 0, combo: 0, phase: 'title', lastNoteAttack: null,
    settings: { showSolfege: true, theme: 'dark', instrument: 'piano' },
  })
  const hudThrottleRef = useRef(0)

  const startGame = useCallback(() => {
    const settings = stateRef.current.settings
    stateRef.current = createInitialState(settings)
    lastTimeRef.current = 0
  }, [])

  const goToTitle = useCallback(() => {
    const settings = stateRef.current.settings
    stateRef.current = createInitialState(settings)
    stateRef.current.phase = 'title'
    lastTimeRef.current = 0
    // 即座にHUDに反映
    setHud(prev => ({ ...prev, phase: 'title' }))
  }, [])

  const loop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current
    if (!canvas) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05) // cap at 50ms
    lastTimeRef.current = timestamp

    const state = stateRef.current

    if (state.phase === 'playing' || state.phase === 'waveAnnounce') {
      updateGame(state, dt, inputRef.current)
    }

    const ctx = canvas.getContext('2d')
    if (ctx) {
      render(ctx, state, canvas.width, canvas.height)
    }

    // Throttle HUD updates to ~10fps
    if (timestamp - hudThrottleRef.current > 100) {
      hudThrottleRef.current = timestamp
      setHud({
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        score: state.score,
        wave: state.wave,
        combo: state.combo,
        phase: state.phase,
        lastNoteAttack: state.lastNoteAttack,
        settings: { ...state.settings },
      })
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [canvasRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [loop])

  return { hud, inputRef, stateRef, startGame, goToTitle }
}

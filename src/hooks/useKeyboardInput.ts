import { useEffect } from 'react'
import type { GameInput } from '../game/types'
import { KEY_NOTE_MAP, SHIFT_KEY_NOTE_MAP } from '../game/constants'

export function useKeyboardInput(
  inputRef: React.MutableRefObject<GameInput>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    const pressed = new Set<string>()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return

      // Shift + letter = sharp
      if (e.shiftKey) {
        const sharp = SHIFT_KEY_NOTE_MAP[e.key]
        if (sharp) {
          pressed.add('Shift+' + e.key.toLowerCase())
          inputRef.current = { activeNote: sharp, source: 'keyboard' }
          return
        }
      }

      const note = KEY_NOTE_MAP[e.key]
      if (note) {
        pressed.add(e.key.toLowerCase())
        inputRef.current = { activeNote: note, source: 'keyboard' }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase())
      pressed.delete('Shift+' + e.key.toLowerCase())

      if (pressed.size === 0) {
        inputRef.current = { activeNote: null, source: null }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [inputRef, enabled])
}

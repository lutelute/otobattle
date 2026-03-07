import { useEffect } from 'react'
import type { GameInput, NoteName } from '../game/types'
import { KEY_NOTE_MAP, SHIFT_KEY_NOTE_MAP } from '../game/constants'

export function useKeyboardInput(
  inputRef: React.MutableRefObject<GameInput>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return

    const pressed = new Set<string>()

    /** pressed Set から現在押されている全ノート名を導出 */
    const getActiveNotes = (): NoteName[] => {
      const notes: NoteName[] = []
      for (const key of pressed) {
        if (key.startsWith('Shift+')) {
          const note = SHIFT_KEY_NOTE_MAP[key.slice(6)]
          if (note) notes.push(note)
        } else {
          const note = KEY_NOTE_MAP[key]
          if (note) notes.push(note)
        }
      }
      return notes
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return

      // Shift + letter = sharp
      if (e.shiftKey) {
        const sharp = SHIFT_KEY_NOTE_MAP[e.key]
        if (sharp) {
          pressed.add('Shift+' + e.key.toLowerCase())
          const activeNotes = getActiveNotes()
          inputRef.current = { activeNote: sharp, activeNotes, source: 'keyboard' }
          return
        }
      }

      const note = KEY_NOTE_MAP[e.key]
      if (note) {
        pressed.add(e.key.toLowerCase())
        const activeNotes = getActiveNotes()
        inputRef.current = { activeNote: note, activeNotes, source: 'keyboard' }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.key.toLowerCase())
      pressed.delete('Shift+' + e.key.toLowerCase())

      if (pressed.size === 0) {
        inputRef.current = { activeNote: null, source: null }
      } else {
        const activeNotes = getActiveNotes()
        inputRef.current = { activeNote: activeNotes[activeNotes.length - 1], activeNotes, source: 'keyboard' }
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

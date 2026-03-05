import { useEffect, useRef, useState, useCallback } from 'react'
import type { GameInput, NoteName } from '../game/types'
import { ALL_NOTE_NAMES } from '../game/notes'

/**
 * Web MIDI API によるMIDIキーボード入力
 * - 遅延ゼロ、100%正確なノート検出
 * - MIDIノート番号→音名変換（オクターブ無視）
 * - noteOn/noteOff イベントに即座に反応
 */

/** MIDIノート番号(0-127)から音名へ変換 */
function midiNoteToName(midiNote: number): NoteName {
  return ALL_NOTE_NAMES[midiNote % 12]
}

export function useMidiInput(
  inputRef: React.MutableRefObject<GameInput>,
  enabled: boolean,
) {
  const [midiAvailable, setMidiAvailable] = useState(false)
  const [midiConnected, setMidiConnected] = useState(false)
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null)
  const [midiError, setMidiError] = useState<string | null>(null)
  const [activeMidiNote, setActiveMidiNote] = useState<number | null>(null)
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  const activeNotesRef = useRef<Set<number>>(new Set())

  // MIDI対応チェック
  useEffect(() => {
    setMidiAvailable('requestMIDIAccess' in navigator)
  }, [])

  const handleMidiMessage = useCallback((e: MIDIMessageEvent) => {
    if (!enabled) return
    const data = e.data
    if (!data || data.length < 3) return

    const status = data[0] & 0xf0
    const note = data[1]
    const velocity = data[2]

    if (status === 0x90 && velocity > 0) {
      // Note On
      activeNotesRef.current.add(note)
      const noteName = midiNoteToName(note)
      const activeNotes = [...new Set(Array.from(activeNotesRef.current).map(midiNoteToName))]
      inputRef.current = { activeNote: noteName, activeNotes, source: 'midi' }
      setActiveMidiNote(note)
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      // Note Off
      activeNotesRef.current.delete(note)
      if (activeNotesRef.current.size === 0) {
        inputRef.current = { activeNote: null, source: null }
        setActiveMidiNote(null)
      } else {
        // 他のキーがまだ押されていたら最後に押されたキーを有効に
        const remaining = Array.from(activeNotesRef.current)
        const lastNote = remaining[remaining.length - 1]
        const activeNotes = [...new Set(remaining.map(midiNoteToName))]
        inputRef.current = { activeNote: midiNoteToName(lastNote), activeNotes, source: 'midi' }
        setActiveMidiNote(lastNote)
      }
    }
  }, [inputRef, enabled])

  const connectMidi = useCallback(async () => {
    if (!('requestMIDIAccess' in navigator)) {
      setMidiError('このブラウザはMIDIに対応していません')
      return
    }

    try {
      const access = await navigator.requestMIDIAccess()
      midiAccessRef.current = access

      const bindInputs = () => {
        let deviceName: string | null = null
        access.inputs.forEach((input) => {
          input.onmidimessage = handleMidiMessage as (e: Event) => void
          deviceName = input.name ?? 'MIDI Device'
        })

        if (deviceName) {
          setMidiConnected(true)
          setMidiDeviceName(deviceName)
          setMidiError(null)
        } else {
          setMidiConnected(false)
          setMidiDeviceName(null)
        }
      }

      bindInputs()

      // デバイスの接続/切断を監視
      access.onstatechange = () => {
        bindInputs()
      }
    } catch (err) {
      setMidiError('MIDI接続に失敗しました')
      console.error('MIDI error:', err)
    }
  }, [handleMidiMessage])

  const disconnectMidi = useCallback(() => {
    if (midiAccessRef.current) {
      midiAccessRef.current.inputs.forEach((input) => {
        input.onmidimessage = null
      })
    }
    activeNotesRef.current.clear()
    setActiveMidiNote(null)
    setMidiConnected(false)
    setMidiDeviceName(null)
  }, [])

  // 自動接続（MIDI対応ブラウザで起動時に試みる）
  useEffect(() => {
    if (midiAvailable && enabled && !midiConnected) {
      connectMidi()
    }
  }, [midiAvailable, enabled, midiConnected, connectMidi])

  // Cleanup
  useEffect(() => {
    return () => {
      disconnectMidi()
    }
  }, [disconnectMidi])

  return {
    midiAvailable,
    midiConnected,
    midiDeviceName,
    midiError,
    activeMidiNote,
    connectMidi,
    disconnectMidi,
  }
}

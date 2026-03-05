import { useEffect, useRef, useState, useCallback } from 'react'
import type { GameInput, NoteName, InstrumentType } from '../game/types'
import { createPitchDetector, stopPitchDetector } from '../audio/pitchDetector'
import type { PitchDetectorState } from '../audio/pitchDetector'

export function useAudio(
  inputRef: React.MutableRefObject<GameInput>,
  enabled: boolean,
  instrument: InstrumentType = 'piano',
) {
  const [micEnabled, setMicEnabled] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [detectedNote, setDetectedNote] = useState<NoteName | null>(null)
  const detectorRef = useRef<PitchDetectorState | null>(null)
  const instrumentRef = useRef(instrument)

  const enableMic = useCallback(async (inst?: InstrumentType) => {
    // 既存のdetectorがあれば停止
    if (detectorRef.current) {
      stopPitchDetector(detectorRef.current)
      detectorRef.current = null
    }
    try {
      const detector = await createPitchDetector((note) => {
        if (inputRef.current.source !== 'keyboard' && inputRef.current.source !== 'piano') {
          inputRef.current = { activeNote: note, source: note ? 'mic' : null }
        }
        setDetectedNote(note)
      }, inst ?? instrumentRef.current)
      detectorRef.current = detector
      setMicEnabled(true)
      setMicError(null)
    } catch (err) {
      setMicError('マイクへのアクセスが拒否されました')
      console.error('Mic error:', err)
    }
  }, [inputRef])

  const disableMic = useCallback(() => {
    if (detectorRef.current) {
      stopPitchDetector(detectorRef.current)
      detectorRef.current = null
    }
    setMicEnabled(false)
    setDetectedNote(null)
  }, [])

  // 楽器変更時にdetectorを再作成
  useEffect(() => {
    instrumentRef.current = instrument
    if (detectorRef.current) {
      enableMic(instrument)
    }
  }, [instrument, enableMic])

  // ゲーム開始時にマイクを自動ON
  useEffect(() => {
    if (enabled && !detectorRef.current) {
      enableMic()
    }
  }, [enabled, enableMic])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectorRef.current) {
        stopPitchDetector(detectorRef.current)
      }
    }
  }, [])

  return { micEnabled, micError, detectedNote, enableMic, disableMic }
}

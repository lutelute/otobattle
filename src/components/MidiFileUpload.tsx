import { useState, useRef, useCallback } from 'react'
import {
  parseMidiFile,
  getTrackInfo,
  extractNoteTimeline,
} from '../game/midiParser'
import type { MidiNoteEvent, MidiTrackInfo, ParsedMidiData } from '../game/midiParser'

/** onReady コールバックに渡すトラック情報 */
interface SelectedTrackInfo {
  name: string
  noteCount: number
  trackIndex: number
  totalTracks: number
  songDuration: number
}

interface MidiFileUploadProps {
  onReady: (timeline: MidiNoteEvent[], trackInfo: SelectedTrackInfo) => void
  onBack: () => void
}

/** MIDIファイルの受け入れ拡張子 */
const ACCEPTED_EXTENSIONS = ['.mid', '.midi']
const ACCEPTED_MIME = 'audio/midi,audio/x-midi,.mid,.midi'

/** パース結果の状態 */
interface ParsedResult {
  midiData: ParsedMidiData
  tracks: MidiTrackInfo[]
  fileName: string
}

export function MidiFileUpload({ onReady, onBack }: MidiFileUploadProps) {
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null)
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** ファイル名の拡張子を検証 */
  const isValidMidiFile = (fileName: string): boolean => {
    const lower = fileName.toLowerCase()
    return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
  }

  /** ファイルを読み込んでパースする */
  const handleFile = useCallback((file: File) => {
    setError(null)
    setParsedResult(null)

    if (!isValidMidiFile(file.name)) {
      setError('対応していないファイル形式です。.mid または .midi ファイルを選択してください。')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const midiData = parseMidiFile(arrayBuffer)
        const tracks = getTrackInfo(midiData)

        // ノートを含むトラックのみフィルタ
        const tracksWithNotes = tracks.filter((t) => t.noteCount > 0)

        if (tracksWithNotes.length === 0) {
          setError('このMIDIファイルにはノートが含まれていません。別のファイルをお試しください。')
          return
        }

        // 最もノート数の多いトラックをデフォルト選択
        let bestTrackIndex = 0
        let maxNotes = 0
        for (let i = 0; i < tracks.length; i++) {
          if (tracks[i].noteCount > maxNotes) {
            maxNotes = tracks[i].noteCount
            bestTrackIndex = i
          }
        }

        setParsedResult({
          midiData,
          tracks,
          fileName: file.name,
        })
        setSelectedTrackIndex(bestTrackIndex)
      } catch {
        setError('MIDIファイルの解析に失敗しました。ファイルが破損しているか、対応していない形式です。')
      }
    }

    reader.onerror = () => {
      setError('ファイルの読み込みに失敗しました。もう一度お試しください。')
    }

    reader.readAsArrayBuffer(file)
  }, [])

  /** ファイル入力変更ハンドラ */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  /** ドラッグ＆ドロップ ハンドラ */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  /** ドロップゾーンクリックでファイル選択を開く */
  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  /** START ボタン押下 */
  const handleStart = () => {
    if (!parsedResult) return

    const timeline = extractNoteTimeline(parsedResult.midiData, selectedTrackIndex)

    if (timeline.length === 0) {
      setError('選択されたトラックにノートが含まれていません。別のトラックを選択してください。')
      return
    }

    // 曲の推定時間を算出
    const lastNote = timeline[timeline.length - 1]
    const songDuration = lastNote.time + lastNote.duration

    const trackInfo: SelectedTrackInfo = {
      name: parsedResult.tracks[selectedTrackIndex].name,
      noteCount: timeline.length,
      trackIndex: selectedTrackIndex,
      totalTracks: parsedResult.tracks.length,
      songDuration,
    }

    onReady(timeline, trackInfo)
  }

  /** ノートを含むトラック数 */
  const tracksWithNotes = parsedResult
    ? parsedResult.tracks.filter((t) => t.noteCount > 0)
    : []

  /** 選択中のトラックからのタイムライン情報（プレビュー表示用） */
  const selectedTimeline = parsedResult
    ? extractNoteTimeline(parsedResult.midiData, selectedTrackIndex)
    : []

  /** 推定再生時間（秒）をフォーマット */
  const formatDuration = (seconds: number): string => {
    const min = Math.floor(seconds / 60)
    const sec = Math.floor(seconds % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  /** 推定再生時間 */
  const estimatedDuration =
    selectedTimeline.length > 0
      ? selectedTimeline[selectedTimeline.length - 1].time +
        selectedTimeline[selectedTimeline.length - 1].duration
      : 0

  /** 複数トラックか */
  const hasMultipleTracks = tracksWithNotes.length > 1

  return (
    <div
      className="absolute inset-0 flex flex-col items-center z-10 overflow-y-auto"
      style={{
        fontFamily: 'var(--pixel-font)',
        background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      }}
    >
      {/* Back button */}
      <div className="w-full max-w-lg px-4 pt-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: '14px' }}>{'\u2190'}</span>
          BACK
        </button>
      </div>

      {/* Title */}
      <div className="text-center mt-4 mb-6">
        <h2
          className="text-2xl tracking-wider mb-2"
          style={{
            color: '#e94560',
            textShadow: '0 0 20px rgba(233,69,96,0.4), 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          FULL SONG
        </h2>
        <p
          className="text-[10px] tracking-widest"
          style={{ color: '#94a3b8', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
        >
          MIDIファイルをアップロード
        </p>
      </div>

      {/* Drop zone */}
      <div className="px-4 w-full max-w-lg">
        <div
          onClick={handleDropZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-xl px-6 py-8 cursor-pointer transition-all"
          style={{
            background: isDragOver
              ? 'rgba(233,69,96,0.1)'
              : 'rgba(0,0,0,0.4)',
            border: isDragOver
              ? '2px dashed rgba(233,69,96,0.6)'
              : '2px dashed rgba(255,255,255,0.15)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span
            className="text-4xl mb-3"
            style={{
              filter: isDragOver ? 'none' : 'grayscale(0.3)',
            }}
          >
            {'\u{1F3B5}'}
          </span>
          <p
            className="text-xs mb-1"
            style={{ color: isDragOver ? '#e94560' : '#94a3b8' }}
          >
            {parsedResult
              ? parsedResult.fileName
              : 'ここにファイルをドロップ'}
          </p>
          <p
            className="text-[9px]"
            style={{ color: '#64748b' }}
          >
            .mid / .midi ファイル対応
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mx-4 mt-4 px-4 py-3 rounded-lg text-center max-w-lg w-full"
          style={{
            background: 'rgba(233,69,96,0.15)',
            border: '1px solid rgba(233,69,96,0.3)',
          }}
        >
          <p className="text-[10px]" style={{ color: '#e94560' }}>
            {error}
          </p>
        </div>
      )}

      {/* Parsed info panel */}
      {parsedResult && (
        <div className="px-4 mt-4 w-full max-w-lg">
          <div
            className="rounded-xl px-5 py-4"
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {/* Summary stats */}
            <div className="flex justify-around mb-4">
              <div className="text-center">
                <p className="text-lg" style={{ color: '#e94560' }}>
                  {selectedTimeline.length}
                </p>
                <p className="text-[9px]" style={{ color: '#64748b' }}>
                  ノート数
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg" style={{ color: '#e94560' }}>
                  {formatDuration(estimatedDuration)}
                </p>
                <p className="text-[9px]" style={{ color: '#64748b' }}>
                  推定時間
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg" style={{ color: '#e94560' }}>
                  {tracksWithNotes.length}
                </p>
                <p className="text-[9px]" style={{ color: '#64748b' }}>
                  トラック
                </p>
              </div>
            </div>

            {/* Track selection (only if multiple tracks with notes) */}
            {hasMultipleTracks && (
              <>
                <p
                  className="text-[10px] text-center mb-3 tracking-wide"
                  style={{ color: '#94a3b8' }}
                >
                  トラックを選択
                </p>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {parsedResult.tracks.map((track, index) => {
                    if (track.noteCount === 0) return null
                    const isSelected = index === selectedTrackIndex
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedTrackIndex(index)}
                        className="flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all"
                        style={{
                          background: isSelected
                            ? 'rgba(233,69,96,0.15)'
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${
                            isSelected
                              ? 'rgba(233,69,96,0.6)'
                              : 'rgba(255,255,255,0.08)'
                          }`,
                        }}
                      >
                        <div>
                          <p
                            className="text-xs"
                            style={{
                              color: isSelected ? '#e94560' : '#94a3b8',
                              textShadow: isSelected
                                ? '0 0 8px rgba(233,69,96,0.3)'
                                : 'none',
                            }}
                          >
                            {track.name}
                          </p>
                        </div>
                        <p
                          className="text-[10px] ml-4 shrink-0"
                          style={{ color: '#64748b' }}
                        >
                          {track.noteCount} notes
                        </p>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* START button */}
      {parsedResult && (
        <div className="mt-6 mb-8">
          <button
            onClick={handleStart}
            className="px-12 py-3.5 text-sm rounded-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #e94560 0%, #c73a52 100%)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow:
                '0 4px 15px rgba(233,69,96,0.35), 0 1px 3px rgba(0,0,0,0.3)',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            START
          </button>
        </div>
      )}
    </div>
  )
}

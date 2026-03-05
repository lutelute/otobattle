import { getBestScore } from '../utils/storage'

interface GameOverScreenProps {
  score: number
  wave: number
  onRestart: () => void
  onHome?: () => void
}

export function GameOverScreen({ score, wave, onRestart, onHome }: GameOverScreenProps) {
  const best = getBestScore()
  const isNewBest = score >= best && score > 0

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-10" style={{ fontFamily: 'var(--pixel-font)' }}>
      <h2 className="text-3xl text-red-400 mb-6">GAME OVER</h2>

      <div className="text-center mb-6 space-y-2">
        <p className="text-lg text-white">SCORE: {score.toLocaleString()}</p>
        <p className="text-sm text-yellow-400">WAVE {wave}</p>
        {isNewBest && (
          <p className="text-sm text-orange-400 animate-pulse">NEW BEST!</p>
        )}
        <p className="text-xs text-gray-400">BEST: {Math.max(best, score).toLocaleString()}</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="px-8 py-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 active:scale-95 transition-all"
        >
          RETRY
        </button>
        {onHome && (
          <button
            onClick={onHome}
            className="px-8 py-3 bg-gray-600 text-white text-sm rounded hover:bg-gray-500 active:scale-95 transition-all"
          >
            HOME
          </button>
        )}
      </div>
    </div>
  )
}

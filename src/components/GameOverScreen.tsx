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
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      style={{
        fontFamily: 'var(--pixel-font)',
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.85) 100%)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* GAME OVER title */}
      <h2
        className="text-4xl tracking-wider mb-8"
        style={{
          color: '#e94560',
          textShadow: '0 0 20px rgba(233,69,96,0.4), 0 2px 4px rgba(0,0,0,0.6)',
        }}
      >
        GAME OVER
      </h2>

      {/* Score panel */}
      <div
        className="rounded-xl px-8 py-6 mb-8 min-w-[240px]"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {/* Main score */}
        <div className="text-center mb-4">
          <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>SCORE</p>
          <p
            className="text-2xl font-bold"
            style={{
              color: '#ffffff',
              textShadow: '0 0 10px rgba(255,255,255,0.2)',
            }}
          >
            {score.toLocaleString()}
          </p>
        </div>

        {/* Wave reached */}
        <div className="text-center mb-3">
          <p
            className="text-sm font-bold"
            style={{
              color: '#fbbf24',
              textShadow: '0 0 8px rgba(251,191,36,0.3)',
            }}
          >
            WAVE {wave}
          </p>
        </div>

        {/* New best indicator */}
        {isNewBest && (
          <div className="text-center mb-3">
            <p
              className="text-sm font-bold animate-pulse"
              style={{
                color: '#f97316',
                textShadow: '0 0 12px rgba(249,115,22,0.5)',
              }}
            >
              NEW BEST!
            </p>
          </div>
        )}

        {/* Best score */}
        <div
          className="text-center pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[10px]" style={{ color: '#64748b' }}>
            BEST: <span style={{ color: '#94a3b8' }}>{Math.max(best, score).toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onRestart}
          className="px-10 py-3 text-sm rounded-lg transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #e94560 0%, #c73a52 100%)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 15px rgba(233,69,96,0.35), 0 1px 3px rgba(0,0,0,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          RETRY
        </button>
        {onHome && (
          <button
            onClick={onHome}
            className="px-10 py-3 text-sm rounded-lg transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            HOME
          </button>
        )}
      </div>
    </div>
  )
}

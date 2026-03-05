const BEST_SCORE_KEY = 'otobattle_best_score'

export function getBestScore(): number {
  const v = localStorage.getItem(BEST_SCORE_KEY)
  return v ? parseInt(v, 10) || 0 : 0
}

export function saveBestScore(score: number): void {
  const current = getBestScore()
  if (score > current) {
    localStorage.setItem(BEST_SCORE_KEY, String(score))
  }
}

import type { GameMode, DisplaySettings } from '../game/types'
import { type ProgressionData, DEFAULT_PROGRESSION } from '../game/progression'

const BEST_SCORE_KEY = 'otobattle_best_score'
const PROGRESSION_KEY = 'otobattle_progression'
const MODE_SCORES_KEY = 'otobattle_mode_scores'
const SETTINGS_KEY = 'otobattle_settings'

// ── Best score (legacy) ─────────────────────────────────────────

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

// ── Progression ─────────────────────────────────────────────────

export function saveProgression(data: ProgressionData): void {
  localStorage.setItem(PROGRESSION_KEY, JSON.stringify(data))
}

export function loadProgression(): ProgressionData {
  const raw = localStorage.getItem(PROGRESSION_KEY)
  if (!raw) return { ...DEFAULT_PROGRESSION }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.level === 'number' &&
      typeof parsed.totalXP === 'number' &&
      typeof parsed.currentLevelXP === 'number' &&
      typeof parsed.nextLevelXP === 'number'
    ) {
      return parsed as unknown as ProgressionData
    }
    return { ...DEFAULT_PROGRESSION }
  } catch {
    return { ...DEFAULT_PROGRESSION }
  }
}

// ── Per-mode best scores ────────────────────────────────────────

type ModeScores = Partial<Record<GameMode, number>>

function loadModeScoresRaw(): ModeScores {
  const raw = localStorage.getItem(MODE_SCORES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: ModeScores = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'number') {
        result[key as GameMode] = val
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveModeBestScore(mode: GameMode, score: number): void {
  const scores = loadModeScoresRaw()
  const current = scores[mode] ?? 0
  if (score > current) {
    scores[mode] = score
    localStorage.setItem(MODE_SCORES_KEY, JSON.stringify(scores))
  }
}

export function getModeBestScore(mode: GameMode): number {
  const scores = loadModeScoresRaw()
  return scores[mode] ?? 0
}

export function getAllModeBestScores(): ModeScores {
  return loadModeScoresRaw()
}

// ── Display settings ────────────────────────────────────────────

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  notationFormat: 'abc',
  theme: 'dark',
  instrument: 'piano',
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadDisplaySettings(): DisplaySettings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_DISPLAY_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.notationFormat === 'string' &&
      typeof parsed.theme === 'string' &&
      typeof parsed.instrument === 'string'
    ) {
      return parsed as unknown as DisplaySettings
    }
    return { ...DEFAULT_DISPLAY_SETTINGS }
  } catch {
    return { ...DEFAULT_DISPLAY_SETTINGS }
  }
}

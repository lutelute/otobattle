import type { GameMode } from './types'
import {
  XP_PER_KILL,
  XP_PER_WAVE,
  XP_MODE_BONUS,
  LEVEL_THRESHOLDS,
  SHARP_UNLOCK_WAVE,
  BASS_CLEF_UNLOCK_WAVE,
  ALTO_CLEF_UNLOCK_WAVE,
  SCALE_TYPE_UNLOCK,
  CHORD_TYPE_UNLOCK,
} from './constants'

/** Progression state persisted across sessions */
export interface ProgressionData {
  level: number
  totalXP: number
  currentLevelXP: number
  nextLevelXP: number
}

/** Feature unlocks at a given level */
export interface LevelUnlocks {
  sharps: boolean
  bassClef: boolean
  altoClef: boolean
  scaleTypes: string[]
  chordTypes: string[]
}

/** Default progression for new players */
export const DEFAULT_PROGRESSION: ProgressionData = {
  level: 0,
  totalXP: 0,
  currentLevelXP: 0,
  nextLevelXP: LEVEL_THRESHOLDS[1] ?? 100,
}

/**
 * Calculate XP earned from a game session.
 * score = number of kills, wave = waves completed.
 */
export function calculateXP(score: number, wave: number, mode: GameMode): number {
  const killXP = score * XP_PER_KILL
  const waveXP = wave * XP_PER_WAVE
  const bonus = XP_MODE_BONUS[mode] ?? 1.0
  return Math.floor((killXP + waveXP) * bonus)
}

/**
 * Determine the level for a given cumulative XP total.
 * Returns the highest level whose threshold has been met.
 */
export function getLevelForXP(totalXP: number): number {
  let level = 0
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      level = i
    } else {
      break
    }
  }
  return level
}

/**
 * Return which features are unlocked at a given level.
 * Maps level to equivalent wave thresholds for backward-compatible unlock logic.
 */
export function getUnlocksForLevel(level: number): LevelUnlocks {
  // Map level to equivalent wave for wave-based unlocks:
  // Level 1 ~ Wave 1, Level 2 ~ Wave 2, etc.
  const equivalentWave = level

  const scaleTypes: string[] = []
  for (const [scaleType, unlockWave] of Object.entries(SCALE_TYPE_UNLOCK)) {
    if (equivalentWave >= unlockWave) {
      scaleTypes.push(scaleType)
    }
  }

  const chordTypes: string[] = []
  for (const [chordType, unlockWave] of Object.entries(CHORD_TYPE_UNLOCK)) {
    if (equivalentWave >= unlockWave) {
      chordTypes.push(chordType)
    }
  }

  return {
    sharps: equivalentWave >= SHARP_UNLOCK_WAVE,
    bassClef: equivalentWave >= BASS_CLEF_UNLOCK_WAVE,
    altoClef: equivalentWave >= ALTO_CLEF_UNLOCK_WAVE,
    scaleTypes,
    chordTypes,
  }
}

/**
 * Add earned XP to current progression and return updated state.
 * Recalculates level, currentLevelXP, and nextLevelXP.
 */
export function addXP(current: ProgressionData, earned: number): ProgressionData {
  const totalXP = current.totalXP + earned
  const level = getLevelForXP(totalXP)

  const currentThreshold = LEVEL_THRESHOLDS[level] ?? 0
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]

  return {
    level,
    totalXP,
    currentLevelXP: totalXP - currentThreshold,
    nextLevelXP: nextThreshold - currentThreshold,
  }
}

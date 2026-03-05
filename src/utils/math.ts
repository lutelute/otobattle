import type { Vec2 } from '../game/types'

export function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomFloat(min, max + 1))
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s }
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

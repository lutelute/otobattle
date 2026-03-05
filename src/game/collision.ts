import type { Enemy, NoteName, Player, Particle, Vec2 } from './types'
import { INVINCIBLE_DURATION, DAMAGE_FLASH_DURATION, PARTICLE_COUNT_PER_KILL, PARTICLE_LIFE, COLORS } from './constants'
import { randomFloat } from '../utils/math'

export interface AttackResult {
  kills: number
  hitPositions: Vec2[]
}

export function attackWithNote(
  note: NoteName,
  enemies: Enemy[],
  particles: Particle[],
): AttackResult {
  let kills = 0
  const hitPositions: Vec2[] = []
  for (const e of enemies) {
    if (!e.alive || e.note !== note) continue
    e.alive = false
    kills++
    hitPositions.push({ x: e.pos.x, y: e.pos.y })
    // Spawn particles
    for (let i = 0; i < PARTICLE_COUNT_PER_KILL; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT_PER_KILL + randomFloat(-0.3, 0.3)
      const speed = randomFloat(80, 200)
      particles.push({
        pos: { x: e.pos.x, y: e.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: PARTICLE_LIFE,
        maxLife: PARTICLE_LIFE,
        color: COLORS.noteColors[note],
        size: randomFloat(3, 7),
      })
    }
  }
  return { kills, hitPositions }
}

export function checkEnemyPlayerCollision(
  enemies: Enemy[],
  player: Player,
  currentTime: number,
): boolean {
  if (currentTime < player.invincibleUntil) return false

  for (const e of enemies) {
    if (!e.alive) continue
    const dx = e.pos.x - player.pos.x
    const dy = e.pos.y - player.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < e.radius + 20) { // 20 = player radius
      e.alive = false
      player.hp--
      player.invincibleUntil = currentTime + INVINCIBLE_DURATION
      player.damageFlash = DAMAGE_FLASH_DURATION
      return true
    }
  }
  return false
}

export function updateParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.pos.x += p.vel.x * dt
    p.pos.y += p.vel.y * dt
    p.vel.x *= 0.95
    p.vel.y *= 0.95
    p.life -= dt
    if (p.life <= 0) {
      particles.splice(i, 1)
    }
  }
}

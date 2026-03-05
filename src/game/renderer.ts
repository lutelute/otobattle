import type { GameState, Enemy, DisplaySettings } from './types'
import { NOTES, getStaffPlacement } from './notes'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, PLAYER_RADIUS, WAVE_ANNOUNCE_DURATION } from './constants'
import { drawSharp, drawNoteHead, drawStem, drawLedgerLine, drawTrebleClef, drawBassClef } from './musicGlyphs'

// テーマカラー
function themeColors(theme: DisplaySettings['theme']) {
  if (theme === 'light') {
    return {
      bg: '#f0f0f0',
      grid: '#00000008',
      player: '#e94560',
      playerInv: '#e9456080',
      panelBg: '#ffffffee',
      panelBorder: '#00000020',
      staffLine: '#00000050',
      noteColor: '#000000',
      clefColor: '#000000c0',
      labelColor: '#555',
      waveText: '#d97706',
      damageFlash: '#ff000030',
      attackWave: '#000000',
    }
  }
  return {
    bg: '#1a1a2e',
    grid: '#ffffff08',
    player: '#e94560',
    playerInv: '#e9456080',
    panelBg: '#ffffffee',
    panelBorder: '#00000015',
    staffLine: '#00000050',
    noteColor: '#000000',
    clefColor: '#000000c0',
    labelColor: '#444',
    waveText: '#fbbf24',
    damageFlash: '#ff000030',
    attackWave: '#ffffff',
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
) {
  const scaleX = canvasWidth / CANVAS_BASE_WIDTH
  const scaleY = canvasHeight / CANVAS_BASE_HEIGHT
  const scale = Math.min(scaleX, scaleY)
  const c = themeColors(state.settings.theme)

  ctx.save()
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const offsetX = (canvasWidth - CANVAS_BASE_WIDTH * scale) / 2
  const offsetY = (canvasHeight - CANVAS_BASE_HEIGHT * scale) / 2
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, scale)

  // 背景
  ctx.fillStyle = c.bg
  ctx.fillRect(0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT)
  ctx.strokeStyle = c.grid
  ctx.lineWidth = 1
  for (let x = 0; x < CANVAS_BASE_WIDTH; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_BASE_HEIGHT); ctx.stroke()
  }
  for (let y = 0; y < CANVAS_BASE_HEIGHT; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_BASE_WIDTH, y); ctx.stroke()
  }

  drawParticles(ctx, state)

  for (const enemy of state.enemies) {
    drawEnemy(ctx, enemy, state, c)
  }

  drawPlayer(ctx, state, c)

  if (state.lastNoteAttack && state.noteAttackTimer > 0) {
    const progress = 1 - state.noteAttackTimer / 0.5
    const r = progress * 200
    ctx.save()
    ctx.globalAlpha = (1 - progress) * 0.3
    ctx.strokeStyle = c.attackWave
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(state.player.pos.x, state.player.pos.y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (state.phase === 'waveAnnounce') {
    const progress = 1 - state.waveAnnounceTimer / WAVE_ANNOUNCE_DURATION
    const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2
    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.fillStyle = c.waveText
    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`WAVE ${state.wave}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 60)
    ctx.restore()
  }

  if (state.player.damageFlash > 0) {
    ctx.fillStyle = c.damageFlash
    ctx.fillRect(0, 0, CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT)
  }

  ctx.restore()
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  const { player } = state
  const inv = state.time < player.invincibleUntil
  ctx.save()
  ctx.translate(player.pos.x, player.pos.y)
  if (inv) ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(state.time * 10))
  ctx.fillStyle = inv ? c.playerInv : c.player
  ctx.beginPath()
  const r = PLAYER_RADIUS
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 8
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff40'
  ctx.fillRect(-6, -6, 4, 4)
  ctx.fillRect(2, -6, 4, 4)
  ctx.fillRect(-4, 2, 8, 4)
  ctx.restore()
}

/**
 * 敵の描画: 白パネル + 五線譜 + 記号 + 音符
 * 五線譜パネルを縦に大きく表示
 */
function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  const noteInfo = NOTES[enemy.note]
  const placement = getStaffPlacement(enemy.note, enemy.clef)
  const { pos, radius } = enemy
  const isBass = enemy.clef === 'bass'

  ctx.save()
  ctx.translate(pos.x, pos.y)

  const phase = (enemy.id * 1.37) % (Math.PI * 2)
  ctx.translate(0, Math.sin(state.time * 3 + phase) * 1.5)

  if (enemy.hitFlash > 0) ctx.globalAlpha = 0.5

  // ── 五線譜パネル（縦に大きく）──
  const lineGap = 12                         // 線間隔（さらに拡大）
  const staffH = lineGap * 4                 // 五線の総高さ = 48px
  const staffW = radius * 2 + 40            // パネル幅
  const padTop = 22                          // 上余白（加線やステム用）
  const padBot = 22                          // 下余白（加線やラベル用）
  const panelH = staffH + padTop + padBot    // 合計 92px
  const panelTop = -panelH / 2               // 敵の中心を基準にパネルを配置

  // パネル背景
  ctx.fillStyle = c.panelBg
  ctx.strokeStyle = c.panelBorder
  ctx.lineWidth = 1
  roundRect(ctx, -staffW / 2, panelTop, staffW, panelH, 6)
  ctx.fill()
  ctx.stroke()

  const staffTop = panelTop + padTop
  const staffBottom = staffTop + staffH

  // 五線
  ctx.strokeStyle = c.staffLine
  ctx.lineWidth = 1.0
  for (let i = 0; i < 5; i++) {
    const ly = staffTop + i * lineGap
    ctx.beginPath()
    ctx.moveTo(-staffW / 2 + 5, ly)
    ctx.lineTo(staffW / 2 - 5, ly)
    ctx.stroke()
  }

  // ── 記号（ト音記号 / ヘ音記号）── パス描画（フォント不要）
  const clefX = -staffW / 2 + 16

  if (isBass) {
    const f3LineY = staffTop + 1 * lineGap
    drawBassClef(ctx, clefX, f3LineY, staffH, c.clefColor)
  } else {
    const g4LineY = staffTop + 3 * lineGap
    drawTrebleClef(ctx, clefX, g4LineY, staffH, c.clefColor)
  }

  // ── 音符 ──
  const noteX = 10
  const halfGap = lineGap / 2
  const noteY = staffBottom - placement.steps * halfGap

  // 加線
  if (placement.needsLedger) {
    if (isBass) {
      // ヘ音記号: B3は第5線の上 → 加線は staffTop - lineGap
      drawLedgerLine(ctx, noteX, staffTop - lineGap, 22, c.staffLine)
    } else {
      // ト音記号: C4は第1線の下 → 加線は staffBottom + lineGap
      drawLedgerLine(ctx, noteX, staffBottom + lineGap, 22, c.staffLine)
    }
  }

  // シャープ記号
  if (noteInfo.isSharp) {
    drawSharp(ctx, noteX - 14, noteY, 10, c.noteColor + 'cc')
  }

  // 音符ヘッド
  const noteSize = halfGap + 2
  drawNoteHead(ctx, noteX, noteY, noteSize, c.noteColor)

  // ステム（符幹）
  const stemUp = placement.steps < 4
  drawStem(ctx, noteX, noteY, noteSize, stemUp, c.noteColor)

  // ── カタカナラベル ──
  if (state.settings.showSolfege) {
    ctx.fillStyle = c.labelColor
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(noteInfo.solfege, 0, panelTop + panelH + 4)
  }

  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    const s = p.size * alpha
    ctx.fillRect(p.pos.x - s / 2, p.pos.y - s / 2, s, s)
  }
  ctx.globalAlpha = 1
}

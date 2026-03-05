import type { GameState, Enemy, DisplaySettings } from './types'
import { NOTES, getStaffPlacement } from './notes'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, PLAYER_RADIUS, WAVE_ANNOUNCE_DURATION, COLORS, BEAM_ZIGZAG_AMPLITUDE, BEAM_ZIGZAG_SEGMENTS, BEAM_LIGHTNING_SEGMENTS } from './constants'
import { drawSharp, drawNoteHead, drawStem, drawLedgerLine, drawTrebleClef, drawBassClef, drawAltoClef } from './musicGlyphs'

let smuflReady = false
export function setSmuflReady(ready: boolean) { smuflReady = ready }

// SMuFL codepoints
const SMUFL_TREBLE_CLEF = '\uE050'
const SMUFL_BASS_CLEF = '\uE062'
const SMUFL_ALTO_CLEF = '\uE05C'

// テーマカラー
function themeColors(theme: DisplaySettings['theme']) {
  if (theme === 'light') {
    return {
      bgTop: '#e8e8f0',
      bgBottom: '#f5f5f5',
      grid: '#00000010',
      player: '#e94560',
      playerInv: '#e9456080',
      panelBg: '#ffffffee',
      panelBorder: '#00000028',
      panelShadow: '#00000015',
      staffLine: '#00000050',
      noteColor: '#000000',
      clefColor: '#000000c0',
      labelColor: '#555',
      waveText: '#d97706',
      damageFlash: '#ff000030',
      attackWave: '#000000',
      beamCore: '#333333',
    }
  }
  return {
    bgTop: '#0f0f23',
    bgBottom: '#1a1a2e',
    grid: '#ffffff14',
    player: '#e94560',
    playerInv: '#e9456080',
    panelBg: '#f8fafcf0',
    panelBorder: '#00000030',
    panelShadow: '#00000050',
    staffLine: '#00000058',
    noteColor: '#000000',
    clefColor: '#000000c0',
    labelColor: '#94a3b8',
    waveText: '#fbbf24',
    damageFlash: '#ff000030',
    attackWave: '#ffffff',
    beamCore: '#ffffff',
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

  // 背景（グラデーション）
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_BASE_HEIGHT)
  bgGrad.addColorStop(0, c.bgTop)
  bgGrad.addColorStop(1, c.bgBottom)
  ctx.fillStyle = bgGrad
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

  // ビーム描画
  for (const beam of state.beams) {
    drawBeam(ctx, beam, c.beamCore)
  }

  drawPlayer(ctx, state, c)

  if (state.lastNoteAttack && state.noteAttackTimer > 0) {
    const progress = 1 - state.noteAttackTimer / 0.5
    const r = progress * 200
    const waveColor = COLORS.noteColors[state.lastNoteAttack] ?? c.attackWave
    ctx.save()
    ctx.globalAlpha = (1 - progress) * 0.3
    ctx.strokeStyle = waveColor
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

  // パネル背景（影付き）
  ctx.save()
  ctx.shadowColor = c.panelShadow
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = c.panelBg
  roundRect(ctx, -staffW / 2, panelTop, staffW, panelH, 6)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = c.panelBorder
  ctx.lineWidth = 1
  roundRect(ctx, -staffW / 2, panelTop, staffW, panelH, 6)
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

  // ── 記号（ト音記号 / ヘ音記号 / ハ音記号）──
  const clefX = -staffW / 2 + 16

  if (smuflReady) {
    // Bravura SMuFLフォント（正確な音楽記号）
    ctx.fillStyle = c.clefColor
    ctx.textAlign = 'center'
    ctx.font = `${lineGap * 4}px Bravura`
    ctx.textBaseline = 'alphabetic'

    if (enemy.clef === 'bass') {
      const f3LineY = staffTop + 1 * lineGap
      ctx.fillText(SMUFL_BASS_CLEF, clefX, f3LineY)
    } else if (enemy.clef === 'alto') {
      const c4LineY = staffTop + 2 * lineGap
      ctx.fillText(SMUFL_ALTO_CLEF, clefX, c4LineY)
    } else {
      const g4LineY = staffTop + 3 * lineGap
      ctx.fillText(SMUFL_TREBLE_CLEF, clefX, g4LineY)
    }
  } else {
    // フォールバック: Canvas パス描画
    if (enemy.clef === 'bass') {
      const f3LineY = staffTop + 1 * lineGap
      drawBassClef(ctx, clefX, f3LineY, staffH, c.clefColor)
    } else if (enemy.clef === 'alto') {
      const c4LineY = staffTop + 2 * lineGap
      drawAltoClef(ctx, clefX, c4LineY, staffH, c.clefColor)
    } else {
      const g4LineY = staffTop + 3 * lineGap
      drawTrebleClef(ctx, clefX, g4LineY, staffH, c.clefColor)
    }
  }

  // ── 音符 ──
  const noteX = 10
  const halfGap = lineGap / 2
  const noteY = staffBottom - placement.steps * halfGap

  // 加線
  if (placement.needsLedger) {
    if (enemy.clef === 'bass') {
      // ヘ音記号: B3は第5線の上 → 加線は staffTop - lineGap
      drawLedgerLine(ctx, noteX, staffTop - lineGap, 22, c.staffLine)
    } else if (enemy.clef === 'alto') {
      // ハ音記号: A4/B4は第5線の上 → 加線は staffTop - lineGap
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

  // ── 音名ラベル ──
  if (state.settings.notationFormat === 'solfege') {
    ctx.fillStyle = c.labelColor
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(noteInfo.solfege, 0, panelTop + panelH + 4)
  } else if (state.settings.notationFormat === 'abc') {
    ctx.fillStyle = c.labelColor
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(noteInfo.name, 0, panelTop + panelH + 4)
  }
  // 'staff' format: no text label

  // ── インベーダーアイコン（パネル上部に表示） ──
  if (enemy.enemyType === 'invader') {
    drawInvaderIcon(ctx, 0, panelTop - 12, noteInfo.color)
  }

  ctx.restore()
}

/**
 * ビームパスのポイント列を生成する
 * straight: 始点→終点の直線
 * zigzag: 交互に垂直方向へオフセットするセグメント
 * lightning: より少ないセグメントで大きなランダムオフセット
 */
function generateBeamPath(beam: import('./types').Beam): { x: number; y: number }[] {
  const style = beam.style ?? 'straight'

  if (style === 'straight') {
    return [beam.from, beam.to]
  }

  const dx = beam.to.x - beam.from.x
  const dy = beam.to.y - beam.from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return [beam.from, beam.to]

  // 垂直方向の単位ベクトル
  const perpX = -dy / len
  const perpY = dx / len

  const segments = style === 'zigzag' ? BEAM_ZIGZAG_SEGMENTS : BEAM_LIGHTNING_SEGMENTS
  const amplitude = style === 'zigzag' ? BEAM_ZIGZAG_AMPLITUDE : BEAM_ZIGZAG_AMPLITUDE * 2.5

  const points: { x: number; y: number }[] = [{ x: beam.from.x, y: beam.from.y }]

  // ビーム位置ベースのシード値（同じビームは同じパスを描く）
  const seed = Math.abs(beam.from.x * 73 + beam.from.y * 137 + beam.to.x * 59 + beam.to.y * 97)

  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const baseX = beam.from.x + dx * t
    const baseY = beam.from.y + dy * t

    let offset: number
    if (style === 'zigzag') {
      // 均一な交互オフセット
      offset = (i % 2 === 0 ? 1 : -1) * amplitude
    } else {
      // lightning: 疑似ランダムオフセット（大きめ）
      const pseudoRandom = Math.sin(seed + i * 12.9898) * 43758.5453
      offset = (pseudoRandom - Math.floor(pseudoRandom) - 0.5) * 2 * amplitude
    }

    points.push({
      x: baseX + perpX * offset,
      y: baseY + perpY * offset,
    })
  }

  points.push({ x: beam.to.x, y: beam.to.y })
  return points
}

/** ポイント列を結ぶパスをストロークする */
function strokeBeamPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  if (points.length === 0) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
}

function drawBeam(ctx: CanvasRenderingContext2D, beam: import('./types').Beam, coreColor: string) {
  const alpha = beam.life / beam.maxLife
  const points = generateBeamPath(beam)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 太いグロー
  ctx.globalAlpha = alpha * 0.3
  ctx.strokeStyle = beam.color
  ctx.lineWidth = 8
  strokeBeamPath(ctx, points)

  // 細いコア（テーマ対応）
  ctx.globalAlpha = alpha * 0.9
  ctx.strokeStyle = coreColor
  ctx.lineWidth = 2
  strokeBeamPath(ctx, points)

  // 中間色
  ctx.globalAlpha = alpha * 0.7
  ctx.strokeStyle = beam.color
  ctx.lineWidth = 4
  strokeBeamPath(ctx, points)

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

/** Canvasパスで描くインベーダーシルエット（11x8 ドット, 3px/dot = 33x24px） */
function drawInvaderIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  const pattern = [
    [0,0,1,0,0,0,0,0,1,0,0],
    [0,0,0,1,0,0,0,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0],
    [0,1,1,0,1,1,1,0,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1],
    [1,0,1,1,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,1],
    [0,0,0,1,1,0,1,1,0,0,0],
  ]
  const px = 3
  const cols = pattern[0].length
  const rows = pattern.length
  const w = cols * px
  const h = rows * px
  ctx.fillStyle = color
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (pattern[r][col]) {
        ctx.fillRect(cx - w / 2 + col * px, cy - h / 2 + r * px, px, px)
      }
    }
  }
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

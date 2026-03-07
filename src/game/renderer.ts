import type { GameState, Enemy, DisplaySettings } from './types'
import type { ScalesState, ChordsState, PerfectPitchState, FullSongState } from './modes/types'
import { NOTES, getStaffPlacement } from './notes'
import { CANVAS_BASE_WIDTH, CANVAS_BASE_HEIGHT, PLAYER_RADIUS, WAVE_ANNOUNCE_DURATION, COLORS, BEAM_ZIGZAG_AMPLITUDE, BEAM_ZIGZAG_SEGMENTS, BEAM_LIGHTNING_SEGMENTS, PERFECT_PITCH_TIMEOUT, PERFECT_PITCH_REPLAY_LIMIT } from './constants'
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

  // Perfect Pitch mode: draw ear training UI instead of enemies/player
  if (state.mode === 'perfectPitch' && state.modeState) {
    drawPerfectPitchUI(ctx, state, c)
  } else {
    for (const enemy of state.enemies) {
      drawEnemy(ctx, enemy, state, c)
    }

    // Chords mode: draw chord group connections and labels
    if (state.mode === 'chords') {
      drawChordGroups(ctx, state, c)
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

    if (state.mode === 'scales' && state.modeState) {
      const sd = state.modeState.data as unknown as ScalesState
      const scaleName = formatScaleName(sd.scaleKey, sd.currentScale)
      ctx.fillText(`WAVE ${state.wave}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 80)
      ctx.font = 'bold 24px monospace'
      ctx.fillText(scaleName, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 40)
    } else if (state.mode === 'chords' && state.modeState) {
      const cd = state.modeState.data as unknown as ChordsState
      ctx.fillText(`WAVE ${state.wave}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 80)
      ctx.font = 'bold 24px monospace'
      ctx.fillText(`Chord: ${cd.currentChord}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 40)
    } else if (state.mode === 'perfectPitch') {
      ctx.fillText(`WAVE ${state.wave}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 80)
      ctx.font = 'bold 24px monospace'
      const ppd = state.modeState?.data as unknown as PerfectPitchState & { allowedNotes?: string[] }
      const noteCount = ppd?.allowedNotes?.length ?? (state.wave + 2)
      ctx.fillText(`${noteCount} Notes`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 40)
    } else {
      ctx.fillText(`WAVE ${state.wave}`, CANVAS_BASE_WIDTH / 2, CANVAS_BASE_HEIGHT / 2 - 60)
    }

    ctx.restore()
  }

  // Scales mode: draw scale info overlay above play area
  if (state.mode === 'scales' && state.modeState && state.phase === 'playing') {
    drawScalesInfo(ctx, state, c)
  }

  // Chords mode: draw chord info overlay above play area
  if (state.mode === 'chords' && state.modeState && state.phase === 'playing') {
    drawChordsInfo(ctx, state, c)
  }

  // Full Song mode: draw song progress bar at top of canvas
  if (state.mode === 'fullSong' && state.modeState && state.phase === 'playing') {
    drawSongProgressBar(ctx, state, c)
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

/** Format scale type name with title case (e.g. 'major' → 'Major') */
function formatScaleName(key: string, scaleType: string): string {
  const typeLabel = scaleType
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return `${key} ${typeLabel}`
}

/**
 * Draw scales mode info overlay: scale name, degree progress, direction arrow.
 * Rendered at the top-center of the canvas during 'playing' phase.
 */
function drawScalesInfo(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  const sd = state.modeState!.data as unknown as ScalesState
  const scaleName = formatScaleName(sd.scaleKey, sd.currentScale)
  const totalNotes = sd.scaleNotes.length
  const currentDegree = sd.direction === 'ascending'
    ? sd.currentDegree + 1
    : totalNotes + sd.currentDegree + 1
  const totalSteps = totalNotes + (totalNotes - 1) // ascending + descending
  const directionArrow = sd.direction === 'ascending' ? '\u2191' : '\u2193' // ↑ or ↓

  const cx = CANVAS_BASE_WIDTH / 2
  const y = 28

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Scale name (e.g. "C Major")
  ctx.fillStyle = c.waveText
  ctx.font = 'bold 16px monospace'
  ctx.fillText(scaleName, cx, y)

  // Degree progress and direction (e.g. "3/13 ↑")
  ctx.fillStyle = c.labelColor
  ctx.font = '13px monospace'
  ctx.fillText(`${currentDegree}/${totalSteps} ${directionArrow}`, cx, y + 18)

  ctx.restore()
}

/**
 * Draw chord group connections and labels.
 * Groups enemies that share a chordGroupId with subtle connecting lines
 * and renders the chord name centered above the group.
 */
function drawChordGroups(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  if (!state.modeState) return
  const cd = state.modeState.data as unknown as ChordsState

  // Collect alive enemies by chordGroupId
  const groups = new Map<string, typeof state.enemies>()
  for (const enemy of state.enemies) {
    if (!enemy.alive || !enemy.chordGroupId) continue
    const arr = groups.get(enemy.chordGroupId)
    if (arr) {
      arr.push(enemy)
    } else {
      groups.set(enemy.chordGroupId, [enemy])
    }
  }

  for (const [, enemies] of groups) {
    if (enemies.length < 2) {
      // Single enemy in group — still draw chord label above it
      const e = enemies[0]
      ctx.save()
      ctx.globalAlpha = 0.9
      ctx.fillStyle = c.waveText
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(cd.currentChord, e.pos.x, e.pos.y - e.radius - 52)
      ctx.restore()
      continue
    }

    // Draw subtle connecting lines between group members
    ctx.save()
    ctx.globalAlpha = 0.25
    ctx.strokeStyle = c.waveText
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    // Sort by x position for a clean connection path
    const sorted = [...enemies].sort((a, b) => a.pos.x - b.pos.x)
    ctx.moveTo(sorted[0].pos.x, sorted[0].pos.y)
    for (let i = 1; i < sorted.length; i++) {
      ctx.lineTo(sorted[i].pos.x, sorted[i].pos.y)
    }
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Calculate centroid of group for label placement
    let cx = 0
    let cy = 0
    let minY = Infinity
    for (const e of enemies) {
      cx += e.pos.x
      cy += e.pos.y
      if (e.pos.y - e.radius < minY) minY = e.pos.y - e.radius
    }
    cx /= enemies.length
    // Place label above the topmost enemy in the group
    const labelY = minY - 56

    // Draw chord name label
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = c.waveText
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(cd.currentChord, cx, labelY)
    ctx.restore()
  }
}

/**
 * Draw chords mode info overlay: chord name, matched notes progress.
 * Rendered at the top-center of the canvas during 'playing' phase.
 */
function drawChordsInfo(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  const cd = state.modeState!.data as unknown as ChordsState

  const cx = CANVAS_BASE_WIDTH / 2
  const y = 28

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Chord name (e.g. "Cmaj7")
  ctx.fillStyle = c.waveText
  ctx.font = 'bold 16px monospace'
  ctx.fillText(cd.currentChord, cx, y)

  // Matched notes progress (e.g. "2/4 notes")
  const matched = cd.matchedNotes.length
  const total = cd.activeChordNotes.length
  ctx.fillStyle = c.labelColor
  ctx.font = '13px monospace'
  ctx.fillText(`${matched}/${total} notes`, cx, y + 18)

  ctx.restore()
}

// ─── Full Song Mode Rendering ─────────────────────────────────────────

/**
 * Draw a thin horizontal progress bar at the top of the canvas showing
 * elapsed / total song duration, plus song name and notes remaining.
 */
function drawSongProgressBar(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  if (!state.modeState) return
  const fsd = state.modeState.data as unknown as FullSongState & {
    totalNotes: number
    notesHit: number
    songComplete: boolean
  }

  const barMargin = 60
  const barW = CANVAS_BASE_WIDTH - barMargin * 2
  const barH = 4
  const barX = barMargin
  const barY = 8

  const progress = Math.min(1.0, fsd.songDuration > 0 ? fsd.songProgress / fsd.songDuration : 0)

  // Bar background
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.fillStyle = c.staffLine
  roundRect(ctx, barX, barY, barW, barH, 2)
  ctx.fill()
  ctx.restore()

  // Bar fill with gradient
  if (progress > 0) {
    ctx.save()
    ctx.globalAlpha = 0.9
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0)
    fillGrad.addColorStop(0, '#e94560')
    fillGrad.addColorStop(1, '#f97316')
    ctx.fillStyle = fillGrad
    const fillW = Math.max(4, barW * progress) // min width for visibility
    roundRect(ctx, barX, barY, fillW, barH, 2)
    ctx.fill()
    ctx.restore()
  }

  // Song name (left-aligned below bar)
  ctx.save()
  ctx.globalAlpha = 0.7
  ctx.fillStyle = c.labelColor
  ctx.font = '10px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(fsd.songName, barX, barY + barH + 4)

  // Time display (right-aligned below bar)
  const elapsed = Math.max(0, fsd.songProgress)
  const total = fsd.songDuration
  const formatTime = (s: number) => {
    const min = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }
  ctx.textAlign = 'right'
  ctx.fillText(
    `${formatTime(elapsed)} / ${formatTime(total)}`,
    barX + barW,
    barY + barH + 4,
  )

  // Notes hit / total (centered below bar)
  const notesRemaining = fsd.totalNotes - fsd.currentNoteIndex
  ctx.textAlign = 'center'
  ctx.fillText(
    `${fsd.notesHit}/${fsd.totalNotes} hit \u2022 ${notesRemaining} left`,
    CANVAS_BASE_WIDTH / 2,
    barY + barH + 4,
  )

  ctx.restore()
}

// ─── Perfect Pitch Mode Rendering ────────────────────────────────────

/**
 * Internal extended state type for rendering.
 * Mirrors the PerfectPitchData from perfectPitch.ts mode logic.
 */
interface PerfectPitchRenderData extends PerfectPitchState {
  challengesCompleted: number
  challengesPerWave: number
  challengesInWave: number
  allowedNotes: string[]
  challengePhase: 'playing' | 'waiting' | 'feedback'
  feedbackTimer: number
  lastAnswerCorrect: boolean
  bestStreak: number
}

/**
 * Draw the entire Perfect Pitch ear training UI.
 * Replaces normal enemy/player rendering with a centered challenge panel.
 */
function drawPerfectPitchUI(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  c: ReturnType<typeof themeColors>,
) {
  if (!state.modeState) return
  const ppd = state.modeState.data as unknown as PerfectPitchRenderData

  const cx = CANVAS_BASE_WIDTH / 2
  const cy = CANVAS_BASE_HEIGHT / 2

  // ── Central challenge panel ──────────────────────────────────────
  const panelW = 280
  const panelH = 220
  const panelX = cx - panelW / 2
  const panelY = cy - panelH / 2 - 20

  // Panel background with shadow
  ctx.save()
  ctx.shadowColor = c.panelShadow
  ctx.shadowBlur = 16
  ctx.shadowOffsetY = 4
  ctx.fillStyle = c.panelBg
  roundRect(ctx, panelX, panelY, panelW, panelH, 12)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = c.panelBorder
  ctx.lineWidth = 1.5
  roundRect(ctx, panelX, panelY, panelW, panelH, 12)
  ctx.stroke()

  // ── Ear icon (pulsing when in 'waiting' phase) ─────────────────
  const earY = panelY + 60
  const pulse = ppd.challengePhase === 'waiting'
    ? 1 + 0.08 * Math.sin(state.time * 4)
    : 1

  ctx.save()
  ctx.translate(cx, earY)
  ctx.scale(pulse, pulse)

  // Draw ear icon using simple shapes
  drawEarIcon(ctx, 0, 0, 32, c)

  ctx.restore()

  // ── Challenge phase label ──────────────────────────────────────
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (ppd.challengePhase === 'playing') {
    // "Playing..." label
    ctx.fillStyle = c.waveText
    ctx.font = 'bold 18px monospace'
    ctx.fillText('Listen...', cx, panelY + 110)
  } else if (ppd.challengePhase === 'waiting') {
    // "?" prompt
    ctx.fillStyle = c.noteColor
    ctx.font = 'bold 40px monospace'
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(state.time * 2))
    ctx.fillText('?', cx, panelY + 110)
    ctx.globalAlpha = 1

    // "What note?" subtitle
    ctx.fillStyle = c.labelColor
    ctx.font = '13px monospace'
    ctx.fillText('What note was that?', cx, panelY + 140)

    // Timeout bar
    const barW = panelW - 40
    const barH = 6
    const barX = panelX + 20
    const barY = panelY + panelH - 30
    const timeProgress = Math.max(0, ppd.timeRemaining / PERFECT_PITCH_TIMEOUT)

    // Bar background
    ctx.fillStyle = c.staffLine
    roundRect(ctx, barX, barY, barW, barH, 3)
    ctx.fill()

    // Bar fill (changes color as time runs out)
    const barColor = timeProgress > 0.5 ? '#22c55e'
      : timeProgress > 0.25 ? '#eab308'
      : '#ef4444'
    ctx.fillStyle = barColor
    roundRect(ctx, barX, barY, barW * timeProgress, barH, 3)
    ctx.fill()

    // Replay indicator
    const replayY = panelY + panelH - 50
    ctx.fillStyle = c.labelColor
    ctx.font = '11px monospace'
    const replayDots = Array.from({ length: PERFECT_PITCH_REPLAY_LIMIT }, (_, i) =>
      i < ppd.replaysRemaining ? '\u25CF' : '\u25CB',
    ).join(' ')
    ctx.fillText(`Replay: ${replayDots}`, cx, replayY)
  } else if (ppd.challengePhase === 'feedback') {
    // Show result
    if (ppd.lastAnswerCorrect) {
      // Correct feedback
      ctx.fillStyle = '#22c55e'
      ctx.font = 'bold 28px monospace'
      ctx.fillText('\u2713 Correct!', cx, panelY + 105)

      // Show the note name
      const noteInfo = NOTES[ppd.targetNote]
      const noteColor = COLORS.noteColors[ppd.targetNote] ?? '#ffffff'
      ctx.fillStyle = noteColor
      ctx.font = 'bold 20px monospace'
      ctx.fillText(noteInfo.name, cx, panelY + 140)

      // Streak indicator
      if (ppd.streak >= 2) {
        ctx.fillStyle = c.waveText
        ctx.font = 'bold 14px monospace'
        ctx.fillText(`${ppd.streak} streak!`, cx, panelY + 165)
      }
    } else {
      // Wrong/timeout feedback
      ctx.fillStyle = '#ef4444'
      ctx.font = 'bold 28px monospace'
      ctx.fillText('\u2717 Wrong', cx, panelY + 105)

      // Show the correct note
      const noteInfo = NOTES[ppd.targetNote]
      const noteColor = COLORS.noteColors[ppd.targetNote] ?? '#ffffff'
      ctx.fillStyle = c.labelColor
      ctx.font = '14px monospace'
      ctx.fillText('Answer:', cx, panelY + 135)
      ctx.fillStyle = noteColor
      ctx.font = 'bold 20px monospace'
      ctx.fillText(noteInfo.name, cx, panelY + 160)
    }
  }

  ctx.restore()

  // ── Challenge progress below panel ─────────────────────────────
  const progressY = panelY + panelH + 20
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = c.labelColor
  ctx.font = '12px monospace'
  ctx.fillText(
    `Challenge ${ppd.challengesInWave}/${ppd.challengesPerWave}`,
    cx,
    progressY,
  )
  ctx.restore()
}

/**
 * Draw a stylized ear icon using Canvas paths.
 * Centered at (cx, cy) with the given size.
 */
function drawEarIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  c: ReturnType<typeof themeColors>,
) {
  const s = size / 32 // normalize to base size of 32

  ctx.save()
  ctx.translate(cx, cy)

  // Outer ear shape
  ctx.strokeStyle = c.noteColor
  ctx.lineWidth = 2.5 * s
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  // Main ear curve (simplified)
  ctx.moveTo(-4 * s, 18 * s)
  ctx.quadraticCurveTo(-14 * s, 10 * s, -14 * s, -2 * s)
  ctx.quadraticCurveTo(-14 * s, -18 * s, 0 * s, -22 * s)
  ctx.quadraticCurveTo(14 * s, -22 * s, 16 * s, -8 * s)
  ctx.quadraticCurveTo(16 * s, 0 * s, 10 * s, 6 * s)
  ctx.quadraticCurveTo(4 * s, 12 * s, 4 * s, 16 * s)
  ctx.quadraticCurveTo(4 * s, 22 * s, -2 * s, 24 * s)
  ctx.stroke()

  // Inner ear detail
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.moveTo(6 * s, -4 * s)
  ctx.quadraticCurveTo(6 * s, -12 * s, 0 * s, -14 * s)
  ctx.quadraticCurveTo(-8 * s, -14 * s, -8 * s, -4 * s)
  ctx.quadraticCurveTo(-8 * s, 4 * s, -2 * s, 8 * s)
  ctx.stroke()

  // Sound wave arcs (right side of ear)
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1.5 * s
  for (let i = 0; i < 3; i++) {
    const r = (8 + i * 6) * s
    const startAngle = -Math.PI / 4
    const endAngle = Math.PI / 4
    ctx.beginPath()
    ctx.arc(18 * s, cy * 0, r, startAngle, endAngle)
    ctx.stroke()
  }

  ctx.restore()
}

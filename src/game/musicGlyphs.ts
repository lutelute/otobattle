/**
 * 音楽記号のCanvas描画関数
 * Unicode/フォントに依存しない、パスベースの描画
 */

/**
 * ト音記号（Treble Clef / G Clef）
 * 正確な形状: 下の小さなループ → 五線を横切る大きなS字 → 上でカーブして戻る → 縦棒
 *
 * @param x 中心X
 * @param y 第2線(G4線)のY座標
 * @param h 五線の総高さ (lineGap * 4) を渡す → これに合わせてスケーリング
 */
export function drawTrebleClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)
  // 基準: h = 五線の高さ(lineGap*4)。ト音記号は五線の上下にはみ出す
  const s = h / 20 // 正規化スケール

  ctx.strokeStyle = color
  ctx.lineWidth = s * 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()

  // ── 下端の丸い部分（第1線の下のカール）──
  // G線(y=0)基準で、第1線は y = +lineGap*2 = +h/2
  // 下端は五線の少し下
  ctx.moveTo(s * 1, s * 14)   // 下端スタート
  ctx.bezierCurveTo(
    s * -4, s * 13,   // 左にカール
    s * -4, s * 8,
    s * 0, s * 6,     // 第1線あたりに戻る
  )

  // ── 大きなS字（右上へ膨らむ）──
  ctx.bezierCurveTo(
    s * 6, s * 2,     // 右へ大きく膨らむ
    s * 7, s * -4,
    s * 4, s * -8,    // 上部へ
  )
  ctx.bezierCurveTo(
    s * 1, s * -12,
    s * -5, s * -8,
    s * -4, s * -3,   // 左上からカーブして戻る
  )

  // ── 左下へ小さくカーブ（内側のループ）──
  ctx.bezierCurveTo(
    s * -3, s * 0,
    s * -1, s * 3,
    s * 1, s * 4,     // G線の少し下
  )

  ctx.stroke()

  // ── 縦の直線部分 ──
  ctx.beginPath()
  ctx.moveTo(s * 1, s * 4)
  ctx.lineTo(s * 1, s * -15)  // 五線の上まで伸びる
  ctx.stroke()

  // ── 上端の小さなカーブ ──
  ctx.beginPath()
  ctx.moveTo(s * 1, s * -15)
  ctx.bezierCurveTo(
    s * 3, s * -17,
    s * 4, s * -14,
    s * 2, s * -12,
  )
  ctx.stroke()

  // ── 下端の丸い点 ──
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(s * 1, s * 14, s * 1.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * ヘ音記号（Bass Clef / F Clef）
 * F線を基準にして描画。2つのドット + カーブ
 *
 * @param x 中心X
 * @param y 第4線(F3線)のY座標
 * @param h 五線の総高さ (lineGap * 4)
 */
export function drawBassClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)
  const s = h / 20

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ── メインカーブ（F線から上にカーブして下に降りる）──
  ctx.beginPath()
  ctx.moveTo(s * -2, s * -6)
  ctx.bezierCurveTo(
    s * 2, s * -8,
    s * 6, s * -6,
    s * 6, s * -2,
  )
  ctx.bezierCurveTo(
    s * 6, s * 2,
    s * 2, s * 6,
    s * -4, s * 8,
  )
  ctx.stroke()

  // ── 左端の丸い点（F線上）──
  ctx.beginPath()
  ctx.arc(s * -2, s * -6, s * 1.8, 0, Math.PI * 2)
  ctx.fill()

  // ── 2つのドット（F線の上下）──
  const dotX = s * 8
  const dotR = s * 1.2
  ctx.beginPath()
  ctx.arc(dotX, s * -3, dotR, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(dotX, s * 1, dotR, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

/**
 * シャープ記号（♯）
 * 2本の太い横線（やや右上がり）+ 2本の細い縦線
 */
export function drawSharp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)

  const h = size
  const w = size * 0.55
  const vGap = w * 0.5  // 縦線間隔
  const hGap = h * 0.28 // 横線間隔

  // 2本の縦線（細い）
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.09
  ctx.lineCap = 'butt'

  const tilt = size * 0.04
  ctx.beginPath()
  ctx.moveTo(-vGap / 2 - tilt, -h / 2)
  ctx.lineTo(-vGap / 2 + tilt, h / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(vGap / 2 - tilt, -h / 2)
  ctx.lineTo(vGap / 2 + tilt, h / 2)
  ctx.stroke()

  // 2本の横線（太い、やや右上がり）
  ctx.lineWidth = size * 0.16
  const rise = size * 0.05

  ctx.beginPath()
  ctx.moveTo(-w / 2, -hGap / 2 + rise)
  ctx.lineTo(w / 2, -hGap / 2 - rise)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-w / 2, hGap / 2 + rise)
  ctx.lineTo(w / 2, hGap / 2 - rise)
  ctx.stroke()

  ctx.restore()
}

/**
 * ハ音記号（Alto Clef / C Clef）
 * 第3線(C4線)を基準にして描画。左に2本の太い縦線 + 右に2つのC字型ブラケット
 *
 * @param x 中心X
 * @param y 第3線(C4線)のY座標
 * @param h 五線の総高さ (lineGap * 4)
 */
export function drawAltoClef(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)
  const s = h / 20

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // ── 左端の2本の太い縦線 ──
  // 五線の上端から下端まで伸びる
  const top = s * -10  // 五線の上端
  const bot = s * 10   // 五線の下端

  // 左の太い縦線
  ctx.lineWidth = s * 2.2
  ctx.beginPath()
  ctx.moveTo(s * -6, top)
  ctx.lineTo(s * -6, bot)
  ctx.stroke()

  // 右の細い縦線（左の線のすぐ右）
  ctx.lineWidth = s * 0.8
  ctx.beginPath()
  ctx.moveTo(s * -3.5, top)
  ctx.lineTo(s * -3.5, bot)
  ctx.stroke()

  // ── 上のC字型ブラケット（第3線→第5線）──
  ctx.lineWidth = s * 1.5
  ctx.beginPath()
  ctx.moveTo(s * -3.5, s * 0)     // 第3線(中央)からスタート
  ctx.bezierCurveTo(
    s * 0, s * 0,
    s * 2, s * -2,
    s * 2, s * -5,     // 右に膨らんで上へ
  )
  ctx.bezierCurveTo(
    s * 2, s * -8,
    s * 0, s * -10,
    s * -3.5, s * -10,   // 第5線に戻る
  )
  ctx.stroke()

  // ── 下のC字型ブラケット（第3線→第1線）──
  ctx.beginPath()
  ctx.moveTo(s * -3.5, s * 0)     // 第3線(中央)からスタート
  ctx.bezierCurveTo(
    s * 0, s * 0,
    s * 2, s * 2,
    s * 2, s * 5,       // 右に膨らんで下へ
  )
  ctx.bezierCurveTo(
    s * 2, s * 8,
    s * 0, s * 10,
    s * -3.5, s * 10,    // 第1線に戻る
  )
  ctx.stroke()

  ctx.restore()
}

/**
 * フラット記号（♭）
 * 上に伸びる縦線 + 下部の丸いb字型カーブ
 */
export function drawFlat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const h = size
  const w = size * 0.45

  // ── 縦線（上に伸びる）──
  ctx.lineWidth = size * 0.1
  ctx.beginPath()
  ctx.moveTo(-w * 0.15, -h * 0.55)   // 上端
  ctx.lineTo(-w * 0.15, h * 0.45)    // 下端
  ctx.stroke()

  // ── b字型カーブ（下部の膨らみ）──
  ctx.lineWidth = size * 0.09
  ctx.beginPath()
  ctx.moveTo(-w * 0.15, h * 0.05)    // 縦線の中間あたりからスタート
  ctx.bezierCurveTo(
    w * 0.6, h * -0.1,    // 右上に膨らむ
    w * 0.8, h * 0.25,
    w * 0.3, h * 0.42,    // 右下へ
  )
  ctx.bezierCurveTo(
    w * 0.0, h * 0.5,
    -w * 0.15, h * 0.48,
    -w * 0.15, h * 0.45,  // 縦線の下端に戻る
  )
  ctx.stroke()

  ctx.restore()
}

/**
 * ナチュラル記号（♮）
 * 2本のずれた縦線 + 2本の対角的な横棒（右上がり）
 */
export function drawNatural(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.translate(x, y)

  ctx.strokeStyle = color
  ctx.lineCap = 'butt'

  const h = size
  const w = size * 0.35
  const hGap = h * 0.25 // 横棒間隔
  const rise = size * 0.06 // 横棒の右上がり量

  // ── 左の縦線（上に長く伸びる）──
  ctx.lineWidth = size * 0.08
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h * 0.5)
  ctx.lineTo(-w / 2, hGap / 2 + rise)
  ctx.stroke()

  // ── 右の縦線（下に長く伸びる）──
  ctx.beginPath()
  ctx.moveTo(w / 2, -hGap / 2 - rise)
  ctx.lineTo(w / 2, h * 0.5)
  ctx.stroke()

  // ── 2本の横棒（太い、やや右上がり）──
  ctx.lineWidth = size * 0.14
  ctx.beginPath()
  ctx.moveTo(-w / 2, -hGap / 2 + rise)
  ctx.lineTo(w / 2, -hGap / 2 - rise)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-w / 2, hGap / 2 + rise)
  ctx.lineTo(w / 2, hGap / 2 - rise)
  ctx.stroke()

  ctx.restore()
}

/**
 * 四分音符の符頭（塗りつぶし楕円、やや傾く）
 */
export function drawNoteHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, size, size * 0.7, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * 符幹（音符から上or下に伸びる線）
 */
export function drawStem(
  ctx: CanvasRenderingContext2D,
  noteX: number,
  noteY: number,
  noteSize: number,
  stemUp: boolean,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.2
  ctx.lineCap = 'butt'

  const stemLen = noteSize * 3.5
  const offsetX = stemUp ? noteSize - 0.5 : -noteSize + 0.5

  ctx.beginPath()
  ctx.moveTo(noteX + offsetX, noteY)
  ctx.lineTo(noteX + offsetX, noteY + (stemUp ? -stemLen : stemLen))
  ctx.stroke()

  ctx.restore()
}

/**
 * 加線
 */
export function drawLedgerLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 0.8
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(x - width / 2, y)
  ctx.lineTo(x + width / 2, y)
  ctx.stroke()
  ctx.restore()
}

// ─────────────────────────────────────────────
// 敵ボディの形状バリエーション（同じ音の敵を区別）
// ─────────────────────────────────────────────

import type { EnemyShape } from './types'

/**
 * 敵ボディを形状に応じて描画
 */
export function drawEnemyBody(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape,
  radius: number,
  fillColor: string,
  time: number,
  id: number,
) {
  // 各個体で微妙にアニメーションをずらす（区別しやすく）
  const phase = (id * 1.37) % (Math.PI * 2)
  const bob = Math.sin(time * 3 + phase) * 1.5

  ctx.save()
  ctx.translate(0, bob)

  // 外枠
  ctx.fillStyle = fillColor
  ctx.strokeStyle = '#ffffff30'
  ctx.lineWidth = 1.5

  switch (shape) {
    case 'square':
      ctx.beginPath()
      ctx.rect(-radius, -radius, radius * 2, radius * 2)
      ctx.fill()
      ctx.stroke()
      break

    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(0, -radius * 1.1)
      ctx.lineTo(radius * 1.1, 0)
      ctx.lineTo(0, radius * 1.1)
      ctx.lineTo(-radius * 1.1, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break

    case 'circle':
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break

    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(0, -radius * 1.1)
      ctx.lineTo(radius * 1.1, radius * 0.8)
      ctx.lineTo(-radius * 1.1, radius * 0.8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break

    case 'hexagon':
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 - Math.PI / 6
        ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break

    case 'cross': {
      const arm = radius * 0.45
      ctx.beginPath()
      ctx.moveTo(-arm, -radius)
      ctx.lineTo(arm, -radius)
      ctx.lineTo(arm, -arm)
      ctx.lineTo(radius, -arm)
      ctx.lineTo(radius, arm)
      ctx.lineTo(arm, arm)
      ctx.lineTo(arm, radius)
      ctx.lineTo(-arm, radius)
      ctx.lineTo(-arm, arm)
      ctx.lineTo(-radius, arm)
      ctx.lineTo(-radius, -arm)
      ctx.lineTo(-arm, -arm)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      break
    }
  }

  // 内部の暗い影（形状共通）
  ctx.fillStyle = '#00000025'
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2)
  ctx.fill()

  // 小さなハイライト
  ctx.fillStyle = '#ffffff20'
  ctx.beginPath()
  ctx.arc(-radius * 0.25, -radius * 0.25, radius * 0.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

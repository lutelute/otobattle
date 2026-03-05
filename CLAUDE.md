# OtoBattle - 音楽×サバイバルゲーム

## プロジェクト概要
ブラウザで動く音当てサバイバルゲーム。敵は五線譜パネルを持って迫ってきて、正しい音を弾く（キーボード/ピアノUI/マイク/MIDI）と撃破できる。

## 技術スタック
- React 19 + TypeScript 5.9 + Vite + Tailwind CSS v4
- Canvas2D描画（src/game/renderer.ts）
- 純粋関数ベースのゲームロジック（src/game/ 以下、React非依存）

## ファイル構成
```
src/game/
  types.ts       — 全型定義（Enemy, Beam, GameState, etc.）
  constants.ts   — 全定数（速度, サイズ, 解禁Wave, etc.）
  enemies.ts     — 敵の生成・移動ロジック（normal + invader）
  collision.ts   — 攻撃判定・衝突判定・パーティクル生成
  engine.ts      — ゲームループ（updateGame）、ビーム管理
  renderer.ts    — Canvas描画（敵, プレイヤー, ビーム, パーティクル）
  notes.ts       — 音階データ・五線譜配置計算
  musicGlyphs.ts — 音楽記号のCanvas描画（ト音記号, ヘ音記号, etc.）
src/hooks/       — useGame, useKeyboard, useSwipe
src/components/  — React UIコンポーネント
src/utils/       — math.ts, storage.ts
```

## 敵タイプ
- **normal**: 四辺からスポーン、プレイヤーに直進
- **invader**: 画面上部に横一列（3〜5体）で出現、スペースインベーダー式に横移動→端で折り返し→一段降下。最下段到達でダメージ

## 攻撃エフェクト
- 音を弾くとプレイヤーから敵へ**音の色のビーム**が飛ぶ（3層グロー）
- 拡がる攻撃波リングも音の色

## 開発コマンド
```bash
npm run dev     # devサーバー起動
npx tsc -b      # 型チェック
npm run build   # プロダクションビルド
```

## 注意点
- ゲームロジック（src/game/）はReactに依存しない純粋関数。テストしやすい設計。
- 定数変更は constants.ts に集約。難易度調整はここ。
- `INVADER_UNLOCK_WAVE = 1` で全Waveからインベーダー出現中。

import { ThoughtChallenge } from "@/types/memo";

// =====================================================================
// V6: Thought Boss（思考チャレンジ）の純粋ロジック
//
// 表示・進行計算のための副作用のない関数群。supabase/fetch には依存しない。
// （supabase を使う組み立ては challengeClient.ts 側に置く）
// =====================================================================

// ---- RPG バトル: HP は「弱点(問い)の数」。崩した弱点ぶん HP が減る ----

// ボスの総HP＝弱点(問い)の数。無ければ target_count を代用。
export function bossMaxHp(challenge: ThoughtChallenge): number {
  return challenge.questions?.length || challenge.target_count || 1;
}

// 崩した弱点数。exact（ログ由来の正確な数）があればそれを、無ければ進行率から逆算。
export function brokenCountOf(
  challenge: ThoughtChallenge,
  exact?: number,
): number {
  if (typeof exact === "number") return Math.min(exact, bossMaxHp(challenge));
  return Math.round((challenge.progress / 100) * bossMaxHp(challenge));
}

// 残りHP。
export function hpRemaining(max: number, broken: number): number {
  return Math.max(0, max - broken);
}

// 残りHPの割合(0..100)。HPバー幅に使う。
export function hpPercent(max: number, broken: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.round(((max - broken) / max) * 100));
}

// Boss のレベルに応じた絵文字（見た目の変化づけ）。
export function bossEmoji(level: number): string {
  const emojis = ["🐣", "👾", "🐲", "🔥", "👑"];
  return emojis[Math.min(level - 1, emojis.length - 1)] ?? "👾";
}

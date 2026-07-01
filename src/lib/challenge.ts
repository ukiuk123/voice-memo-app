import { ThoughtChallenge } from "@/types/memo";

// =====================================================================
// V6: Thought Boss（思考チャレンジ）の純粋ロジック
//
// 表示・進行計算のための副作用のない関数群。supabase/fetch には依存しない。
// （supabase を使う組み立ては challengeClient.ts 側に置く）
// =====================================================================

// ---- RPG バトル ----
// 弱点(問い)の数は「攻略に必要な有効打の数」。
// ボスのHPは一般的なゲームらしい大きめの数値にし、弱点を1つ崩すごとに
// 「HP ÷ 弱点数」ぶんのダメージが入る。全弱点を崩す＝HP 0 で撃破。
// HP はレベルとボス個体（id）で変わるので、ボスごとに体力差が出る。

// 文字列→安定した 0..1 のハッシュ（乱数を使わずボス個体差を出す）
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

// 弱点(問い)の数。無ければ target_count を代用。
export function weaknessCount(challenge: ThoughtChallenge): number {
  return challenge.questions?.length || challenge.target_count || 1;
}

// ボスの総HP。レベルで底上げ＋個体差。弱点数で割り切れる値に丸める。
export function bossMaxHp(challenge: ThoughtChallenge): number {
  const n = weaknessCount(challenge);
  const base = 300 + (Math.max(1, challenge.level) - 1) * 80; // レベルで増加
  const variance = Math.round(hash01(challenge.id || challenge.theme || "") * 320); // 0..320 の個体差
  const raw = base + variance; // だいたい 300〜1000+
  return Math.max(n, Math.round(raw / n) * n); // 1弱点あたりのダメージを整数にする
}

// 弱点1つを崩したときの与ダメージ。
export function damagePerWeakness(challenge: ThoughtChallenge): number {
  return Math.round(bossMaxHp(challenge) / weaknessCount(challenge));
}

// 崩した弱点数。exact（ログ由来の正確な数）があればそれを、無ければ進行率から逆算。
export function brokenCountOf(
  challenge: ThoughtChallenge,
  exact?: number,
): number {
  const n = weaknessCount(challenge);
  if (typeof exact === "number") return Math.min(exact, n);
  return Math.round((challenge.progress / 100) * n);
}

// 残りHP（崩した弱点数から算出）。
export function hpRemainingOf(
  challenge: ThoughtChallenge,
  broken: number,
): number {
  return Math.max(
    0,
    bossMaxHp(challenge) - broken * damagePerWeakness(challenge),
  );
}

// 残りHPの割合(0..100)。HPバー幅に使う。
export function hpPercentOf(
  challenge: ThoughtChallenge,
  broken: number,
): number {
  const max = bossMaxHp(challenge);
  if (max <= 0) return 0;
  return Math.max(0, Math.round((hpRemainingOf(challenge, broken) / max) * 100));
}

// Boss のレベルに応じた絵文字（見た目の変化づけ）。
export function bossEmoji(level: number): string {
  const emojis = ["🐣", "👾", "🐲", "🔥", "👑"];
  return emojis[Math.min(level - 1, emojis.length - 1)] ?? "👾";
}

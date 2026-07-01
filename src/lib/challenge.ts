import { ThoughtChallenge } from "@/types/memo";

// =====================================================================
// V6: Thought Boss（思考チャレンジ）の純粋ロジック
//
// 表示・進行計算のための副作用のない関数群。supabase/fetch には依存しない。
// （supabase を使う組み立ては challengeClient.ts 側に置く）
// =====================================================================

// 進行率(0..100)。進んだメモ数 / 必要数。
export function progressPercent(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((current / target) * 100));
}

// 進んだメモ数（進行率と必要数から逆算）。ログ数が取れない画面用のフォールバック。
export function clearedCount(challenge: ThoughtChallenge): number {
  return Math.round((challenge.progress / 100) * challenge.target_count);
}

// あと何メモでクリアかを表す文言。
export function remainingLabel(current: number, target: number): string {
  const left = Math.max(0, target - current);
  if (left <= 0) return "クリア条件を達成しました 🎉";
  return `あと ${left} メモでクリア`;
}

// 進行バー用のブロック表現（██████░░░░）。10 分割。
export function progressBar(percent: number, size = 10): string {
  const filled = Math.round((percent / 100) * size);
  return "█".repeat(filled) + "░".repeat(Math.max(0, size - filled));
}

// Boss のレベルに応じた絵文字（見た目の変化づけ）。
export function bossEmoji(level: number): string {
  const emojis = ["🐣", "👾", "🐲", "🔥", "👑"];
  return emojis[Math.min(level - 1, emojis.length - 1)] ?? "👾";
}

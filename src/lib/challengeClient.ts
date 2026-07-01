import { supabase } from "./supabase";
import {
  bossMaxHp,
  weaknessCount,
  damagePerWeakness,
  hpRemainingOf,
} from "./challenge";
import type {
  Memo,
  ThoughtChallenge,
  ChallengeLog,
  GeneratedChallenge,
} from "@/types/memo";

// ログ配列から「崩した弱点(index)の集合」を求める。
export function brokenSetOf(logs: ChallengeLog[]): Set<number> {
  const set = new Set<number>();
  for (const l of logs) for (const h of l.hits ?? []) set.add(h);
  return set;
}

// =====================================================================
// V6: Thought Boss のクライアント側オーケストレーション
//
// 既存方針を踏襲し、LLM 生成は /api/challenge/* に委譲し、
// DB 読み書きは RLS 保護された supabase クライアント経由で行う。
// =====================================================================

// 全チャレンジ（新しい順）。RLS により本人分のみ返る。
export async function fetchChallenges(): Promise<ThoughtChallenge[]> {
  const { data } = await supabase
    .from("thought_challenges")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as ThoughtChallenge[] | null) ?? [];
}

// 現在アクティブな Boss（最新の1件）。無ければ null。
export function activeChallengeOf(
  challenges: ThoughtChallenge[],
): ThoughtChallenge | null {
  return challenges.find((c) => c.status === "active") ?? null;
}

export async function fetchActiveChallenge(): Promise<ThoughtChallenge | null> {
  const { data } = await supabase
    .from("thought_challenges")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data as ThoughtChallenge[] | null) ?? [])[0] ?? null;
}

export async function fetchLogs(challengeId: string): Promise<ChallengeLog[]> {
  const { data } = await supabase
    .from("challenge_logs")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });
  return (data as ChallengeLog[] | null) ?? [];
}

// 起点メモから Boss を生成して保存する。
export async function summonBoss(
  userId: string,
  seedMemo: Memo,
): Promise<ThoughtChallenge> {
  const res = await fetch("/api/challenge/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memo: {
        title: seedMemo.title,
        summary: seedMemo.summary,
        transcript: seedMemo.transcript,
        tags: seedMemo.tags,
      },
    }),
  });
  if (!res.ok) throw new Error("チャレンジの生成に失敗しました");
  const gen = (await res.json()) as GeneratedChallenge;

  // Lv は既存チャレンジ数 + 1。
  const { count } = await supabase
    .from("thought_challenges")
    .select("id", { count: "exact", head: true });
  const level = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("thought_challenges")
    .insert({
      user_id: userId,
      memo_id: seedMemo.id,
      theme: gen.theme,
      title: gen.title,
      description: gen.description,
      questions: gen.questions,
      status: "active",
      progress: 0,
      target_count: gen.target_count,
      level,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error("チャレンジの保存に失敗しました");
  return data as ThoughtChallenge;
}

export type AdvanceResult = {
  challenge: ThoughtChallenge;
  landed: boolean; // 攻撃が命中し弱点を崩したか
  justCleared: boolean; // 今回の一撃で撃破したか
  damage: number; // 与ダメージ（HP換算。崩した弱点数 × 弱点あたりダメージ）
  brokenNow: number[]; // 今回崩した弱点(index)
  hpRemaining: number; // 残りHP
  maxHp: number; // 総HP
  note: string; // AI のバトル実況コメント
};

// メモ（武器）でアクティブ Boss を攻撃し、弱点を崩して HP を削る。
// - 起点メモ / 既に使った武器（ログ済みメモ）は攻撃に使えない。
// - AI が突いた弱点（未撃破のもの）を崩し、HP を減らす。
// - 全弱点を崩したら撃破 → 総評生成。
export async function advanceChallenge(
  challenge: ThoughtChallenge,
  memo: Memo,
  allMemos: Memo[],
): Promise<AdvanceResult> {
  const maxHp = bossMaxHp(challenge); // 総HP（大きめの数値）
  const n = weaknessCount(challenge); // 弱点の数（＝必要な有効打の数）
  const dmgPer = damagePerWeakness(challenge); // 弱点1つあたりの与ダメージ

  const miss = (note: string, broken: Set<number>): AdvanceResult => ({
    challenge,
    landed: false,
    justCleared: false,
    damage: 0,
    brokenNow: [],
    hpRemaining: hpRemainingOf(challenge, broken.size),
    maxHp,
    note,
  });

  if (challenge.status !== "active") return miss("", new Set());
  if (memo.id === challenge.memo_id) return miss("", new Set()); // 起点メモは対象外

  const logs = await fetchLogs(challenge.id);
  const broken = brokenSetOf(logs);
  if (logs.some((l) => l.memo_id === memo.id)) {
    return miss("この武器はもう使用済みです。", broken); // 二重加算防止
  }

  // 攻撃判定（AI）: どの弱点を突いたか
  const judgeRes = await fetch("/api/challenge/judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: {
        theme: challenge.theme,
        description: challenge.description,
        questions: challenge.questions,
      },
      memo: {
        title: memo.title,
        summary: memo.summary,
        transcript: memo.transcript,
        tags: memo.tags,
      },
    }),
  });
  if (!judgeRes.ok) return miss("攻撃に失敗しました。", broken);
  const judged = (await judgeRes.json()) as {
    relevant: boolean;
    hits: number[];
    note: string;
  };

  // 未撃破の弱点だけを対象にする
  let newHits = (judged.hits ?? []).filter((h) => !broken.has(h));

  // 弱点を特定できなかったがテーマに関連 → 未撃破の弱点を1つ崩す（有効打）
  if (newHits.length === 0 && judged.relevant) {
    const next = Array.from({ length: n }, (_, i) => i).find(
      (i) => !broken.has(i),
    );
    if (next !== undefined) newHits = [next];
  }

  // どの弱点も崩せない → 空振り
  if (newHits.length === 0) {
    return miss(judged.note || "攻撃は弱点を突けませんでした。", broken);
  }

  const damage = newHits.length * dmgPer; // 今回の与ダメージ（HP換算）

  // 攻撃命中：ログ（＝攻撃履歴）を記録
  const { error: logErr } = await supabase.from("challenge_logs").insert({
    challenge_id: challenge.id,
    memo_id: memo.id,
    note: judged.note || null,
    hits: newHits,
    damage,
  });
  if (logErr) return miss(judged.note || "", broken);

  const brokenCount = broken.size + newHits.length;
  const percent = Math.min(100, Math.round((brokenCount / n) * 100));
  const defeated = brokenCount >= n;

  if (!defeated) {
    const { data } = await supabase
      .from("thought_challenges")
      .update({ progress: percent, updated_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .select("*")
      .single();
    return {
      challenge: (data as ThoughtChallenge) ?? { ...challenge, progress: percent },
      landed: true,
      justCleared: false,
      damage,
      brokenNow: newHits,
      hpRemaining: hpRemainingOf(challenge, brokenCount),
      maxHp,
      note: judged.note,
    };
  }

  // 撃破 → 総評生成
  const linkedIds = new Set([...logs.map((l) => l.memo_id), memo.id]);
  const linkedMemos = allMemos.filter((m) => linkedIds.has(m.id));
  let summary: string | null = null;
  let feedback: ThoughtChallenge["feedback"] = null;

  try {
    const fbRes = await fetch("/api/challenge/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge: {
          theme: challenge.theme,
          description: challenge.description,
          questions: challenge.questions,
        },
        memos: linkedMemos.map((m) => ({
          title: m.title,
          summary: m.summary,
          tags: m.tags,
          created_at: m.created_at,
        })),
      }),
    });
    if (fbRes.ok) {
      const fb = await fbRes.json();
      summary = fb.summary ?? null;
      feedback = fb.feedback ?? null;
    }
  } catch {
    // 総評生成に失敗しても撃破自体は成立させる
  }

  const { data } = await supabase
    .from("thought_challenges")
    .update({
      status: "cleared",
      progress: 100,
      summary,
      feedback,
      updated_at: new Date().toISOString(),
    })
    .eq("id", challenge.id)
    .select("*")
    .single();

  return {
    challenge:
      (data as ThoughtChallenge) ??
      { ...challenge, status: "cleared", progress: 100, summary, feedback },
    landed: true,
    justCleared: true,
    damage,
    brokenNow: newHits,
    hpRemaining: 0,
    maxHp,
    note: judged.note,
  };
}

import { supabase } from "./supabase";
import { progressPercent } from "./challenge";
import type {
  Memo,
  ThoughtChallenge,
  ChallengeLog,
  GeneratedChallenge,
} from "@/types/memo";

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
  advanced: boolean; // このメモで進行したか
  justCleared: boolean; // 今回クリアに到達したか
  note: string; // AI の進行コメント
};

// 追加メモでアクティブ Boss の進行を判定・更新する。
// - 起点メモ / 既にログ済みのメモは進行に使わない。
// - 関連していればログを追加して進行率を更新。target 到達でクリア＋総評。
export async function advanceChallenge(
  challenge: ThoughtChallenge,
  memo: Memo,
  allMemos: Memo[],
): Promise<AdvanceResult> {
  const unchanged: AdvanceResult = {
    challenge,
    advanced: false,
    justCleared: false,
    note: "",
  };

  if (challenge.status !== "active") return unchanged;
  if (memo.id === challenge.memo_id) return unchanged; // 起点メモは対象外

  const logs = await fetchLogs(challenge.id);
  if (logs.some((l) => l.memo_id === memo.id)) return unchanged; // 二重加算防止

  // 進行判定（AI）
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
  if (!judgeRes.ok) return unchanged;
  const judged = (await judgeRes.json()) as {
    relevant: boolean;
    note: string;
  };

  if (!judged.relevant) {
    return { ...unchanged, note: judged.note };
  }

  // ログ追加
  const { error: logErr } = await supabase.from("challenge_logs").insert({
    challenge_id: challenge.id,
    memo_id: memo.id,
    note: judged.note || null,
  });
  if (logErr) return { ...unchanged, note: judged.note };

  const current = logs.length + 1;
  const percent = progressPercent(current, challenge.target_count);
  const reached = current >= challenge.target_count;

  if (!reached) {
    const { data } = await supabase
      .from("thought_challenges")
      .update({ progress: percent, updated_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .select("*")
      .single();
    return {
      challenge: (data as ThoughtChallenge) ?? { ...challenge, progress: percent },
      advanced: true,
      justCleared: false,
      note: judged.note,
    };
  }

  // クリア到達 → 総評生成
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
    // 総評生成に失敗してもクリア自体は成立させる
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
    advanced: true,
    justCleared: true,
    note: judged.note,
  };
}

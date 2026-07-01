"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Memo, ThoughtChallenge } from "@/types/memo";
import LoginPage from "@/components/LoginPage";
import BossProgress from "@/components/BossProgress";
import {
  fetchChallenges,
  fetchLogs,
  summonBoss,
  advanceChallenge,
  activeChallengeOf,
} from "@/lib/challengeClient";

export default function ChallengesPage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [challenges, setChallenges] = useState<ThoughtChallenge[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [celebration, setCelebration] = useState<ThoughtChallenge | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const active = activeChallengeOf(challenges);

  const refresh = useCallback(async () => {
    const [memoRes, chs] = await Promise.all([
      supabase.from("memos").select("*").order("created_at", { ascending: false }),
      fetchChallenges(),
    ]);
    setMemos((memoRes.data as Memo[] | null) ?? []);
    setChallenges(chs);

    const act = activeChallengeOf(chs);
    if (act) {
      const logs = await fetchLogs(act.id);
      setLinkedIds(new Set(logs.map((l) => l.memo_id)));
    } else {
      setLinkedIds(new Set());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  // 最新メモを種に Boss を召喚
  const handleSummon = async () => {
    if (!session || memos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await summonBoss(session.user.id, memos[0]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // 既存メモでアクティブ Boss に挑む
  const handleChallengeWith = async (memo: Memo) => {
    if (!active) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await advanceChallenge(active, memo, memos);
      setNote(result.note || null);
      if (result.justCleared) setCelebration(result.challenge);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // テキストから新規メモを保存し、そのまま挑む
  const handleAddMemo = async () => {
    if (!session || !active || !draft.trim()) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: draft.trim(),
          now: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) throw new Error("要約に失敗しました");
      const { title, summary, tags, reminder_date } = await res.json();

      const { data: inserted, error: insErr } = await supabase
        .from("memos")
        .insert({
          user_id: session.user.id,
          audio_url: null,
          transcript: draft.trim(),
          title: title ?? null,
          summary,
          tags: tags ?? [],
          duration: null,
          reminder_date: reminder_date ?? null,
          reminder_enabled: !!reminder_date,
        })
        .select("*")
        .single();
      if (insErr || !inserted) throw new Error("メモの保存に失敗しました");

      setDraft("");
      const result = await advanceChallenge(active, inserted as Memo, [
        inserted as Memo,
        ...memos,
      ]);
      setNote(result.note || null);
      if (result.justCleared) setCelebration(result.challenge);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-300 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  const cleared = challenges.filter((c) => c.status === "cleared");
  const doneCount = linkedIds.size;

  // 起点メモ・進行済みメモを除いた「挑めるメモ」候補
  const candidateMemos = active
    ? memos.filter((m) => m.id !== active.memo_id && !linkedIds.has(m.id)).slice(0, 6)
    : [];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 pb-12">
        {/* ヘッダー */}
        <header className="flex items-center justify-between pt-8 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              ← 戻る
            </Link>
            <h1 className="text-base font-bold text-gray-800">👾 思考チャレンジ</h1>
          </div>
          <span className="text-xs text-gray-400">Lv.{active?.level ?? cleared.length}</span>
        </header>

        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">読み込み中...</div>
        ) : (
          <div className="space-y-5">
            {/* Boss Clear! 演出 */}
            {celebration && (
              <section className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-3xl shadow-lg p-6 relative">
                <button
                  onClick={() => setCelebration(null)}
                  className="absolute top-3 right-4 text-white/70 hover:text-white text-lg leading-none"
                  aria-label="閉じる"
                >
                  ✕
                </button>
                <p className="text-2xl font-black tracking-wide mb-1">🎉 Boss Clear!</p>
                <p className="text-sm font-semibold text-white/90 mb-3">
                  {celebration.title}（Lv.{celebration.level}）
                </p>
                {celebration.summary && (
                  <p className="text-sm leading-relaxed text-white/95 bg-white/10 rounded-xl p-3">
                    {celebration.summary}
                  </p>
                )}
                {celebration.feedback && (
                  <div className="mt-3 space-y-2 text-sm">
                    <FeedbackRow label="良かった点" value={celebration.feedback.good} light />
                    <FeedbackRow label="深掘りできた点" value={celebration.feedback.deepened} light />
                    <FeedbackRow label="次に考えること" value={celebration.feedback.next} light />
                    <FeedbackRow label="関連する観点" value={celebration.feedback.related} light />
                  </div>
                )}
              </section>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* アクティブ Boss */}
            {active ? (
              <>
                <BossProgress challenge={active} current={doneCount} />

                {/* AI の投げかけ */}
                <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <p className="text-[11px] font-semibold text-violet-500 uppercase tracking-wide mb-2">
                    AI からの問い
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {active.description}
                  </p>

                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    深掘りステップ
                  </p>
                  <ul className="space-y-2">
                    {active.questions.map((q, i) => {
                      const stepDone = i < doneCount;
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span
                            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stepDone
                                ? "bg-violet-500 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {stepDone ? "✓" : i + 1}
                          </span>
                          <span
                            className={`text-sm leading-relaxed ${
                              stepDone ? "text-gray-400 line-through" : "text-gray-700"
                            }`}
                          >
                            {q}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {note && (
                  <div className="bg-violet-50 border border-violet-100 text-violet-600 text-sm rounded-xl px-4 py-3">
                    💬 {note}
                  </div>
                )}

                {/* 新規メモで挑む */}
                <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <p className="text-sm font-semibold text-gray-500 mb-3">
                    メモを書いて挑む
                  </p>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    disabled={busy}
                    placeholder="問いへの考えを書いてみましょう…"
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddMemo}
                      disabled={busy || !draft.trim()}
                      className="text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                    >
                      {busy ? "判定中..." : "メモを追加して挑む"}
                    </button>
                  </div>
                </section>

                {/* 既存メモで挑む */}
                {candidateMemos.length > 0 && (
                  <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                    <p className="text-sm font-semibold text-gray-500 mb-3">
                      最近のメモで挑む
                    </p>
                    <ul className="space-y-2">
                      {candidateMemos.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 border border-gray-100 rounded-xl px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {m.title ?? "(無題)"}
                            </p>
                            {m.summary && (
                              <p className="text-xs text-gray-400 truncate">{m.summary}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleChallengeWith(m)}
                            disabled={busy}
                            className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 transition-colors shrink-0 disabled:opacity-40"
                          >
                            挑む
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              /* Boss 未召喚 */
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center">
                <p className="text-4xl mb-3">👾</p>
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  挑戦中の Boss はいません
                </p>
                <p className="text-xs text-gray-400 mb-4">
                  最新のメモから AI が思考チャレンジを生成します
                </p>
                <button
                  onClick={handleSummon}
                  disabled={busy || memos.length === 0}
                  className="text-sm text-white bg-violet-500 hover:bg-violet-600 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-40"
                >
                  {busy
                    ? "生成中..."
                    : memos.length === 0
                      ? "先にメモを作成してください"
                      : "⚔️ Boss を召喚する"}
                </button>
              </section>
            )}

            {/* 達成済みチャレンジ一覧 / Boss 履歴 */}
            {cleared.length > 0 && (
              <section>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  達成済みチャレンジ（{cleared.length}）
                </p>
                <ul className="space-y-2">
                  {cleared.map((c) => {
                    const open = expanded === c.id;
                    return (
                      <li
                        key={c.id}
                        className="bg-white border border-gray-100 rounded-2xl p-4"
                      >
                        <button
                          onClick={() => setExpanded(open ? null : c.id)}
                          className="w-full flex items-center gap-2 text-left"
                        >
                          <span className="text-lg shrink-0">🏆</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {c.title}
                            </p>
                            <p className="text-xs text-gray-400">
                              Lv.{c.level} · #{c.theme}
                            </p>
                          </div>
                          <span className="text-gray-300 text-xs shrink-0">
                            {open ? "▲" : "▼"}
                          </span>
                        </button>

                        {open && (
                          <div className="mt-3 space-y-2">
                            {c.summary && (
                              <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3">
                                {c.summary}
                              </p>
                            )}
                            {c.feedback && (
                              <div className="space-y-2">
                                <FeedbackRow label="良かった点" value={c.feedback.good} />
                                <FeedbackRow label="深掘りできた点" value={c.feedback.deepened} />
                                <FeedbackRow label="次に考えること" value={c.feedback.next} />
                                <FeedbackRow label="関連する観点" value={c.feedback.related} />
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function FeedbackRow({
  label,
  value,
  light,
}: {
  label: string;
  value: string;
  light?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p
        className={`text-[11px] font-semibold ${
          light ? "text-white/70" : "text-violet-500"
        }`}
      >
        {label}
      </p>
      <p className={`text-sm leading-relaxed ${light ? "text-white/95" : "text-gray-700"}`}>
        {value}
      </p>
    </div>
  );
}

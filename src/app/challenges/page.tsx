"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  brokenSetOf,
} from "@/lib/challengeClient";

export default function ChallengesPage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [challenges, setChallenges] = useState<ThoughtChallenge[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [brokenSet, setBrokenSet] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [celebration, setCelebration] = useState<ThoughtChallenge | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedWeapon, setExpandedWeapon] = useState<string | null>(null);
  // ボスの起点にするメモ（未選択なら最新メモを既定にする）
  const [seedId, setSeedId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  const active = activeChallengeOf(challenges);

  // 攻撃結果をバトルの実況文に整える
  const noteFromResult = (r: {
    landed: boolean;
    justCleared: boolean;
    damage: number;
    brokenNow: number[];
    hpRemaining: number;
    note: string;
  }) => {
    if (r.justCleared) return null; // 撃破演出側で表示する
    if (r.landed)
      return {
        ok: true,
        text: `⚔️ 会心の一撃！ ${r.damage} ダメージ（弱点 ${r.brokenNow.length} つ撃破・残りHP ${r.hpRemaining}）${r.note ? " ／ " + r.note : ""}`,
      };
    return {
      ok: false,
      text: `🛡️ 攻撃は弱点を突けなかった…${r.note ? " " + r.note : "（テーマとの関連が薄いようです）"}`,
    };
  };

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
      setBrokenSet(brokenSetOf(logs));
    } else {
      setLinkedIds(new Set());
      setBrokenSet(new Set());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  // 選んだメモ（未選択なら最新メモ）を種に Boss を召喚
  const handleSummon = async (seedMemo: Memo) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await summonBoss(session.user.id, seedMemo);
      setSeedId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  // 既存メモでアクティブ Boss に挑む
  const handleChallengeWith = async (memo: Memo) => {
    if (!active || busy) return;
    setBusy(true);
    setPendingId(memo.id);
    setError(null);
    setNote(null);
    try {
      const result = await advanceChallenge(active, memo, memos);
      setNote(noteFromResult(result));
      if (result.justCleared) setCelebration(result.challenge);
      await refresh();
      // 結果（進行バー・演出）は画面上部にあるため、タップ後に上へスクロール
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
      setPendingId(null);
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
      setNote(noteFromResult(result));
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
  const brokenCount = brokenSet.size;

  // 起点メモ・使用済みの武器（ログ済みメモ）を除いた「手持ちの武器」候補
  const candidateMemos = active
    ? memos.filter((m) => m.id !== active.memo_id && !linkedIds.has(m.id)).slice(0, 6)
    : [];

  // 起点に選んでいるメモ（未選択なら最新メモを既定にする）
  const seedMemo = memos.find((m) => m.id === seedId) ?? memos[0] ?? null;

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
            <h1 className="text-base font-bold text-gray-800">⚔️ 思考バトル</h1>
          </div>
          <span className="text-xs text-gray-400">
            撃破 {cleared.length} 体
          </span>
        </header>

        <div ref={topRef} className="scroll-mt-4" />

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
                <p className="text-2xl font-black tracking-wide mb-1">
                  🎉 Boss 撃破！
                </p>
                <p className="text-sm font-semibold text-white/90 mb-3">
                  {celebration.title}（Lv.{celebration.level}）を倒した！
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
                <BossProgress challenge={active} broken={brokenCount} />

                {/* ボスの挑発 */}
                <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <p className="text-[11px] font-semibold text-violet-500 uppercase tracking-wide mb-2">
                    💬 ボスの挑発
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    「{active.description}」
                  </p>

                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    ボスの弱点（{brokenCount}/{active.questions.length} 撃破）
                  </p>
                  <ul className="space-y-2">
                    {active.questions.map((q, i) => {
                      const broken = brokenSet.has(i);
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span
                            className={`shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                              broken
                                ? "bg-rose-500 text-white"
                                : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {broken ? "💥" : i + 1}
                          </span>
                          <span
                            className={`text-sm leading-relaxed ${
                              broken ? "text-gray-400 line-through" : "text-gray-700"
                            }`}
                          >
                            {broken && (
                              <span className="text-[10px] font-bold text-rose-500 mr-1">
                                撃破
                              </span>
                            )}
                            {q}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[11px] text-gray-400 mt-3">
                    弱点に刺さるメモ（武器）で攻撃すると HP を削れます
                  </p>
                </section>

                {note && (
                  <div
                    className={`text-sm rounded-xl px-4 py-3 border ${
                      note.ok
                        ? "bg-violet-50 border-violet-100 text-violet-600"
                        : "bg-amber-50 border-amber-100 text-amber-700"
                    }`}
                  >
                    {note.text}
                  </div>
                )}

                {/* メモを書いて武器を作り攻撃 */}
                <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                  <p className="text-sm font-semibold text-gray-500 mb-1">
                    🔨 メモを書いて武器を作る
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">
                    弱点への考えを書くほど強い一撃になります
                  </p>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    disabled={busy}
                    placeholder="弱点への考えを書いて武器を鍛えよう…"
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddMemo}
                      disabled={busy || !draft.trim()}
                      className="text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                    >
                      {busy ? "攻撃中..." : "⚔️ 武器を作って攻撃！"}
                    </button>
                  </div>
                </section>

                {/* 手持ちの武器（既存メモ）で攻撃 */}
                {candidateMemos.length > 0 && (
                  <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                    <p className="text-sm font-semibold text-gray-500 mb-1">
                      🗡️ 手持ちの武器で攻撃
                    </p>
                    <p className="text-[11px] text-gray-400 mb-3">
                      過去に書いたメモも武器になります。弱点を突けるか試そう
                    </p>
                    <ul className="space-y-2">
                      {candidateMemos.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-start gap-2 border border-gray-100 rounded-xl px-3 py-2"
                        >
                          <span className="text-base shrink-0">🗡️</span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWeapon(expandedWeapon === m.id ? null : m.id)
                            }
                            className="min-w-0 flex-1 text-left cursor-pointer"
                            title={
                              m.summary
                                ? `${m.title ?? "(無題)"}\n\n${m.summary}`
                                : (m.title ?? "(無題)")
                            }
                          >
                            <p
                              className={`text-sm font-medium text-gray-700 ${
                                expandedWeapon === m.id ? "" : "truncate"
                              }`}
                            >
                              {m.title ?? "(無題)"}
                            </p>
                            {m.summary && (
                              <p
                                className={`text-xs text-gray-400 ${
                                  expandedWeapon === m.id
                                    ? "whitespace-pre-line mt-0.5"
                                    : "truncate"
                                }`}
                              >
                                {m.summary}
                              </p>
                            )}
                          </button>
                          <button
                            onClick={() => handleChallengeWith(m)}
                            disabled={busy}
                            className="text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-lg px-3 py-1.5 transition-colors shrink-0 disabled:opacity-40"
                          >
                            {pendingId === m.id ? "攻撃中..." : "攻撃"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              /* Boss 未出現 */
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="text-center">
                  <p className="text-4xl mb-3">👾</p>
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    出現中のボスはいません
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    起点にするメモを選ぶと、そのメモから AI が「思考のボス」を出現させます
                  </p>
                </div>

                {memos.length === 0 ? (
                  <p className="text-center text-sm text-gray-400">
                    先にメモを作成してください
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      起点にするメモを選ぶ
                    </p>
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-4">
                      {memos.map((m) => {
                        const selected = seedMemo?.id === m.id;
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => setSeedId(m.id)}
                              disabled={busy}
                              className={`w-full text-left flex items-start gap-2 border rounded-xl px-3 py-2 transition-colors disabled:opacity-50 ${
                                selected
                                  ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                                  : "border-gray-100 hover:border-gray-200"
                              }`}
                            >
                              <span
                                className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${
                                  selected ? "border-violet-500" : "border-gray-300"
                                }`}
                              >
                                {selected && (
                                  <span className="w-2 h-2 rounded-full bg-violet-500" />
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-700 truncate">
                                  {m.title ?? "(無題)"}
                                </p>
                                {m.summary && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {m.summary}
                                  </p>
                                )}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      onClick={() => seedMemo && handleSummon(seedMemo)}
                      disabled={busy || !seedMemo}
                      className="w-full text-sm text-white bg-violet-500 hover:bg-violet-600 rounded-xl px-5 py-2.5 transition-colors disabled:opacity-40"
                    >
                      {busy ? "出現中..." : "⚔️ このメモでボスを出現させる"}
                    </button>
                  </>
                )}
              </section>
            )}

            {/* 撃破したボス一覧 / 履歴 */}
            {cleared.length > 0 && (
              <section>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  撃破したボス（{cleared.length}）
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

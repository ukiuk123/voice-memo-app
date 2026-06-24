"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Memo } from "@/types/memo";
import LoginPage from "@/components/LoginPage";
import KnowledgeGarden from "@/components/KnowledgeGarden";
import {
  gardenLevelOf,
  buildPlants,
  growthHistory,
} from "@/lib/garden";

export default function GardenPage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchMemos = useCallback(async () => {
    const { data } = await supabase
      .from("memos")
      .select("*")
      .order("created_at", { ascending: false });
    setMemos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchMemos();
  }, [session, fetchMemos]);

  // 派生データ（メモが変わったときだけ再計算）
  const levelInfo = useMemo(() => gardenLevelOf(memos.length), [memos]);
  const plants = useMemo(() => buildPlants(memos), [memos]);
  const history = useMemo(() => growthHistory(memos), [memos]);

  const selectedPlant = plants.find((p) => p.category === selected) ?? null;
  const selectedMemos = useMemo(() => {
    if (!selectedPlant) return [];
    const ids = new Set(selectedPlant.memoIds);
    return memos.filter((m) => ids.has(m.id));
  }, [selectedPlant, memos]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-300 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const maxCum = history.length ? history[history.length - 1].cumulative : 0;

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
            <h1 className="text-base font-bold text-gray-800">🌱 思考の庭</h1>
          </div>
          <span className="text-xs text-gray-400">{memos.length}メモ</span>
        </header>

        {loading ? (
          <div className="text-center py-16 text-gray-300 text-sm">読み込み中...</div>
        ) : (
          <>
            {/* レベルバナー */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{levelInfo.level.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {levelInfo.level.label}
                  </p>
                  <p className="text-xs text-gray-400">
                    {levelInfo.toNext === null
                      ? "最大まで育ちました 🎉"
                      : `次の段階まであと ${levelInfo.toNext} メモ`}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                />
              </div>
            </section>

            {/* 庭ビジュアル */}
            <section className="mb-5">
              <KnowledgeGarden
                plants={plants}
                selected={selected}
                onSelect={setSelected}
              />
              <p className="text-center text-[11px] text-gray-400 mt-2">
                植物をタップすると、そのテーマのメモが見られます
              </p>
            </section>

            {/* 選択した植物の関連メモ */}
            {selectedPlant && (
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 mb-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {selectedPlant.emoji} {selectedPlant.speciesLabel}
                    </p>
                    <p className="text-xs text-gray-400">
                      #{selectedPlant.category} · {selectedPlant.count}メモ
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-gray-300 hover:text-gray-600 text-lg leading-none shrink-0"
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </div>
                <ul className="space-y-2">
                  {selectedMemos.map((m) => (
                    <li
                      key={m.id}
                      className="border border-gray-100 rounded-xl px-3 py-2"
                    >
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {m.title ?? "(無題)"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(m.created_at)}
                      </p>
                      {m.summary && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {m.summary}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* 成長履歴 */}
            {history.length > 0 && (
              <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  成長の記録
                </p>
                <div className="flex items-end gap-1 h-24">
                  {history.map((pt) => (
                    <div
                      key={pt.date}
                      className="flex-1 bg-emerald-400/80 rounded-t hover:bg-emerald-500 transition-colors"
                      style={{
                        height: `${maxCum ? (pt.cumulative / maxCum) * 100 : 0}%`,
                      }}
                      title={`${pt.date}：累計 ${pt.cumulative} メモ`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                  <span>{history[0].date}</span>
                  <span>累計 {maxCum} メモ</span>
                  <span>{history[history.length - 1].date}</span>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

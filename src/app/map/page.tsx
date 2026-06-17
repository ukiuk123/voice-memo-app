"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Memo } from "@/types/memo";
import MemoGraph from "@/components/MemoGraph";
import AIChatPanel from "@/components/AIChatPanel";
import LoginPage from "@/components/LoginPage";

export default function MapPage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Memo | null>(null);

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

  return (
    <main className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            ← 戻る
          </Link>
          <h1 className="text-base font-bold text-gray-800">🗺️ メモマップ</h1>
        </div>
        <span className="text-xs text-gray-400">{memos.length}件</span>
      </header>

      {/* グラフ領域 */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
            読み込み中...
          </div>
        ) : memos.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-sm">メモがまだありません</p>
          </div>
        ) : (
          <MemoGraph
            memos={memos}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        )}

        {/* 選択メモパネル（モバイル=下／PC=右） */}
        {selected && (
          <div className="absolute z-20 bg-white shadow-xl border-gray-100 overflow-y-auto
                          inset-x-0 bottom-0 max-h-[55%] rounded-t-2xl border-t
                          md:inset-y-0 md:right-0 md:left-auto md:w-96 md:max-h-none md:rounded-none md:border-t-0 md:border-l">
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {selected.title ?? "(無題)"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(selected.created_at)}
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

              {selected.tags && selected.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => {
                    const i = tag.indexOf(":");
                    const value = i === -1 ? tag : tag.slice(i + 1);
                    return (
                      <span
                        key={tag}
                        className="text-xs bg-indigo-50 text-indigo-500 rounded-full px-2.5 py-0.5"
                      >
                        #{value}
                      </span>
                    );
                  })}
                </div>
              )}

              {selected.summary && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-500 mb-1">
                    AI要約
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {selected.summary}
                  </p>
                </div>
              )}

              {/* AI対話連携：選択メモ＋周辺メモを渡す */}
              <AIChatPanel
                key={selected.id}
                memo={selected}
                allMemos={memos}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

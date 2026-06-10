"use client";

import { useState } from "react";
import { Memo, RelatedMemo } from "@/types/memo";

type Props = {
  memo: Memo;
  allMemos: Memo[];
};

export default function RelatedMemos({ memo, allMemos }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RelatedMemo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items !== null) return; // キャッシュ
    setLoading(true);
    setError(null);
    try {
      const candidates = allMemos
        .filter((m) => m.id !== memo.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          summary: m.summary,
          tags: m.tags,
          created_at: m.created_at,
        }));

      const res = await fetch("/api/related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: {
            title: memo.title,
            summary: memo.summary,
            tags: memo.tags,
          },
          candidates,
        }),
      });
      if (!res.ok) throw new Error("関連メモの取得に失敗しました");
      const { related } = await res.json();
      setItems(related);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-2">
      <button
        onClick={handleOpen}
        className="text-xs text-indigo-400 hover:text-indigo-600 flex items-center gap-1"
      >
        <span>{open ? "▲" : "▼"}</span>
        類似する過去メモを{open ? "閉じる" : "見る"}
      </button>

      {open && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
          {loading && (
            <p className="text-xs text-gray-400">関連メモを検索中...</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {!loading && !error && items && items.length === 0 && (
            <p className="text-xs text-gray-400">関連するメモは見つかりませんでした</p>
          )}
          {!loading && items && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="bg-white rounded-lg p-2 border border-amber-100"
                >
                  <p className="text-xs font-semibold text-gray-700 truncate">
                    {it.title ?? "(無題)"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {formatDate(it.created_at)}
                  </p>
                  {it.summary && (
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">
                      {it.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

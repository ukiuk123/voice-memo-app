"use client";

import { useState } from "react";
import { Memo, ThoughtChallenge } from "@/types/memo";
import MemoCard from "./MemoCard";
import CalendarFilter from "./CalendarFilter";

type Props = {
  memos: Memo[];
  onDelete: (id: string) => void;
  onUpdate: (updated: Memo) => void;
  activeChallenge?: ThoughtChallenge | null;
};

function parseTag(tag: string): { category: string; value: string } {
  const i = tag.indexOf(":");
  if (i === -1) return { category: "その他", value: tag };
  return { category: tag.slice(0, i), value: tag.slice(i + 1) };
}

function buildTagGroups(memos: Memo[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const memo of memos) {
    for (const tag of memo.tags ?? []) {
      const { category } = parseTag(tag);
      if (!groups.has(category)) groups.set(category, []);
      const arr = groups.get(category)!;
      if (!arr.includes(tag)) arr.push(tag);
    }
  }
  return groups;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function MemoList({ memos, onDelete, onUpdate, activeChallenge }: Props) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTagList, setShowTagList] = useState(false);

  const tagGroups = buildTagGroups(memos);

  const filtered = memos.filter((m) => {
    const matchesTag = selectedTag ? m.tags?.includes(selectedTag) : true;
    const matchesDate = selectedDate
      ? toYMD(new Date(m.created_at)) === selectedDate
      : true;
    const matchesQuery = query.trim()
      ? (() => {
          const q = query.toLowerCase();
          return (
            m.title?.toLowerCase().includes(q) ||
            m.summary?.toLowerCase().includes(q) ||
            m.transcript?.toLowerCase().includes(q) ||
            m.tags?.some((t) => t.toLowerCase().includes(q))
          );
        })()
      : true;
    return matchesTag && matchesDate && matchesQuery;
  });

  const activeFilterCount = [selectedTag, selectedDate, query.trim()].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* 検索バー */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="メモを検索（タイトル・要約・タグ）"
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
            aria-label="クリア"
          >
            ✕
          </button>
        )}
      </div>

      {/* カレンダーフィルター */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
        <button
          onClick={() => setShowCalendar((v) => !v)}
          className="flex items-center justify-between w-full text-xs font-semibold text-gray-500"
        >
          <span className="flex items-center gap-1.5">
            日付で絞り込む
            {selectedDate && (
              <span className="text-[10px] bg-indigo-100 text-indigo-500 rounded-full px-1.5 py-0.5">
                {selectedDate}
              </span>
            )}
          </span>
          <span className="text-gray-300">{showCalendar ? "▲" : "▼"}</span>
        </button>
        {showCalendar && (
          <CalendarFilter
            memos={memos}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
      </div>

      {/* タグ一覧（カテゴリ別） */}
      {tagGroups.size > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
          <button
            onClick={() => setShowTagList((v) => !v)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-500"
          >
            <span className="flex items-center gap-1.5">
              タグで絞り込む
              {selectedTag && (
                <span className="text-[10px] bg-indigo-100 text-indigo-500 rounded-full px-1.5 py-0.5">
                  #{parseTag(selectedTag).value}
                </span>
              )}
            </span>
            <span className="text-gray-300">{showTagList ? "▲" : "▼"}</span>
          </button>

          {showTagList && (
            <div className="space-y-2 pt-1">
              {Array.from(tagGroups.entries()).map(([category, tags]) => (
                <div key={category}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {tags.map((tag) => {
                      const isActive = selectedTag === tag;
                      return (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(isActive ? null : tag)}
                          className={`text-xs rounded-full px-2.5 py-0.5 transition-colors ${
                            isActive
                              ? "bg-indigo-500 text-white"
                              : "bg-indigo-50 text-indigo-500 hover:bg-indigo-100"
                          }`}
                        >
                          #{parseTag(tag).value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* アクティブフィルター解除 */}
      {activeFilterCount > 1 && (
        <button
          onClick={() => { setSelectedTag(null); setSelectedDate(null); setQuery(""); }}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          すべてのフィルターを解除
        </button>
      )}

      {/* メモ一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-300">
          {activeFilterCount > 0 ? (
            <>
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm">条件に一致するメモはありません</p>
            </>
          ) : (
            <>
              <p className="text-4xl mb-3">🎙️</p>
              <p className="text-sm">メモがまだありません</p>
              <p className="text-xs mt-1">上のボタンで録音してみましょう</p>
            </>
          )}
        </div>
      ) : (
        filtered.map((memo) => (
          <MemoCard
            key={memo.id}
            memo={memo}
            onDelete={onDelete}
            onUpdate={onUpdate}
            allMemos={memos}
            activeChallenge={activeChallenge}
          />
        ))
      )}
    </div>
  );
}

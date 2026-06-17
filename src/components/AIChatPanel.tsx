"use client";

import { useRef, useState } from "react";
import { Memo } from "@/types/memo";

type Props = {
  memo: Memo;
  allMemos: Memo[];
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "このアイデアを具体化して",
  "次のステップは？",
  "関連メモとの共通点は？",
];

// タグの重なりで関連メモを軽くスクリーニング（/api/related と同じ考え方）
function tagOverlap(a: string[] | null, b: string[] | null): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hit = 0;
  for (const t of a) if (setB.has(t)) hit += 1;
  return hit / Math.max(a.length, b.length);
}

export default function AIChatPanel({ memo, allMemos }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const buildRelated = () =>
    allMemos
      .filter((m) => m.id !== memo.id)
      .map((m) => ({ m, score: tagOverlap(memo.tags, m.tags) }))
      .sort((a, b) => b.score - a.score)
      .filter((x) => x.score > 0)
      .slice(0, 5)
      .map(({ m }) => ({
        title: m.title,
        summary: m.summary,
        tags: m.tags,
        created_at: m.created_at,
      }));

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const history = messages;
    const next = [...messages, { role: "user" as const, content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          memo: {
            title: memo.title,
            summary: memo.summary,
            transcript: memo.transcript,
            tags: memo.tags,
          },
          related: buildRelated(),
          history,
        }),
      });
      if (!res.ok) throw new Error("AIの応答に失敗しました");
      const { answer } = await res.json();
      setMessages([...next, { role: "assistant", content: answer }]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-violet-500 hover:text-violet-700 flex items-center gap-1"
      >
        <span>{open ? "▲" : "▼"}</span>
        🤖 AIと深掘りする{open ? "（閉じる）" : ""}
      </button>

      {open && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-3">
          {/* 会話ログ */}
          {messages.length > 0 && (
            <div
              ref={scrollRef}
              className="space-y-2 max-h-64 overflow-y-auto pr-1"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <p
                    className={`text-sm leading-relaxed rounded-2xl px-3 py-2 max-w-[85%] whitespace-pre-line ${
                      m.role === "user"
                        ? "bg-violet-500 text-white"
                        : "bg-white text-gray-700 border border-violet-100"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <p className="text-xs text-gray-400">AIが考えています...</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* サジェスト（初回のみ） */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-white text-violet-500 border border-violet-200 rounded-full px-2.5 py-1 hover:bg-violet-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* 入力欄 */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="このメモについて質問する..."
              className="flex-1 text-sm text-gray-700 bg-white border border-violet-200 rounded-xl px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="text-xs text-white bg-violet-500 hover:bg-violet-600 rounded-xl px-3 py-2 transition-colors disabled:opacity-40 shrink-0"
            >
              送信
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

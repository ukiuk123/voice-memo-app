"use client";

import { useState } from "react";

type Props = {
  onSubmit: (text: string) => Promise<void>;
};

export default function TextMemoInput({ onSubmit }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="メモを入力（要約・タグはAIが生成します）"
        rows={5}
        disabled={submitting}
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:opacity-60"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-300">{text.length} 文字</span>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl px-5 py-2 transition-colors flex items-center gap-1.5"
        >
          {submitting && (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {submitting ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

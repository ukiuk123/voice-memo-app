"use client";

import { useState } from "react";
import { Memo } from "@/types/memo";

type Props = {
  memo: Memo;
  onDelete: (id: string) => void;
};

export default function MemoCard({ memo, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (s: number | null) => {
    if (!s) return "";
    return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${s % 60}秒`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatDate(memo.created_at)}</span>
          {memo.duration && (
            <>
              <span>·</span>
              <span>{formatDuration(memo.duration)}</span>
            </>
          )}
        </div>
        <button
          onClick={() => onDelete(memo.id)}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
          aria-label="削除"
        >
          <TrashIcon />
        </button>
      </div>

      {memo.summary && (
        <div className="bg-indigo-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-indigo-500 mb-1">AI要約</p>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {memo.summary}
          </p>
        </div>
      )}

      {memo.transcript && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <span>{expanded ? "▲" : "▼"}</span>
            文字起こしを{expanded ? "折りたたむ" : "表示"}
          </button>
          {expanded && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3">
              {memo.transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

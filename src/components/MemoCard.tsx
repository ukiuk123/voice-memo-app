"use client";

import { useState } from "react";
import { Memo } from "@/types/memo";
import { supabase } from "@/lib/supabase";

type Props = {
  memo: Memo;
  onDelete: (id: string) => void;
  onUpdate: (updated: Memo) => void;
};

export default function MemoCard({ memo, onDelete, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo.transcript ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleEdit = () => {
    setDraft(memo.transcript ?? "");
    setEditing(true);
    setExpanded(true);
    setSaveError(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft(memo.transcript ?? "");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (draft === memo.transcript) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: draft }),
      });
      if (!res.ok) throw new Error("要約に失敗しました");
      const { title, summary, tags } = await res.json();

      const { error } = await supabase
        .from("memos")
        .update({ transcript: draft, title, summary, tags })
        .eq("id", memo.id);
      if (error) throw new Error("保存に失敗しました");

      onUpdate({ ...memo, transcript: draft, title, summary, tags });
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {memo.title && (
            <p className="text-sm font-semibold text-gray-800 truncate mb-0.5">
              {memo.title}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{formatDate(memo.created_at)}</span>
            {memo.duration && (
              <>
                <span>·</span>
                <span>{formatDuration(memo.duration)}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(memo.id)}
          className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
          aria-label="削除"
        >
          <TrashIcon />
        </button>
      </div>

      {memo.tags && memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {memo.tags.map((tag) => {
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

      {memo.summary && (
        <div className="bg-indigo-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-indigo-500 mb-1">AI要約</p>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {memo.summary}
          </p>
        </div>
      )}

      {memo.transcript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => !editing && setExpanded((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <span>{expanded ? "▲" : "▼"}</span>
              文字起こしを{expanded ? "折りたたむ" : "表示"}
            </button>
            {!editing && (
              <button
                onClick={handleEdit}
                className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
              >
                編集
              </button>
            )}
          </div>

          {expanded && !editing && (
            <p className="text-sm text-gray-600 leading-relaxed border-l-2 border-gray-200 pl-3">
              {memo.transcript}
            </p>
          )}

          {editing && (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                className="w-full text-sm text-gray-700 border border-indigo-200 rounded-xl p-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              {saveError && (
                <p className="text-xs text-red-400">{saveError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                  className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  {saving && <SpinnerIcon />}
                  {saving ? "再要約中..." : "保存して再要約"}
                </button>
              </div>
            </div>
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

function SpinnerIcon() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

"use client";

import { useState } from "react";
import { Memo } from "@/types/memo";
import { supabase } from "@/lib/supabase";

type Props = {
  memo: Memo;
  onUpdate: (updated: Memo) => void;
};

function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function suggestDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReminderControl({ memo, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(toInputValue(memo.reminder_date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = memo.reminder_enabled && memo.reminder_date;
  const formatLabel = (iso: string) =>
    new Date(iso).toLocaleString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const persist = async (next: { reminder_date: string | null; reminder_enabled: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from("memos")
        .update(next)
        .eq("id", memo.id);
      if (error) {
        // PostgREST: undefined column などはここで具体メッセージが返る
        throw new Error(`保存失敗: ${error.message}`);
      }
      onUpdate({ ...memo, ...next });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!date) {
      setError("日時を選択してください");
      return;
    }
    const ok = await persist({
      reminder_date: new Date(date).toISOString(),
      reminder_enabled: true,
    });
    if (ok) setOpen(false);
  };

  const handleClear = async () => {
    const ok = await persist({ reminder_date: null, reminder_enabled: false });
    if (ok) {
      setDate("");
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-xs flex items-center gap-1 transition-colors ${
          isActive
            ? "text-amber-600 hover:text-amber-700"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        <span>🔔</span>
        {isActive && memo.reminder_date
          ? `${formatLabel(memo.reminder_date)} に振り返る`
          : "リマインド設定"}
      </button>

      {open && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setDate(suggestDate(1))}
              className="text-[11px] bg-white border border-amber-200 text-amber-600 rounded-full px-2 py-0.5 hover:bg-amber-100"
            >
              明日
            </button>
            <button
              onClick={() => setDate(suggestDate(3))}
              className="text-[11px] bg-white border border-amber-200 text-amber-600 rounded-full px-2 py-0.5 hover:bg-amber-100"
            >
              3日後
            </button>
            <button
              onClick={() => setDate(suggestDate(7))}
              className="text-[11px] bg-white border border-amber-200 text-amber-600 rounded-full px-2 py-0.5 hover:bg-amber-100"
            >
              1週間後
            </button>
            <button
              onClick={() => setDate(suggestDate(30))}
              className="text-[11px] bg-white border border-amber-200 text-amber-600 rounded-full px-2 py-0.5 hover:bg-amber-100"
            >
              1ヶ月後
            </button>
          </div>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-xs text-gray-800 bg-white border border-amber-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 [color-scheme:light]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-between gap-2">
            {isActive && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
              >
                解除
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                閉じる
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !date}
                className="text-xs text-white bg-amber-500 hover:bg-amber-600 rounded-lg px-3 py-1 disabled:opacity-40"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

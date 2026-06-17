"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { Memo } from "@/types/memo";

type Props = {
  memos: Memo[];
  onUpdate: (memo: Memo) => void;
};

// 振り返り通知のチェック間隔（ミリ秒）
const TICK_MS = 15_000;

function subscribeToMinute(callback: () => void) {
  const id = setInterval(callback, TICK_MS);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Math.floor(Date.now() / TICK_MS);
}

function getServerSnapshot() {
  return 0;
}

export default function ReminderInbox({ memos, onUpdate }: Props) {
  const tick = useSyncExternalStore(subscribeToMinute, getSnapshot, getServerSnapshot);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const dismiss = async (memo: Memo) => {
    setDismissing(memo.id);
    // 楽観的に通知を消す（reminder_enabled を false に）
    onUpdate({ ...memo, reminder_enabled: false });
    const { error } = await supabase
      .from("memos")
      .update({ reminder_enabled: false })
      .eq("id", memo.id);
    if (error) {
      // 失敗したら元に戻す
      onUpdate({ ...memo, reminder_enabled: true });
    }
    setDismissing(null);
  };

  const due = useMemo(() => {
    if (tick === 0) return [];
    const now = tick * TICK_MS;
    return memos
      .filter(
        (m) =>
          m.reminder_enabled &&
          m.reminder_date &&
          new Date(m.reminder_date).getTime() <= now,
      )
      .sort(
        (a, b) =>
          new Date(b.reminder_date!).getTime() -
          new Date(a.reminder_date!).getTime(),
      );
  }, [memos, tick]);

  if (due.length === 0) return null;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔔</span>
        <h2 className="text-sm font-semibold text-amber-700">
          振り返りの時間です（{due.length}件）
        </h2>
      </div>
      <ul className="space-y-2">
        {due.slice(0, 5).map((m) => (
          <li
            key={m.id}
            className="bg-white rounded-lg p-2.5 border border-amber-100 flex items-start gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {m.title ?? "(無題)"}
              </p>
              {m.summary && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                  {m.summary}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(m)}
              disabled={dismissing === m.id}
              className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 rounded-full px-3 py-1 transition-colors"
            >
              {dismissing === m.id ? "..." : "わかった"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

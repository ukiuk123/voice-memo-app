"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Memo } from "@/types/memo";

type Props = {
  memos: Memo[];
};

function subscribeToMinute(callback: () => void) {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

function getSnapshot() {
  return Math.floor(Date.now() / 60_000);
}

function getServerSnapshot() {
  return 0;
}

export default function ReminderInbox({ memos }: Props) {
  const minute = useSyncExternalStore(subscribeToMinute, getSnapshot, getServerSnapshot);

  const due = useMemo(() => {
    if (minute === 0) return [];
    const now = minute * 60_000;
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
  }, [memos, minute]);

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
            className="bg-white rounded-lg p-2.5 border border-amber-100"
          >
            <p className="text-sm font-semibold text-gray-800 truncate">
              {m.title ?? "(無題)"}
            </p>
            {m.summary && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                {m.summary}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

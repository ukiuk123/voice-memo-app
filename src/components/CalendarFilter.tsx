"use client";

import { useState } from "react";
import { Memo } from "@/types/memo";

type Props = {
  memos: Memo[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
};

const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarFilter({ memos, selectedDate, onSelectDate }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayStr = toYMD(new Date());

  const counts = new Map<string, number>();
  for (const memo of memos) {
    const d = toYMD(new Date(memo.created_at));
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="text-gray-300 hover:text-gray-500 w-6 text-center text-lg leading-none"
        >
          ‹
        </button>
        <span className="text-xs font-semibold text-gray-600">
          {year}年{month + 1}月
        </span>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="text-gray-300 hover:text-gray-500 w-6 text-center text-lg leading-none"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[10px] ${
              i === 0 ? "text-red-300" : i === 6 ? "text-blue-300" : "text-gray-300"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = counts.get(ds) ?? 0;
          const isSelected = selectedDate === ds;
          const isToday = ds === todayStr;

          return (
            <button
              key={ds}
              onClick={() => onSelectDate(isSelected ? null : ds)}
              className={`
                relative text-[11px] rounded-md py-1 mx-0.5 transition-colors
                ${isSelected
                  ? "bg-indigo-500 text-white font-semibold"
                  : count > 0
                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    : "text-gray-400 hover:bg-gray-50"}
                ${isToday && !isSelected ? "ring-1 ring-inset ring-indigo-300" : ""}
              `}
            >
              {day}
              {count > 0 && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 block w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <p className="text-xs text-gray-400 text-center mt-2">
          {selectedDate} のメモを表示中 ·{" "}
          <button
            onClick={() => onSelectDate(null)}
            className="text-indigo-400 hover:text-indigo-600"
          >
            解除
          </button>
        </p>
      )}
    </div>
  );
}

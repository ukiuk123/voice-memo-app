"use client";

import Link from "next/link";
import { ThoughtChallenge } from "@/types/memo";
import { bossEmoji, clearedCount, remainingLabel } from "@/lib/challenge";

type Props = {
  challenge: ThoughtChallenge;
  // 実際に進行したメモ数（省略時は progress から逆算）
  current?: number;
  // メモ詳細用のコンパクト表示（リンク付きバナー）
  compact?: boolean;
};

// V6: Boss の進行状況バー。/challenges とメモ詳細で共用する。
export default function BossProgress({ challenge, current, compact }: Props) {
  const done = current ?? clearedCount(challenge);
  const target = challenge.target_count;
  const percent = challenge.progress;

  if (compact) {
    return (
      <Link
        href="/challenges"
        className="block bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-3 hover:border-violet-200 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base leading-none">{bossEmoji(challenge.level)}</span>
          <p className="text-xs font-bold text-violet-700 truncate flex-1 min-w-0">
            現在のチャレンジ · Boss Lv.{challenge.level}
          </p>
          <span className="text-[10px] text-violet-400 shrink-0">{percent}%</span>
        </div>
        <p className="text-xs text-gray-600 truncate mb-1.5">{challenge.title}</p>
        <div className="h-1.5 rounded-full bg-violet-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[10px] text-violet-400 mt-1">
          {remainingLabel(done, target)}
        </p>
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-violet-100 p-5">
      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{bossEmoji(challenge.level)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wide">
            Boss Lv.{challenge.level}
          </p>
          <p className="text-sm font-bold text-gray-800 truncate">{challenge.title}</p>
          <p className="text-xs text-gray-400 truncate">#{challenge.theme}</p>
        </div>
        <span className="text-lg font-bold text-violet-600 shrink-0">{percent}%</span>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-violet-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-violet-500 mt-1.5 font-medium">
        {remainingLabel(done, target)}（{done}/{target}）
      </p>
    </div>
  );
}

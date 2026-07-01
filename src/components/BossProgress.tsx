"use client";

import Link from "next/link";
import { ThoughtChallenge } from "@/types/memo";
import {
  bossEmoji,
  bossMaxHp,
  brokenCountOf,
  hpPercentOf,
  hpRemainingOf,
  weaknessCount,
} from "@/lib/challenge";

type Props = {
  challenge: ThoughtChallenge;
  // 崩した弱点数（省略時は progress から逆算）
  broken?: number;
  // メモ詳細用のコンパクト表示（リンク付きバナー）
  compact?: boolean;
};

// V6: Boss の HP バー（RPGバトル）。/challenges とメモ詳細で共用する。
export default function BossProgress({ challenge, broken, compact }: Props) {
  const maxHp = bossMaxHp(challenge);
  const brokenCount = brokenCountOf(challenge, broken);
  const hp = hpRemainingOf(challenge, brokenCount);
  const pct = hpPercentOf(challenge, brokenCount);
  const weaknessesLeft = weaknessCount(challenge) - brokenCount;

  // HP が減るほど赤く（残り多い=エメラルド → 少ない=赤）
  const barColor =
    pct > 60
      ? "from-emerald-400 to-emerald-500"
      : pct > 30
        ? "from-amber-400 to-orange-500"
        : "from-rose-500 to-red-600";

  if (compact) {
    return (
      <Link
        href="/challenges"
        className="block bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-3 hover:border-violet-200 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-base leading-none">{bossEmoji(challenge.level)}</span>
          <p className="text-xs font-bold text-violet-700 truncate flex-1 min-w-0">
            戦闘中 · Boss Lv.{challenge.level}
          </p>
          <span className="text-[10px] font-semibold text-rose-500 shrink-0">
            HP {hp}/{maxHp}
          </span>
        </div>
        <p className="text-xs text-gray-600 truncate mb-1.5">{challenge.title}</p>
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-violet-400 mt-1">
          残り弱点 {weaknessesLeft} 個 · タップして攻撃
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
        <span className="text-sm font-bold text-rose-500 shrink-0">
          HP {hp}/{maxHp}
        </span>
      </div>

      <div className="mt-3 h-3 rounded-full bg-gray-200 overflow-hidden ring-1 ring-gray-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1.5 font-medium">
        {hp > 0 ? `残りの弱点 ${weaknessesLeft} 個を崩せば撃破！` : "撃破！🎉"}
      </p>
    </div>
  );
}

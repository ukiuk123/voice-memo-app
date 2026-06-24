"use client";

import { GardenPlant } from "@/lib/garden";

type Props = {
  plants: GardenPlant[];
  selected: string | null;
  onSelect: (category: string | null) => void;
};

// 成長段階に応じた絵文字サイズ（手前ほど大きく育つ）
const STAGE_SIZE = ["text-3xl", "text-4xl", "text-5xl", "text-6xl"];
const STAGE_LABEL = ["芽", "若葉", "つぼみ", "成熟"];

export default function KnowledgeGarden({ plants, selected, onSelect }: Props) {
  if (plants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-emerald-700/50">
        <p className="text-5xl mb-3">🌱</p>
        <p className="text-sm">タグ付きのメモを残すと、庭が育ちはじめます</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden border border-emerald-100 shadow-sm bg-gradient-to-b from-sky-50 via-emerald-50 to-emerald-100">
      {/* 空と地面 */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-emerald-100/0 to-emerald-200/70" />
      <div className="absolute left-3 top-3 text-2xl select-none">☀️</div>

      {/* 植物群（成長順に並ぶ花壇レイアウト） */}
      <div className="relative flex flex-wrap items-end justify-center gap-x-4 gap-y-2 px-6 pt-16 pb-10 min-h-[260px]">
        {plants.map((p) => {
          const isSel = selected === p.category;
          // hue を使って上下にわずかに揺らし、自然な配置にする（決定的）
          const lift = Math.round(p.hue * 18);
          return (
            <button
              key={p.category}
              onClick={() => onSelect(isSel ? null : p.category)}
              style={{ transform: `translateY(-${lift}px)` }}
              className={`group flex flex-col items-center transition-transform hover:-translate-y-1 focus:outline-none ${
                isSel ? "scale-110" : ""
              }`}
              title={`${p.speciesLabel}（${p.count}メモ・${STAGE_LABEL[p.stage]}）`}
            >
              <span
                className={`${STAGE_SIZE[p.stage]} leading-none drop-shadow-sm ${
                  isSel ? "animate-bounce" : "group-hover:scale-110 transition-transform"
                }`}
              >
                {p.emoji}
              </span>
              <span
                className={`mt-1 max-w-[5.5rem] truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isSel
                    ? "bg-emerald-600 text-white"
                    : "bg-white/70 text-emerald-800"
                }`}
              >
                {p.category}
              </span>
              <span className="text-[9px] text-emerald-700/60">{p.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

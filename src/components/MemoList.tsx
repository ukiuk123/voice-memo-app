"use client";

import { Memo } from "@/types/memo";
import MemoCard from "./MemoCard";

type Props = {
  memos: Memo[];
  onDelete: (id: string) => void;
};

export default function MemoList({ memos, onDelete }: Props) {
  if (memos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-300">
        <p className="text-4xl mb-3">🎙️</p>
        <p className="text-sm">メモがまだありません</p>
        <p className="text-xs mt-1">上のボタンで録音してみましょう</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {memos.map((memo) => (
        <MemoCard key={memo.id} memo={memo} onDelete={onDelete} />
      ))}
    </div>
  );
}

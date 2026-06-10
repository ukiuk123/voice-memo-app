import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

type MemoDigest = {
  id: string;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  created_at: string;
};

type Source = {
  title: string | null;
  summary: string | null;
  tags: string[] | null;
};

function tagScore(a: string[] | null, b: string[] | null): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hit = 0;
  for (const t of a) if (setB.has(t)) hit += 1;
  return hit / Math.max(a.length, b.length);
}

export async function POST(req: NextRequest) {
  const { source, candidates } = (await req.json()) as {
    source: Source;
    candidates: MemoDigest[];
  };

  if (!source || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ related: [] });
  }

  // タグ重なりで一次スクリーニング
  const scored = candidates
    .map((c) => ({ memo: c, score: tagScore(source.tags, c.tags) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  // タグが全く重ならなければ素直に空を返す（LLM呼ばない）
  if (scored.every((s) => s.score === 0)) {
    return NextResponse.json({ related: [] });
  }

  const list = scored
    .map(
      (s, i) =>
        `${i + 1}. id=${s.memo.id} | ${s.memo.title ?? "(無題)"} | ${s.memo.summary ?? ""} | tags: ${(s.memo.tags ?? []).join(", ")}`,
    )
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `次のメモと「内容的に関連する」候補をリストから選び、上位3件のidを返してください。
JSONのみで返答すること。

{
  "related_ids": ["..."]
}

ルール:
- 関連性がなければ空配列を返す。
- 推測しない。明確に話題やテーマが重なる物だけ。`,
      },
      {
        role: "user",
        content: `■対象メモ\nタイトル: ${source.title ?? "(無題)"}\n要約: ${source.summary ?? ""}\nタグ: ${(source.tags ?? []).join(", ")}\n\n■候補\n${list}`,
      },
    ],
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);
  const ids: string[] = Array.isArray(parsed.related_ids)
    ? parsed.related_ids.filter((x: unknown): x is string => typeof x === "string")
    : [];

  const scoreMap = new Map(scored.map((s) => [s.memo.id, s.score]));
  const related = ids
    .map((id) => {
      const c = candidates.find((x) => x.id === id);
      if (!c) return null;
      return {
        id: c.id,
        title: c.title,
        summary: c.summary,
        created_at: c.created_at,
        score: scoreMap.get(c.id) ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ related });
}

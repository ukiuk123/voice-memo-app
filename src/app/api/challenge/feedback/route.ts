import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

// V6: チャレンジ達成時の総評（AIフィードバック）を生成する。
// クリアまとめ（summary）と、良かった点/深掘り/次/関連メモ（feedback）を返す。

type Challenge = {
  theme: string;
  description: string;
  questions: string[];
};

type MemoDigest = {
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  created_at: string;
};

export async function POST(req: NextRequest) {
  const { challenge, memos } = (await req.json()) as {
    challenge: Challenge;
    memos: MemoDigest[];
  };

  if (!challenge || !Array.isArray(memos) || memos.length === 0) {
    return NextResponse.json(
      { error: "チャレンジまたはメモがありません" },
      { status: 400 },
    );
  }

  const digest = memos
    .slice(0, 30)
    .map((m, i) => {
      const date = new Date(m.created_at).toLocaleDateString("ja-JP");
      return `${i + 1}. [${date}] ${m.title ?? "(無題)"} / ${m.summary ?? ""} / tags: ${(m.tags ?? []).join(", ")}`;
    })
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたは思考チャレンジ（Thought Boss）をクリアしたユーザーへ総評を送るコーチです。
チャレンジのテーマと、達成のために書かれた一連のメモをもとに総評を作ります。
以下のJSONのみを返してください。

チャレンジのテーマ: ${challenge.theme}
最初の問い: ${challenge.description}
深掘りの問い:
${challenge.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

ルール：
- メモに書かれた事実だけを根拠にする。推測でメモに無い内容を足さない。
- summary はこのテーマについて整理できたことを称える2〜3文のまとめ。
- good（良かった点）, deepened（特に深掘りできた点）, next（次に考えるべき内容）, related（関連しそうな過去メモや観点）を各1〜2文。
- 敬体（です・ます）で前向きに書く。

{
  "summary": "...",
  "good": "...",
  "deepened": "...",
  "next": "...",
  "related": "..."
}`,
      },
      { role: "user", content: `達成のために書かれたメモ一覧:\n${digest}` },
    ],
    max_tokens: 700,
    temperature: 0.6,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  return NextResponse.json({
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    feedback: {
      good: typeof parsed.good === "string" ? parsed.good : "",
      deepened: typeof parsed.deepened === "string" ? parsed.deepened : "",
      next: typeof parsed.next === "string" ? parsed.next : "",
      related: typeof parsed.related === "string" ? parsed.related : "",
    },
  });
}

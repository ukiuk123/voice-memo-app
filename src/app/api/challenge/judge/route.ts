import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

// V6: 追加メモがチャレンジのテーマを深掘りしているかを判定する（進行判定）。
// 関連していれば進行 +1、関連コメントを返す。

type Challenge = {
  theme: string;
  description: string;
  questions: string[];
};

type CandidateMemo = {
  title: string | null;
  summary: string | null;
  transcript: string | null;
  tags: string[] | null;
};

export async function POST(req: NextRequest) {
  const { challenge, memo } = (await req.json()) as {
    challenge: Challenge;
    memo: CandidateMemo;
  };

  if (!challenge || !memo) {
    return NextResponse.json(
      { error: "チャレンジまたはメモがありません" },
      { status: 400 },
    );
  }

  const memoText = `タイトル: ${memo.title ?? "(無題)"}
要約: ${memo.summary ?? ""}
本文: ${memo.transcript ?? ""}
タグ: ${(memo.tags ?? []).join(", ")}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたは思考チャレンジ（Thought Boss）の進行を判定する審判です。
「チャレンジのテーマ・問い」に対して、新しく書かれたメモがそのテーマを深掘り・具体化しているかを判定します。
以下のJSONのみを返してください。

チャレンジのテーマ: ${challenge.theme}
最初の問い: ${challenge.description}
深掘りの問い:
${challenge.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

ルール：
- メモがテーマや問いのいずれかに実質的に関連していれば relevant = true。
- 全く無関係な話題（別テーマ）なら relevant = false。
- addressed には、このメモが最も答えている問いを問いの文そのままで1つ入れる（該当なければ空文字）。
- note はユーザーへの短い進行コメント（1文・敬体）。relevant=true なら深掘りを称える一言、false なら軽く促す一言。
- メモに無い内容を断定しない。

{
  "relevant": true,
  "addressed": "...",
  "note": "..."
}`,
      },
      { role: "user", content: `新しいメモ:\n${memoText}` },
    ],
    max_tokens: 250,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  return NextResponse.json({
    relevant: parsed.relevant === true,
    addressed: typeof parsed.addressed === "string" ? parsed.addressed : "",
    note: typeof parsed.note === "string" ? parsed.note : "",
  });
}

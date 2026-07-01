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
        content: `あなたは思考チャレンジを「RPGのボス戦」として判定する審判です。
ボスの弱点は下の「弱点リスト」（番号付き）です。プレイヤーが書いたメモ（＝武器）が、
どの弱点を突いているか（＝有効打になっているか）を判定します。
以下のJSONのみを返してください。

ボスのテーマ: ${challenge.theme}
ボスの挑発: ${challenge.description}
弱点リスト:
${challenge.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

ルール：
- メモが弱点リストのいずれかに実質的に答え・深掘りしている場合、その弱点の番号を hits に入れる（1始まりの番号。複数可）。
- どの弱点にも当てはまらないが、テーマ自体には関連している場合は relevant=true・hits=[]。
- テーマと全く無関係なら relevant=false・hits=[]。
- note はバトルの実況コメント（1文・敬体）。有効打なら弱点を突いたことを称え、無関係なら軽く促す。
- メモに無い内容を断定しない。

{
  "relevant": true,
  "hits": [1, 3],
  "note": "..."
}`,
      },
      { role: "user", content: `プレイヤーのメモ（武器）:\n${memoText}` },
    ],
    max_tokens: 250,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  // 1始まりの番号 → 0始まりの index に変換し、範囲外・重複を除く
  const total = challenge.questions.length;
  const hits = Array.isArray(parsed.hits)
    ? [
        ...new Set(
          parsed.hits
            .map((n: unknown) => Number(n) - 1)
            .filter(
              (i: number) => Number.isInteger(i) && i >= 0 && i < total,
            ),
        ),
      ]
    : [];

  return NextResponse.json({
    relevant: parsed.relevant === true || hits.length > 0,
    hits,
    note: typeof parsed.note === "string" ? parsed.note : "",
  });
}

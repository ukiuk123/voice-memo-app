import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

// V6: 起点メモを分析し、思考チャレンジ（Thought Boss）を生成する。
// メモに書かれた内容に応じて問いとステップを変える。

type SeedMemo = {
  title: string | null;
  summary: string | null;
  transcript: string | null;
  tags: string[] | null;
};

export async function POST(req: NextRequest) {
  const { memo } = (await req.json()) as { memo: SeedMemo };

  if (!memo || (!memo.summary && !memo.transcript && !memo.title)) {
    return NextResponse.json({ error: "起点メモがありません" }, { status: 400 });
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
        content: `あなたはユーザーのアイデアを深掘りさせる「思考チャレンジ（Thought Boss）」の出題者です。
渡された1つのメモを起点に、そのアイデアを具体化・発展させるチャレンジを作ります。
以下のJSONのみを返してください。他のテキストは含めないこと。

ルール：
- メモに書かれた内容そのものをテーマにする。関係のない一般論にしない。
- theme はメモの中心テーマを表す短い名詞句（12文字以内）。
- title は少しゲーム的でワクワクするチャレンジ名（20文字以内）。例:「アイデア深掘りの試練」。
- description はユーザーへの最初の投げかけ（問い）を1文。メモ内容に即した具体的な問いにする。例:「このアイデアを実際に使う人は誰ですか？」
- questions はテーマを深めるための問い（ステップ）を3〜5個。内容に応じて次のような観点から選ぶ:ターゲット / 利用シーン / メリット / デメリット / 実現方法 / 必要な機能。各問いは1文の日本語。
- target_count は questions の数に応じた「あと何個メモを書けばクリアか」を表す2〜4の整数。基本は3。
- 敬体（です・ます）で書く。推測でメモに無い事実を断定しない。

{
  "theme": "...",
  "title": "...",
  "description": "...",
  "questions": ["...", "...", "..."],
  "target_count": 3
}`,
      },
      { role: "user", content: `起点メモ:\n${memoText}` },
    ],
    max_tokens: 500,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  const questions: string[] = Array.isArray(parsed.questions)
    ? parsed.questions.filter((q: unknown) => typeof q === "string").slice(0, 5)
    : [];

  // target_count は 2〜4 に丸める。取れなければ questions 数か 3 を採用。
  let target = Number(parsed.target_count);
  if (!Number.isFinite(target)) target = questions.length || 3;
  target = Math.max(2, Math.min(4, Math.round(target)));

  return NextResponse.json({
    theme: typeof parsed.theme === "string" ? parsed.theme : "アイデア",
    title: typeof parsed.title === "string" ? parsed.title : "思考チャレンジ",
    description: typeof parsed.description === "string" ? parsed.description : "",
    questions,
    target_count: target,
  });
}

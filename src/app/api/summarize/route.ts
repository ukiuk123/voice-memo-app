import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();

  if (!transcript) {
    return NextResponse.json({ error: "No transcript" }, { status: 400 });
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `音声メモの文字起こしを分析し、以下のJSON形式のみで返してください。他のテキストは含めないでください。

ルール：
- 文字起こしに明示されている内容だけを使う。言っていないこと・推測・感情の解釈・言外の意図は一切含めない。
- 「〜と感じている」「〜と思われる」「〜かもしれない」のような推測・感情表現は使わない。
- summary は話された事実のみを自然な日本語の短文で2〜3文にまとめる。箇条書きや記号は使わない。
- tags は「カテゴリ:タグ値」形式で3〜5個。カテゴリは「話題」「行動」「場所」「人物」「ツール」のいずれかを使う。文字起こしに実際に言及されたものだけ。

{
  "title": "簡潔なタイトル（15文字以内）",
  "summary": "文字起こしに含まれる事実のみを自然な短文でまとめた要約",
  "tags": ["カテゴリ:タグ値"]
}`,
      },
      { role: "user", content: transcript },
    ],
    max_tokens: 400,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);
  return NextResponse.json({
    title: parsed.title ?? null,
    summary: parsed.summary ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  });
}

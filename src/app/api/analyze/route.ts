import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

type MemoDigest = {
  created_at: string;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
};

export async function POST(req: NextRequest) {
  const { memos } = (await req.json()) as { memos: MemoDigest[] };

  if (!Array.isArray(memos) || memos.length === 0) {
    return NextResponse.json(
      { error: "メモがありません" },
      { status: 400 },
    );
  }

  const digest = memos
    .slice(0, 80)
    .map((m, i) => {
      const date = new Date(m.created_at).toLocaleDateString("ja-JP");
      const tags = (m.tags ?? []).join(", ");
      return `${i + 1}. [${date}] ${m.title ?? "(無題)"} / ${m.summary ?? ""} / tags: ${tags}`;
    })
    .join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたはユーザーの音声メモを分析し、思考傾向や興味分野を可視化するアシスタントです。
渡された複数メモ（日付・タイトル・要約・タグ）から、以下のJSONのみを返してください。

ルール：
- メモに明示的に含まれる事実だけを根拠にする。推測や感情解釈は禁止。
- topics は頻出テーマ（名詞）3〜6個。
- interests は関心が高そうな分野 3〜5個。
- trends は直近のメモで増えている関心 2〜4個。日付に基づいて判断する。
- summary は思考傾向の総括を自然な日本語で2〜3文。

{
  "topics": ["..."],
  "interests": ["..."],
  "trends": ["..."],
  "summary": "..."
}`,
      },
      {
        role: "user",
        content: `以下が直近のメモ一覧です。\n\n${digest}`,
      },
    ],
    max_tokens: 700,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  return NextResponse.json({
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    interests: Array.isArray(parsed.interests) ? parsed.interests : [],
    trends: Array.isArray(parsed.trends) ? parsed.trends : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  });
}

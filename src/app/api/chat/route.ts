import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

type ChatMessage = { role: "user" | "assistant"; content: string };

type MemoContext = {
  title: string | null;
  summary: string | null;
  transcript: string | null;
  tags: string[] | null;
};

type RelatedContext = {
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  created_at: string;
};

export async function POST(req: NextRequest) {
  const { question, memo, related, history } = (await req.json()) as {
    question: string;
    memo: MemoContext;
    related?: RelatedContext[];
    history?: ChatMessage[];
  };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "質問がありません" }, { status: 400 });
  }
  if (!memo) {
    return NextResponse.json({ error: "対象メモがありません" }, { status: 400 });
  }

  const relatedText =
    (related ?? [])
      .map(
        (r, i) =>
          `${i + 1}. ${r.title ?? "(無題)"} | ${r.summary ?? ""} | tags: ${(r.tags ?? []).join(", ")}`,
      )
      .join("\n") || "(関連メモなし)";

  const memoText = `タイトル: ${memo.title ?? "(無題)"}
要約: ${memo.summary ?? ""}
本文: ${memo.transcript ?? ""}
タグ: ${(memo.tags ?? []).join(", ")}`;

  // 会話履歴は直近の往復のみ送る（トークン節約）
  const recentHistory = (history ?? []).slice(-8);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `あなたはユーザーの思考を深める日本語のパートナーです。
ユーザーが選択した「対象メモ」と「関連する過去メモ」をもとに質問へ答えます。

■対象メモ
${memoText}

■関連する過去メモ
${relatedText}

ルール:
- 対象メモと関連メモに書かれている事実を根拠に答える。
- 関連メモから読み取れる傾向があれば指摘する（例:「過去のメモを見ると○○の傾向があります」）。
- アイデアを具体化・発展させる次のステップを必ず1つ以上提案する。
- 簡潔に3〜5文程度で答える。箇条書きは必要な時だけ。
- メモに無い情報を断定しない。推測する場合は推測だと明示する。`,
      },
      ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question.trim() },
    ],
    max_tokens: 600,
    temperature: 0.6,
  });

  const answer = completion.choices[0].message.content ?? "";
  return NextResponse.json({ answer });
}

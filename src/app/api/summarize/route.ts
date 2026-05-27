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
        content:
          "音声メモの文字起こしを3行以内で簡潔に要約してください。要点を箇条書きで整理してください。",
      },
      { role: "user", content: transcript },
    ],
    max_tokens: 300,
  });

  const summary = completion.choices[0].message.content;
  return NextResponse.json({ summary });
}

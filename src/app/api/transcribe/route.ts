import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("audio") as File;

  if (!audio) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 });
  }

  const transcription = await groq.audio.transcriptions.create({
    file: audio,
    model: "whisper-large-v3",
    language: "ja",
  });

  return NextResponse.json({ transcript: transcription.text });
}

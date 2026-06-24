import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";

export async function POST(req: NextRequest) {
  const { transcript, now, timezone } = await req.json();

  if (!transcript) {
    return NextResponse.json({ error: "No transcript" }, { status: 400 });
  }

  // クライアントから現在時刻が渡されなければサーバー時刻で代用
  const nowIso = typeof now === "string" && now ? now : new Date().toISOString();
  const tz = typeof timezone === "string" && timezone ? timezone : "Asia/Tokyo";

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `音声メモの文字起こしを分析し、以下のJSON形式のみで返してください。他のテキストは含めないでください。

現在時刻（UTC・ISO8601）: ${nowIso}
ユーザーのタイムゾーン: ${tz}

ルール：
- 文字起こしに明示されている内容だけを使う。言っていないこと・推測・感情の解釈・言外の意図は一切含めない。
- 「〜と感じている」「〜と思われる」「〜かもしれない」のような推測・感情表現は使わない。
- summary は話された事実のみを自然な日本語の短文で2〜3文にまとめる。箇条書きや記号は使わない。
- tags は「テーマ:大分類」形式で1〜2個だけ。大分類は次の固定リストから内容に最も近いものを選ぶ：仕事 / 学習・研究 / 技術・開発 / 創作・デザイン / 生活・健康 / 人間関係 / お金・買い物 / 趣味・娯楽 / 予定・タスク / その他。このリストにない言葉や、具体名（固有名詞・ツール名・製品名など）はタグにしない。最も中心的なテーマ1個を基本とし、明確に2つの領域にまたがる場合だけ2個まで。判断がつかなければ「テーマ:その他」を使う。
- 日時・期日の手がかりがある場合のみ、リマインドを以下のいずれかで出力する。両方ある必要はなく、無い方は null にする。手がかりが無ければ両方 null。推測で日時を作らない。
  - reminder_offset: 「3分後」「30分後」「1時間後」「2時間半後」「3日後」のような“今からの経過時間”で表された場合に使う。{ "value": 数値, "unit": "minutes" | "hours" | "days" } 形式。例:「1時間後」→ {"value":1,"unit":"hours"}、「90分後」→ {"value":90,"unit":"minutes"}。今からの経過時間でない場合は null。
  - reminder_date: 「明日の15時」「来週月曜」「6月20日」のようなカレンダー上の日時・期日の場合に使う。ISO8601（ユーザーのタイムゾーンのオフセット付き、例: 2026-06-20T15:00:00+09:00）。相対表現は現在時刻とタイムゾーンを基準に絶対日時へ変換する。時刻が示されない日付だけの場合は午前9時（09:00）を補う。今からの経過時間表現の場合は null。

{
  "title": "簡潔なタイトル（15文字以内）",
  "summary": "文字起こしに含まれる事実のみを自然な短文でまとめた要約",
  "tags": ["テーマ:大分類"],
  "reminder_offset": {"value": 数値, "unit": "minutes|hours|days"} または null,
  "reminder_date": "ISO8601の日時 または null"
}`,
      },
      { role: "user", content: transcript },
    ],
    max_tokens: 450,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw);

  // 未来の妥当な日時のときだけ採用する
  let reminderDate: string | null = null;

  // 1) 「3分後 / 1時間後」など今からの経過時間はコード側で正確に計算
  const off = parsed.reminder_offset;
  const UNIT_MS: Record<string, number> = {
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  };
  if (off && typeof off.value === "number" && off.value > 0 && UNIT_MS[off.unit]) {
    const base = new Date(nowIso).getTime();
    if (!Number.isNaN(base)) {
      reminderDate = new Date(base + off.value * UNIT_MS[off.unit]).toISOString();
    }
  }

  // 2) カレンダー上の日時（経過時間が無かった場合のみ）
  if (!reminderDate && typeof parsed.reminder_date === "string") {
    const t = new Date(parsed.reminder_date).getTime();
    if (!Number.isNaN(t) && t > Date.now()) {
      reminderDate = new Date(t).toISOString();
    }
  }

  return NextResponse.json({
    title: parsed.title ?? null,
    summary: parsed.summary ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    reminder_date: reminderDate,
  });
}

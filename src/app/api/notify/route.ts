import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type DueMemo = {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  reminder_date: string;
};

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!configureVapid()) {
    return NextResponse.json(
      { error: "VAPID env vars not configured" },
      { status: 500 },
    );
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("memos")
    .select("id, user_id, title, summary, reminder_date")
    .eq("reminder_enabled", true)
    .lte("reminder_date", nowIso)
    .is("notified_at", null)
    .order("reminder_date", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = (data ?? []) as DueMemo[];
  if (due.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0 });
  }

  let sent = 0;
  const skips: Array<{ id: string; reason: string }> = [];
  const expired: string[] = [];

  for (const memo of due) {
    const { data: subsData, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", memo.user_id);

    const subs = (subsData ?? []) as Subscription[];

    if (subsErr || subs.length === 0) {
      skips.push({ id: memo.id, reason: subsErr?.message ?? "no subscription" });
      continue;
    }

    const payload = JSON.stringify({
      title: `🔔 振り返り: ${memo.title ?? "(無題)"}`,
      body: memo.summary ?? "メモを開いて確認しましょう",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "/",
      tag: `memo-${memo.id}`,
    });

    let anyDelivered = false;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        anyDelivered = true;
      } catch (e) {
        const err = e as { statusCode?: number; body?: string };
        // 410 Gone / 404 Not Found → subscription 失効
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.endpoint);
        } else {
          skips.push({
            id: memo.id,
            reason: `push: ${err.statusCode ?? ""} ${err.body ?? "unknown"}`,
          });
        }
      }
    }

    if (!anyDelivered) continue;

    const { error: updateErr } = await supabase
      .from("memos")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", memo.id);

    if (updateErr) {
      return NextResponse.json(
        { sent, skipped: skips.length, skips, error: `update failed for memo ${memo.id}: ${updateErr.message}` },
        { status: 500 },
      );
    }

    sent += 1;
  }

  // 失効した subscription をDBから消す
  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return NextResponse.json({
    sent,
    skipped: skips.length,
    skips,
    cleaned: expired.length,
  });
}

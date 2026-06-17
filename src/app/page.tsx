"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import RecordButton from "@/components/RecordButton";
import TextMemoInput from "@/components/TextMemoInput";
import MemoList from "@/components/MemoList";
import LoginPage from "@/components/LoginPage";
import ReminderInbox from "@/components/ReminderInbox";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { Memo } from "@/types/memo";

export default function HomePage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"voice" | "text">("voice");

  const fetchMemos = useCallback(async () => {
    const { data, error } = await supabase
      .from("memos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("メモの取得に失敗しました");
      return;
    }
    setMemos(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) fetchMemos();
  }, [session, fetchMemos]);

  const saveMemoFromTranscript = async (transcript: string, duration: number | null) => {
    const summarizeRes = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        now: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    if (!summarizeRes.ok) throw new Error("要約に失敗しました");
    const { title, summary, tags, reminder_date } = await summarizeRes.json();

    const { error: insertError } = await supabase.from("memos").insert({
      user_id: session!.user.id,
      audio_url: null,
      transcript,
      title: title ?? null,
      summary,
      tags: tags ?? [],
      duration,
      // メモ内に未来の日時があれば自動でリマインドON
      reminder_date: reminder_date ?? null,
      reminder_enabled: !!reminder_date,
    });
    if (insertError) throw new Error("メモの保存に失敗しました");

    await fetchMemos();
  };

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, `${Date.now()}.webm`);
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!transcribeRes.ok) throw new Error("文字起こしに失敗しました");
      const { transcript } = await transcribeRes.json();

      await saveMemoFromTranscript(transcript, duration);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleTextSubmit = async (text: string) => {
    setError(null);
    try {
      await saveMemoFromTranscript(text, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("memos").delete().eq("id", id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdate = (updated: Memo) => {
    setMemos((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMemos([]);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-300 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 pb-12">
        {/* Header */}
        <header className="pt-12 pb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight whitespace-nowrap">
              🎙️ VoiceMemo
            </h1>
            <p className="text-xs text-gray-400 truncate min-w-0">
              {session.user.email}
            </p>
          </div>
          <nav className="flex items-center gap-2 mt-3">
            <Link
              href="/map"
              className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              🗺️ マップ
            </Link>
            <Link
              href="/analysis"
              className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              🧠 分析
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap ml-auto"
            >
              ログアウト
            </button>
          </nav>
        </header>

        <div className="mb-4">
          <PushNotificationToggle />
        </div>

        <ReminderInbox memos={memos} onUpdate={handleUpdate} />

        {/* Input Section */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex justify-center gap-1 mb-5 bg-gray-50 rounded-full p-1">
            <button
              onClick={() => setMode("voice")}
              className={`text-xs font-semibold rounded-full px-4 py-1.5 transition-colors ${
                mode === "voice"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              🎙️ 録音
            </button>
            <button
              onClick={() => setMode("text")}
              className={`text-xs font-semibold rounded-full px-4 py-1.5 transition-colors ${
                mode === "text"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              ✏️ 入力
            </button>
          </div>

          <div className="flex flex-col items-center">
            {mode === "voice" ? (
              <RecordButton onRecordingComplete={handleRecordingComplete} />
            ) : (
              <TextMemoInput onSubmit={handleTextSubmit} />
            )}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Memo List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              メモ一覧
            </h2>
            <span className="text-xs text-gray-400">{memos.length}件</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-300 text-sm">
              読み込み中...
            </div>
          ) : (
            <MemoList memos={memos} onDelete={handleDelete} onUpdate={handleUpdate} />
          )}
        </section>
      </div>
    </main>
  );
}

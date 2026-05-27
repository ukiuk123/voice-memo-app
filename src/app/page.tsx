"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import RecordButton from "@/components/RecordButton";
import MemoList from "@/components/MemoList";
import LoginPage from "@/components/LoginPage";
import { supabase } from "@/lib/supabase";
import { Memo } from "@/types/memo";

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    setError(null);
    try {
      // 1. Groqで文字起こし
      const formData = new FormData();
      formData.append("audio", blob, `${Date.now()}.webm`);
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!transcribeRes.ok) throw new Error("文字起こしに失敗しました");
      const { transcript } = await transcribeRes.json();

      // 2. Groqで要約
      const summarizeRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!summarizeRes.ok) throw new Error("要約に失敗しました");
      const { summary } = await summarizeRes.json();

      // 3. Supabaseにメモ保存（user_id付き）
      const { error: insertError } = await supabase.from("memos").insert({
        user_id: session!.user.id,
        audio_url: null,
        transcript,
        summary,
        duration,
      });
      if (insertError) throw new Error("メモの保存に失敗しました");

      await fetchMemos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("memos").delete().eq("id", id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
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
        <header className="pt-12 pb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              🎙️ VoiceMemo
            </h1>
            <p className="text-xs text-gray-400 mt-1">{session.user.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            ログアウト
          </button>
        </header>

        {/* Record Section */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center mb-6">
          <RecordButton onRecordingComplete={handleRecordingComplete} />
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
            <MemoList memos={memos} onDelete={handleDelete} />
          )}
        </section>
      </div>
    </main>
  );
}

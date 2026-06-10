"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { AnalysisResult, Memo } from "@/types/memo";

export default function AnalysisPage() {
  const { session, loading: authLoading } = useSession();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from("memos")
        .select("id, created_at, title, summary, tags")
        .order("created_at", { ascending: false });
      setMemos((data as Memo[]) ?? []);
    })();
  }, [session]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memos: memos.map((m) => ({
            created_at: m.created_at,
            title: m.title,
            summary: m.summary,
            tags: m.tags,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "分析に失敗しました");
      }
      const json = (await res.json()) as AnalysisResult;
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-300 text-sm">読み込み中...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">
          <Link href="/" className="text-indigo-500 underline">
            ログインしてください
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 pb-12">
        <header className="pt-12 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              🧠 AI思考分析
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              過去のメモから興味と傾向を可視化
            </p>
          </div>
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            戻る
          </Link>
        </header>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <p className="text-sm text-gray-600 mb-3">
            保存済みメモ: <strong>{memos.length}件</strong>
          </p>
          <button
            onClick={runAnalysis}
            disabled={loading || memos.length === 0}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
          >
            {loading ? "分析中..." : "AIで分析する"}
          </button>
          {memos.length === 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              先にメモを録音してください
            </p>
          )}
          {error && (
            <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
          )}
        </section>

        {result && (
          <div className="space-y-4">
            <Card title="思考の総括">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {result.summary || "—"}
              </p>
            </Card>

            <Card title="よく出るテーマ">
              <Chips items={result.topics} color="indigo" />
            </Card>

            <Card title="関心分野">
              <Chips items={result.interests} color="emerald" />
            </Card>

            <Card title="最近増えている関心">
              <Chips items={result.trends} color="amber" />
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chips({ items, color }: { items: string[]; color: "indigo" | "emerald" | "amber" }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-gray-400">該当なし</p>;
  }
  const cls = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  }[color];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className={`text-xs rounded-full px-2.5 py-0.5 ${cls}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

type Status = "idle" | "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

export default function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      const permission = Notification.permission;
      if (permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "subscribed" : "unsubscribed");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "service worker error");
          setStatus("unsubscribed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setError(null);
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) throw new Error("VAPID public key 未設定");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("ログインが必要です");

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "subscription保存失敗");
      }

      setStatus("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知の有効化に失敗しました");
      setStatus("unsubscribed");
    }
  };

  const disable = async () => {
    setError(null);
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setStatus("unsubscribed");
        return;
      }

      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }

      setStatus("unsubscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知の無効化に失敗しました");
    }
  };

  if (status === "unsupported") {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500">
        このブラウザは通知に対応していません
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
        通知がブラウザでブロックされています。<br />
        アドレスバー左の鍵アイコン → サイトの設定 → 通知を「許可」に変更してください。
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
      <div className="text-xs">
        <p className="font-semibold text-gray-700">プッシュ通知</p>
        <p className="text-gray-400 mt-0.5">
          {status === "subscribed"
            ? "リマインド時に通知が届きます"
            : "リマインドを通知で受け取る"}
        </p>
        {error && <p className="text-red-400 mt-1">{error}</p>}
      </div>
      {status === "subscribed" ? (
        <button
          onClick={disable}
          className="text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          オフ
        </button>
      ) : (
        <button
          onClick={enable}
          disabled={status === "loading"}
          className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg px-3 py-1.5 transition-colors"
        >
          {status === "loading" ? "..." : "オン"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";

type Props = {
  onRecordingComplete: (blob: Blob, duration: number) => Promise<void>;
};

type RecordingState = "idle" | "recording" | "processing";

export default function RecordButton({ onRecordingComplete }: Props) {
  const [state, setState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunks.current = [];

    recorder.ondataavailable = (e) => chunks.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      stream.getTracks().forEach((t) => t.stop());
      setState("processing");
      try {
        await onRecordingComplete(blob, duration);
      } finally {
        setState("idle");
      }
    };

    recorder.start();
    mediaRecorder.current = recorder;
    startTimeRef.current = Date.now();
    setState("recording");

    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(0);
    mediaRecorder.current?.stop();
  }, []);

  const handleClick = () => {
    if (state === "idle") startRecording();
    else if (state === "recording") stopRecording();
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        disabled={state === "processing"}
        className={`
          w-24 h-24 rounded-full text-white font-bold text-sm shadow-lg
          transition-all duration-200 active:scale-95 disabled:opacity-50
          ${state === "recording"
            ? "bg-red-500 animate-pulse scale-110 shadow-red-300 shadow-xl"
            : state === "processing"
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700"
          }
        `}
      >
        {state === "idle" && (
          <span className="flex flex-col items-center gap-1">
            <MicIcon />
            <span className="text-xs">録音</span>
          </span>
        )}
        {state === "recording" && (
          <span className="flex flex-col items-center gap-1">
            <StopIcon />
            <span className="text-xs">停止</span>
          </span>
        )}
        {state === "processing" && (
          <span className="flex flex-col items-center gap-1">
            <SpinIcon />
            <span className="text-xs">処理中</span>
          </span>
        )}
      </button>

      {state === "recording" && (
        <div className="flex items-center gap-2 text-red-500 font-mono text-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {formatTime(elapsed)}
        </div>
      )}

      {state === "idle" && (
        <p className="text-sm text-gray-400">タップして録音開始</p>
      )}
      {state === "processing" && (
        <p className="text-sm text-gray-400">文字起こし・要約中...</p>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg
      className="w-8 h-8 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

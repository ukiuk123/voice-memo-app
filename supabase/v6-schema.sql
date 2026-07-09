-- =====================================================================
-- V6 migration — Thought Boss（思考チャレンジ）
--
-- メモを分析して AI が「思考チャレンジ（Boss）」を生成し、追加メモで
-- 進行・クリアさせるゲーム的機能。既存テーブル(memos)には一切変更を
-- 加えないため、既存データ・既存機能(V1〜V5)は安全です。
--
-- 適用方法: Supabase SQL Editor にこのファイルを貼り付けて実行。
-- =====================================================================

-- ---- 思考チャレンジ本体 ----------------------------------------------
CREATE TABLE IF NOT EXISTS thought_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- チャレンジの起点になったメモ（種）。削除されても履歴は残す。
  memo_id       UUID REFERENCES memos(id) ON DELETE SET NULL,
  theme         TEXT NOT NULL DEFAULT '',          -- 短いテーマ名（例: 動画編集AI）
  title         TEXT NOT NULL,                      -- Boss タイトル
  description   TEXT NOT NULL DEFAULT '',           -- AI の投げかけ（最初の問い）
  questions     JSONB NOT NULL DEFAULT '[]'::jsonb, -- 深掘りステップ（文字列配列）
  status        TEXT NOT NULL DEFAULT 'active',     -- active | cleared | abandoned
  progress      INTEGER NOT NULL DEFAULT 0,         -- 進行率 0..100
  target_count  INTEGER NOT NULL DEFAULT 3,         -- クリアに必要な追加メモ数
  level         INTEGER NOT NULL DEFAULT 1,         -- Boss Lv.
  summary       TEXT,                               -- クリア時のまとめ
  feedback      JSONB                               -- クリア時の総評 {good, deepened, next, related}
);

CREATE INDEX IF NOT EXISTS idx_thought_challenges_user
  ON thought_challenges (user_id, status, created_at DESC);

ALTER TABLE thought_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thought_challenges_owner" ON thought_challenges
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- チャレンジ進行ログ（どのメモで進んだか） ------------------------
CREATE TABLE IF NOT EXISTS challenge_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  challenge_id  UUID NOT NULL REFERENCES thought_challenges(id) ON DELETE CASCADE,
  memo_id       UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  note          TEXT,                               -- AI の進行コメント（任意）
  UNIQUE (challenge_id, memo_id)                     -- 同じメモで二重に進めない
);

CREATE INDEX IF NOT EXISTS idx_challenge_logs_challenge
  ON challenge_logs (challenge_id);

ALTER TABLE challenge_logs ENABLE ROW LEVEL SECURITY;

-- 親チャレンジが本人のものである場合のみ操作可能（既存の owner 方針を踏襲）
CREATE POLICY "challenge_logs_owner" ON challenge_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM thought_challenges c
      WHERE c.id = challenge_logs.challenge_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM thought_challenges c
      WHERE c.id = challenge_logs.challenge_id AND c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- V6.1 migration — Thought Boss を RPG バトル化
--
-- 攻撃（メモ）が突いたボスの弱点（問い）の index と与ダメージを記録する。
-- 既存 V6 テーブルへのカラム追記のみ。ADD COLUMN IF NOT EXISTS なので
-- 既に V6 を適用済みのプロジェクトでもそのまま実行できる（データ安全）。
-- =====================================================================

-- この攻撃で崩した弱点（questions のインデックス配列。例: [0, 2]）
ALTER TABLE challenge_logs
  ADD COLUMN IF NOT EXISTS hits JSONB NOT NULL DEFAULT '[]'::jsonb;

-- この攻撃で与えたダメージ（＝崩した弱点の数）
ALTER TABLE challenge_logs
  ADD COLUMN IF NOT EXISTS damage INTEGER NOT NULL DEFAULT 1;

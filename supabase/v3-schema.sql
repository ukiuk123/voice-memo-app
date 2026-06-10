-- V3: リマインド機能用カラムを追加
ALTER TABLE memos ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMPTZ;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE memos ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

-- 有効なリマインドの検索を高速化
CREATE INDEX IF NOT EXISTS memos_reminder_idx
  ON memos (user_id, reminder_date)
  WHERE reminder_enabled = TRUE;

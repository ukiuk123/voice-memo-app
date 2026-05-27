-- memos テーブル
CREATE TABLE IF NOT EXISTS memos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audio_url   TEXT,
  transcript  TEXT,
  summary     TEXT,
  duration    INTEGER
);

-- RLS (Row Level Security) を有効化
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが読み書き可能（認証追加時は変更してください）
CREATE POLICY "allow_all" ON memos
  FOR ALL USING (true) WITH CHECK (true);

-- Storage バケット作成（Supabase ダッシュボードで実行するか、以下のSQLで作成）
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT DO NOTHING;

-- Storage RLS
CREATE POLICY "allow_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio');

CREATE POLICY "allow_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio');

-- =====================================================================
-- V4 migration (OPTIONAL / 任意)
--
-- V4 の機能（AI対話・メモマップ）は既存の /api/related を再利用するため、
-- この migration が無くても動作します。
-- 関連度を毎回 LLM で計算する代わりにキャッシュしたい場合のみ適用してください。
-- 既存テーブル(memos)には一切変更を加えません。既存データは安全です。
-- =====================================================================

CREATE TABLE IF NOT EXISTS memo_relations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID NOT NULL,
  memo_id          UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  related_memo_id  UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  similarity_score REAL NOT NULL DEFAULT 0,
  UNIQUE (memo_id, related_memo_id)
);

CREATE INDEX IF NOT EXISTS idx_memo_relations_memo_id ON memo_relations(memo_id);

-- RLS: 自分のメモの関連のみアクセス可能（既存方針を踏襲）
ALTER TABLE memo_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memo_relations_owner" ON memo_relations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

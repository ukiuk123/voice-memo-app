-- =====================================================================
-- V5 migration (OPTIONAL / 任意) — Knowledge Garden（思考の庭）
--
-- /garden の機能は既存の memos.tags から庭をリアルタイムに導出するため、
-- この migration が無くても完全に動作します。
-- 成長スナップショットを永続化・キャッシュしたい場合のみ適用してください。
-- 既存テーブル(memos)には一切変更を加えません。既存データは安全です。
-- =====================================================================

-- ユーザーごとの庭の成長サマリ（任意キャッシュ）
CREATE TABLE IF NOT EXISTS user_growth (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_memos  INTEGER NOT NULL DEFAULT 0,
  garden_level TEXT NOT NULL DEFAULT 'sprout', -- sprout | flower | tree | forest
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_growth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_growth_owner" ON user_growth
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- カテゴリ（タグ）ごとの植物の成長段階（任意キャッシュ）
CREATE TABLE IF NOT EXISTS garden_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,           -- タグ値（例: "AI"）
  growth_stage INTEGER NOT NULL DEFAULT 0, -- 0:芽 1:若葉 2:つぼみ 3:成熟
  memo_count   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_garden_items_user ON garden_items(user_id);

ALTER TABLE garden_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "garden_items_owner" ON garden_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

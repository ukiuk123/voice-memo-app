-- user_id カラムを追加
ALTER TABLE memos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 既存の全許可ポリシーを削除
DROP POLICY IF EXISTS "allow_all" ON memos;

-- 本人のみ操作可能なポリシー
CREATE POLICY "select_own" ON memos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "insert_own" ON memos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON memos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON memos
  FOR DELETE USING (auth.uid() = user_id);

export type Memo = {
  id: string;
  created_at: string;
  user_id: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  duration: number | null;
};

export type MemoInsert = Omit<Memo, "id" | "created_at">;

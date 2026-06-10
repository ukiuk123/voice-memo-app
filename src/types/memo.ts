export type Memo = {
  id: string;
  created_at: string;
  user_id: string;
  audio_url: string | null;
  transcript: string | null;
  title: string | null;
  summary: string | null;
  tags: string[] | null;
  duration: number | null;
  reminder_date: string | null;
  reminder_enabled: boolean;
  notified_at: string | null;
};

export type MemoInsert = Omit<Memo, "id" | "created_at">;

export type AnalysisResult = {
  topics: string[];
  interests: string[];
  trends: string[];
  summary: string;
};

export type RelatedMemo = {
  id: string;
  title: string | null;
  summary: string | null;
  created_at: string;
  score: number;
};

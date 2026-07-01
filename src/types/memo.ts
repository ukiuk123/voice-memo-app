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

// ---- V6: Thought Boss（思考チャレンジ） ----------------------------

export type ChallengeStatus = "active" | "cleared";

// クリア時に AI が返す総評
export type ChallengeFeedback = {
  good: string; // 良かった点
  deepened: string; // 深掘りできた点
  next: string; // 次に考えるべき内容
  related: string; // 関連する過去メモ
};

export type ThoughtChallenge = {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  memo_id: string | null; // 起点になったメモ
  theme: string;
  title: string;
  description: string; // AI の投げかけ（最初の問い）
  questions: string[]; // 深掘りステップ
  status: ChallengeStatus;
  progress: number; // 0..100
  target_count: number; // クリアに必要な追加メモ数
  level: number; // Boss Lv.
  summary: string | null; // クリア時のまとめ
  feedback: ChallengeFeedback | null;
};

export type ChallengeLog = {
  id: string;
  created_at: string;
  challenge_id: string;
  memo_id: string;
  note: string | null;
};

// /api/challenge/generate が返す形
export type GeneratedChallenge = {
  theme: string;
  title: string;
  description: string;
  questions: string[];
  target_count: number;
};

import { Memo } from "@/types/memo";

// =====================================================================
// V5: Knowledge Garden（思考の庭）ロジック
//
// 既存の memos データだけから「庭」を導出する純粋関数群。
// DB 変更・追加テーブルは不要（任意の v5-schema.sql はキャッシュ用途のみ）。
// =====================================================================

// ---- 庭全体のレベル（総メモ数で決まる） ----------------------------

export type GardenLevel = {
  key: "sprout" | "flower" | "tree" | "forest";
  label: string;
  emoji: string;
  min: number; // この段階に入る総メモ数の下限
  next: number | null; // 次段階に必要な総メモ数（最大段階は null）
};

const LEVELS: GardenLevel[] = [
  { key: "sprout", label: "小さな芽", emoji: "🌱", min: 0, next: 5 },
  { key: "flower", label: "花畑", emoji: "🌷", min: 5, next: 20 },
  { key: "tree", label: "木立", emoji: "🌳", min: 20, next: 50 },
  { key: "forest", label: "森", emoji: "🌲", min: 50, next: null },
];

export type GardenLevelInfo = {
  level: GardenLevel;
  total: number;
  toNext: number | null; // 次段階まであと何メモか（最大段階は null）
  progress: number; // 現在段階内の進捗 0..1
};

export function gardenLevelOf(total: number): GardenLevelInfo {
  let level = LEVELS[0];
  for (const l of LEVELS) if (total >= l.min) level = l;

  const toNext = level.next === null ? null : Math.max(0, level.next - total);
  const span = level.next === null ? 1 : level.next - level.min;
  const progress =
    level.next === null ? 1 : Math.min(1, (total - level.min) / span);

  return { level, total, toNext, progress };
}

// ---- カテゴリ（タグ）ごとの植物 ------------------------------------

// タグは "カテゴリ:タグ値" 形式（例 "話題:AI"）。タグ値で植物を区別する。
function tagValue(tag: string): string {
  const i = tag.indexOf(":");
  return (i === -1 ? tag : tag.slice(i + 1)).trim();
}

// 植物の種類（テーマ）。
type Species = { label: string; mature: string };

// 大分類テーマの定義（正規名・キーワード・植物）を1か所に集約。
// 正規化（表記ゆれの吸収）と植物判定の両方をここから導く。
// 新しいタグは "テーマ:大分類" 形式で来る前提だが、旧来の細かいタグ値や
// AIの表記ゆれ（例「買い物」）でもキーワードで正規名に寄せる。
type Theme = { name: string; match: RegExp; species: Species };

const THEMES: Theme[] = [
  { name: "技術・開発", match: /技術|開発|プログラ|コード|ai|機械学習|エンジニア|アプリ/i, species: { label: "技術の木", mature: "🌳" } },
  { name: "学習・研究", match: /学習|研究|勉強|読書|本|授業|レポート|課題|英語|学び/i, species: { label: "学びの木", mature: "🌴" } },
  { name: "創作・デザイン", match: /創作|デザイン|動画|映像|編集|クリエイティ|音楽|絵|写真|art/i, species: { label: "創作の花", mature: "🌸" } },
  { name: "仕事", match: /仕事|業務|会議|ビジネス|営業|プロジェクト|面接/i, species: { label: "仕事の木", mature: "🌲" } },
  { name: "生活・健康", match: /生活|健康|運動|食事|習慣|睡眠|料理|ごはん|ご飯|入浴|風呂|怪我|食|飯/i, species: { label: "暮らしの花", mature: "🌻" } },
  { name: "人間関係", match: /人間|関係|交友|家族|友人|友達|チーム|待ち合わせ/i, species: { label: "つながりの花", mature: "🌷" } },
  { name: "お金・買い物", match: /お金|金銭|買い物|買う|購入|貯金|投資|家計|支払|サブスク/i, species: { label: "やりくりの芽", mature: "🍀" } },
  { name: "趣味・娯楽", match: /趣味|娯楽|ゲーム|遊び|旅行/i, species: { label: "趣味の花", mature: "🌺" } },
  { name: "予定・タスク", match: /予定|タスク|todo|やること|締切|期限|スケジュール/i, species: { label: "予定の竹", mature: "🎋" } },
];

const CANON = new Set([...THEMES.map((t) => t.name), "その他"]);

// タグ値を正規のテーマ名に寄せる。正規名はそのまま、表記ゆれはキーワードで吸収、
// どれにも当たらなければ元の値を保持（むやみに「その他」へ潰さない）。
function normalizeTheme(value: string): string {
  if (CANON.has(value)) return value;
  const t = THEMES.find((th) => th.match.test(value));
  return t ? t.name : value;
}

function speciesFor(value: string): Species {
  const t =
    THEMES.find((th) => th.name === value) ??
    THEMES.find((th) => th.match.test(value));
  return t ? t.species : { label: `${value}の芽`, mature: "🪴" };
}

// 成長段階：そのカテゴリのメモ数で決まる。
// 0:芽 → 1:若葉 → 2:つぼみ/小植物 → 3:成熟（種別の木）
function stageOf(count: number): number {
  if (count >= 10) return 3;
  if (count >= 5) return 2;
  if (count >= 2) return 1;
  return 0;
}

const STAGE_EMOJI = ["🌱", "🌿", "🌷"]; // 0,1,2 は共通。3 は種別の mature を使う。

export type GardenPlant = {
  category: string; // 表示名（タグ値）
  count: number; // このカテゴリのメモ数
  stage: number; // 0..3
  emoji: string; // 表示絵文字
  speciesLabel: string; // 「AIの木」など
  memoIds: string[]; // 関連メモ表示用
  // 決定的な配置のための値（0..1）
  hue: number;
};

// 文字列→安定した数値ハッシュ（配置・色の決定用。乱数を使わない）
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // 0..1
}

export function buildPlants(memos: Memo[]): GardenPlant[] {
  // タグ値 → メモ集合
  const byValue = new Map<string, Set<string>>();
  for (const m of memos) {
    if (!m.tags) continue;
    const seen = new Set<string>();
    for (const tag of m.tags) {
      const v = normalizeTheme(tagValue(tag));
      if (!v || seen.has(v)) continue;
      seen.add(v);
      if (!byValue.has(v)) byValue.set(v, new Set());
      byValue.get(v)!.add(m.id);
    }
  }

  const plants: GardenPlant[] = [];
  for (const [value, ids] of byValue) {
    const count = ids.size;
    const stage = stageOf(count);
    const species = speciesFor(value);
    const emoji = stage >= 3 ? species.mature : STAGE_EMOJI[stage];
    plants.push({
      category: value,
      count,
      stage,
      emoji,
      speciesLabel: species.label,
      memoIds: [...ids],
      hue: hash(value),
    });
  }

  // 大きく育った植物を先に（手前に）並べる。同数なら名前で安定ソート。
  plants.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
  return plants;
}

// ---- 成長履歴（累積メモ数の推移） ----------------------------------

export type GrowthPoint = { date: string; cumulative: number };

export function growthHistory(memos: Memo[]): GrowthPoint[] {
  // 日付（YYYY-MM-DD）ごとの件数を集計し、累積に変換
  const perDay = new Map<string, number>();
  for (const m of memos) {
    const day = m.created_at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const days = [...perDay.keys()].sort();
  let cum = 0;
  return days.map((date) => {
    cum += perDay.get(date)!;
    return { date, cumulative: cum };
  });
}

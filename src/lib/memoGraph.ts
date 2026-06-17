import { Memo } from "@/types/memo";

export type GraphEdge = {
  source: string;
  target: string;
  score: number; // 0..1 関連度
};

export type GraphNode = {
  id: string;
  x: number;
  y: number;
  memo: Memo;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// ---- 関連度の計算 -------------------------------------------------

// タグ一致度（Jaccard 係数）— 優先度1
function tagSimilarity(a: string[] | null, b: string[] | null): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

const STOP = new Set([
  "こと", "もの", "それ", "これ", "ため", "よう", "する", "した", "して",
  "です", "ます", "から", "まで", "など", "ある", "いる", "the", "and", "for",
]);

function tokenize(text: string | null): Set<string> {
  if (!text) return new Set();
  const tokens = text
    .toLowerCase()
    .replace(/[、。,.!?！？「」（）()\n\r]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
  return new Set(tokens);
}

// 内容の類似度（タイトル+要約の語の重なり）— 優先度2
function textSimilarity(a: Memo, b: Memo): number {
  const ta = tokenize(`${a.title ?? ""} ${a.summary ?? ""}`);
  const tb = tokenize(`${b.title ?? ""} ${b.summary ?? ""}`);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

// 総合関連度（タグ優先、内容で補完）
export function similarity(a: Memo, b: Memo): number {
  const tag = tagSimilarity(a.tags, b.tags);
  const text = textSimilarity(a, b);
  return Math.min(1, tag * 0.7 + text * 0.3);
}

const EDGE_THRESHOLD = 0.12;

// ---- 力学レイアウト（Fruchterman-Reingold 風・決定的） ------------

function forceLayout(
  count: number,
  edges: { a: number; b: number; score: number }[],
): { x: number; y: number }[] {
  const k = 140; // 理想距離（小さいほどノード間が近くなる。ノード幅144pxを下回ると重なる）
  const pos = Array.from({ length: count }, (_, i) => {
    // 円周上に決定的に初期配置
    const angle = (2 * Math.PI * i) / Math.max(count, 1);
    const r = k * Math.sqrt(count) * 0.35;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });

  if (count <= 1) return pos;

  const ITER = 300;
  let temp = k * 2;
  const cooling = temp / (ITER + 1);

  for (let step = 0; step < ITER; step++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // 斥力（全ペア）
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = (i - j) * 0.01 + 0.01;
          dy = 0.01;
          dist = Math.hypot(dx, dy);
        }
        const rep = (k * k) / dist;
        const ux = dx / dist;
        const uy = dy / dist;
        disp[i].x += ux * rep;
        disp[i].y += uy * rep;
        disp[j].x -= ux * rep;
        disp[j].y -= uy * rep;
      }
    }

    // 引力（エッジ・関連度が高いほど強く引き寄せる）
    for (const e of edges) {
      const dx = pos[e.a].x - pos[e.b].x;
      const dy = pos[e.a].y - pos[e.b].y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const att = ((dist * dist) / k) * (0.4 + e.score);
      const ux = dx / dist;
      const uy = dy / dist;
      disp[e.a].x -= ux * att;
      disp[e.a].y -= uy * att;
      disp[e.b].x += ux * att;
      disp[e.b].y += uy * att;
    }

    // 中心への重力（散らばり防止・全体をコンパクトに保つ）
    // 値が大きいほど全体が中心に集まり、マップ全体が近く見える
    for (let i = 0; i < count; i++) {
      disp[i].x -= pos[i].x * 0.18;
      disp[i].y -= pos[i].y * 0.18;
    }

    // 変位を temperature で制限して適用
    for (let i = 0; i < count; i++) {
      const d = Math.hypot(disp[i].x, disp[i].y);
      if (d > 0) {
        const limit = Math.min(d, temp);
        pos[i].x += (disp[i].x / d) * limit;
        pos[i].y += (disp[i].y / d) * limit;
      }
    }
    temp = Math.max(temp - cooling, 1);
  }

  return pos;
}

// ---- グラフ構築 ---------------------------------------------------

export function buildGraph(memos: Memo[]): Graph {
  const n = memos.length;
  const rawEdges: { a: number; b: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = similarity(memos[i], memos[j]);
      if (s >= EDGE_THRESHOLD) rawEdges.push({ a: i, b: j, score: s });
    }
  }

  const pos = forceLayout(n, rawEdges);

  const nodes: GraphNode[] = memos.map((m, i) => ({
    id: m.id,
    x: pos[i].x,
    y: pos[i].y,
    memo: m,
  }));

  const edges: GraphEdge[] = rawEdges.map((e) => ({
    source: memos[e.a].id,
    target: memos[e.b].id,
    score: e.score,
  }));

  return { nodes, edges };
}

// 指定メモに直接つながる近傍メモ（AI対話「この周辺」用）
export function neighborsOf(graph: Graph, memoId: string): GraphNode[] {
  const neighborIds = new Set<string>();
  for (const e of graph.edges) {
    if (e.source === memoId) neighborIds.add(e.target);
    else if (e.target === memoId) neighborIds.add(e.source);
  }
  return graph.nodes.filter((n) => neighborIds.has(n.id));
}

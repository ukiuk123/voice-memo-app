"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Memo } from "@/types/memo";
import { buildGraph } from "@/lib/memoGraph";

type Props = {
  memos: Memo[];
  selectedId: string | null;
  onSelect: (memo: Memo) => void;
};

type MemoNodeData = {
  memo: Memo;
  selected: boolean;
};

function tagValue(tag: string): string {
  const i = tag.indexOf(":");
  return i === -1 ? tag : tag.slice(i + 1);
}

function MemoNode({ data }: NodeProps<Node<MemoNodeData>>) {
  const { memo, selected } = data;
  const date = new Date(memo.created_at).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
  return (
    <div
      className={`rounded-xl px-3 py-2 w-36 shadow-sm border text-center transition-colors cursor-pointer ${
        selected
          ? "bg-indigo-500 border-indigo-600 text-white"
          : "bg-white border-gray-200 text-gray-700 hover:border-indigo-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <p className="text-[11px] font-semibold truncate">
        {memo.title ?? "(無題)"}
      </p>
      {memo.tags && memo.tags.length > 0 && (
        <p
          className={`text-[9px] truncate ${selected ? "text-indigo-100" : "text-indigo-500"}`}
        >
          #{tagValue(memo.tags[0])}
          {memo.tags.length > 1 ? ` +${memo.tags.length - 1}` : ""}
        </p>
      )}
      <p className={`text-[9px] ${selected ? "text-indigo-100" : "text-gray-400"}`}>
        {date}
      </p>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { memo: MemoNode };

export default function MemoGraph({ memos, selectedId, onSelect }: Props) {
  const graph = useMemo(() => buildGraph(memos), [memos]);

  const nodes: Node<MemoNodeData>[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "memo",
        position: { x: n.x, y: n.y },
        data: { memo: n.memo, selected: n.id === selectedId },
      })),
    [graph, selectedId],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        // 関連度が高いほど太く・濃く
        style: {
          stroke: "#6366f1",
          strokeWidth: 1 + e.score * 5,
          opacity: 0.2 + e.score * 0.6,
        },
      })),
    [graph],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => {
        const found = memos.find((m) => m.id === node.id);
        if (found) onSelect(found);
      }}
      fitView
      fitViewOptions={{ padding: 0.1, maxZoom: 2 }}
      minZoom={0.2}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} color="#e5e7eb" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-gray-50" />
    </ReactFlow>
  );
}

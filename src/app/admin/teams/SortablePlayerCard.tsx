"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface Props {
  user: { id: string; username: string; email: string };
}

export default function SortablePlayerCard({ user }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: user.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3 cursor-grab hover:bg-zinc-50 transition-colors ${
        isDragging ? "shadow-lg border-[#f5c518] cursor-grabbing" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="text-zinc-400">
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="overflow-hidden">
        <div className="text-sm font-semibold text-zinc-900 truncate">{user.username}</div>
        <div className="text-xs text-zinc-500 truncate">{user.email}</div>
      </div>
    </div>
  );
}

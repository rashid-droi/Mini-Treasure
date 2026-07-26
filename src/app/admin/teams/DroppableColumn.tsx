"use client";

import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

export default function DroppableColumn({ id, title, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-zinc-200 bg-zinc-50 font-bold text-zinc-900 text-sm">
        {title}
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-4 space-y-3 min-h-[300px] transition-colors ${
          isOver ? "bg-[#f5c518]/10" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

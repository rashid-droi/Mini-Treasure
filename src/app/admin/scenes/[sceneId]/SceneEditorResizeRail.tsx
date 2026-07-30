"use client";

import { PanelLeftOpen } from "lucide-react";

type SceneEditorResizeRailProps = {
  sidebarCollapsed: boolean;
  isResizing: boolean;
  onResizeStart: (clientX: number) => void;
  onExpand: () => void;
};

export default function SceneEditorResizeRail({
  sidebarCollapsed,
  isResizing,
  onResizeStart,
  onExpand,
}: SceneEditorResizeRailProps) {
  if (sidebarCollapsed) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="shrink-0 w-5 flex justify-center pt-2 z-20 bg-zinc-100 border-r border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors"
        title="Show object library"
        aria-label="Show object library"
      >
        <PanelLeftOpen className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize object library panel"
      onMouseDown={(e) => onResizeStart(e.clientX)}
      className={`shrink-0 w-1 cursor-col-resize z-20 bg-zinc-200 hover:bg-[#f5c518]/50 transition-colors ${isResizing ? "bg-[#f5c518]/60" : ""}`}
      title="Drag to resize"
    />
  );
}

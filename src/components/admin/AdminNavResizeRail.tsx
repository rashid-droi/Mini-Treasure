"use client";

import { useAdminShell } from "@/components/admin/AdminShellContext";

export default function AdminNavResizeRail() {
  const { onNavResizeStart, isNavResizing } = useAdminShell();

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize admin navigation panel"
      onMouseDown={(e) => onNavResizeStart(e.clientX)}
      className={`hidden md:block shrink-0 sticky top-0 h-screen w-1 cursor-col-resize z-20 bg-zinc-200 hover:bg-[#f5c518]/50 transition-colors ${isNavResizing ? "bg-[#f5c518]/60" : ""}`}
      title="Drag to resize"
    />
  );
}

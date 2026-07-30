"use client";

import AdminSidebar from "@/components/AdminSidebar";
import AdminNavResizeRail from "@/components/admin/AdminNavResizeRail";
import { AdminShellProvider, useAdminShell } from "@/components/admin/AdminShellContext";

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const { navCollapsed } = useAdminShell();

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row text-zinc-900 font-sans overflow-hidden">
      <AdminSidebar />
      {!navCollapsed && <AdminNavResizeRail />}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto relative p-6 md:p-10">
        <div className="relative z-10 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShellProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminShellProvider>
  );
}

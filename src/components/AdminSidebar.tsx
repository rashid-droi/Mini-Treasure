"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  Image as ImageIcon, 
  Users, 
  UserCircle, 
  Trophy, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { lockAdmin } from "@/actions/adminGate";
import { useAdminShell } from "@/components/admin/AdminShellContext";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Scenes", href: "/admin/scenes", icon: ImageIcon },
  { name: "Teams", href: "/admin/teams", icon: Users },
  { name: "Players", href: "/admin/players", icon: UserCircle },
  { name: "Leaderboard", href: "/admin/leaderboard", icon: Trophy },
  { name: "Reports", href: "/admin/reports", icon: BarChart3 },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { navCollapsed, toggleNavCollapsed, navWidthPx, isNavResizing } = useAdminShell();

  return (
    <>
      {/* Desktop: reopen nav when collapsed */}
      {navCollapsed && (
        <button
          type="button"
          onClick={toggleNavCollapsed}
          className="hidden md:flex fixed top-4 left-2 z-50 p-2 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors"
          title="Show admin navigation"
          aria-label="Show admin navigation"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 shadow-sm"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        style={{ width: navWidthPx }}
        className={`fixed md:sticky top-0 left-0 z-40 h-screen shrink-0 bg-white border-r border-zinc-200 transform ease-in-out ${
          isNavResizing ? "" : "transition-all duration-300"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${navCollapsed ? "md:hidden" : ""}`}
      >
        <button
          type="button"
          onClick={toggleNavCollapsed}
          className="hidden md:flex absolute top-3 right-2 z-50 p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
          title="Hide admin navigation"
          aria-label="Hide admin navigation"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-3 px-6 py-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mini Treasure" className="h-14 w-auto" />
        </div>

        <nav className="px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#f5c518]/15 text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-[#c99a00]" : ""}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-8 left-0 right-0 px-8 space-y-2">
          <form action={lockAdmin}>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Lock Panel
            </button>
          </form>
          <Link
            href="/join"
            className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-lg text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Exit Admin
          </Link>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

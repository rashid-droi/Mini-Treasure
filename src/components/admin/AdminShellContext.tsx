"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export const ADMIN_NAV_DEFAULT = 256;
export const ADMIN_NAV_MIN = 180;
export const ADMIN_NAV_MAX = 420;
export const ADMIN_NAV_RAIL_WIDTH = 4;
const ADMIN_NAV_COLLAPSED_KEY = "admin-nav-collapsed";
const ADMIN_NAV_WIDTH_KEY = "admin-nav-width";

type AdminShellContextValue = {
  navCollapsed: boolean;
  toggleNavCollapsed: () => void;
  navWidth: number;
  navWidthPx: number;
  isNavResizing: boolean;
  onNavResizeStart: (clientX: number) => void;
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({ children }: { children: React.ReactNode }) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navWidthPx, setNavWidthPx] = useState(ADMIN_NAV_DEFAULT);
  const [isNavResizing, setIsNavResizing] = useState(false);
  const dragStart = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const savedCollapsed = localStorage.getItem(ADMIN_NAV_COLLAPSED_KEY);
    if (savedCollapsed === "true") setNavCollapsed(true);
    const savedWidth = localStorage.getItem(ADMIN_NAV_WIDTH_KEY);
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (Number.isFinite(w)) {
        setNavWidthPx(Math.min(ADMIN_NAV_MAX, Math.max(ADMIN_NAV_MIN, w)));
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ADMIN_NAV_COLLAPSED_KEY, String(navCollapsed));
    document.documentElement.dataset.adminNavCollapsed = navCollapsed ? "true" : "false";
  }, [navCollapsed]);

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed(v => !v);
  }, []);

  const onNavResizeStart = useCallback((clientX: number) => {
    dragStart.current = { x: clientX, w: navWidthPx };
    setIsNavResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [navWidthPx]);

  useEffect(() => {
    if (!isNavResizing) return;

    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = e.clientX - dragStart.current.x;
      const next = Math.min(ADMIN_NAV_MAX, Math.max(ADMIN_NAV_MIN, dragStart.current.w + delta));
      setNavWidthPx(next);
    };

    const onUp = () => {
      dragStart.current = null;
      setIsNavResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setNavWidthPx(w => {
        localStorage.setItem(ADMIN_NAV_WIDTH_KEY, String(w));
        return w;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isNavResizing]);

  const navWidth = navCollapsed ? 0 : navWidthPx + ADMIN_NAV_RAIL_WIDTH;

  return (
    <AdminShellContext.Provider
      value={{
        navCollapsed,
        toggleNavCollapsed,
        navWidth,
        navWidthPx,
        isNavResizing,
        onNavResizeStart,
      }}
    >
      {children}
    </AdminShellContext.Provider>
  );
}

export function useAdminShell() {
  const ctx = useContext(AdminShellContext);
  if (!ctx) {
    throw new Error("useAdminShell must be used within AdminShellProvider");
  }
  return ctx;
}

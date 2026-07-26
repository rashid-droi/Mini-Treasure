"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Leaflet requires the window object, so we must disable SSR for the actual map
const SceneViewerInternal = dynamic(() => import("./SceneViewerInternal"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-transparent text-[#e8842c]">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  )
});

interface SceneViewerProps {
  sceneId: string; // Used to fetch tiles from /public/tiles/[sceneId]/
  width?: string;
  height?: string;
  foundClues?: { id: string, targetX: number, targetY: number, radius?: number | null, shape?: string | null }[];
  hiddenClues?: { id: string, name: string, targetX: number, targetY: number, radius?: number | null, shape?: string | null }[];
  activeClue?: { id: string, targetX: number, targetY: number } | null;
  hintsUsed?: number;
  clickTolerance?: number;
  isAdmin?: boolean; // show the hotspot circles + toggle (admins only)
  onMapClick?: (x: number, y: number) => void;
  onObjectClick?: (x: number, y: number) => void;
  onAspectRatio?: (ratio: number) => void;
}

export default function SceneViewer(props: SceneViewerProps) {
  return <SceneViewerInternal {...props} />;
}

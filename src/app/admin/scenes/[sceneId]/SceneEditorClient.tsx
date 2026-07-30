"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClue, updateClue, updateClueLocation, deleteClue } from "@/actions/admin/clues";
import { updateSceneClickTolerance, applyHotspotSizeToAllClues } from "@/actions/admin/scenes";
import { OBJECT_LIBRARY } from "@/lib/objectLibrary";
import { Loader2, Plus, Trash2, Crosshair, HelpCircle, FileText, Image as ImageIcon, MapPin, Search, Check, X, Circle as CircleIcon, Square, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAdminShell } from "@/components/admin/AdminShellContext";
import SceneEditorResizeRail from "./SceneEditorResizeRail";

// Dynamically import the Leaflet map to prevent SSR window errors
const AdminSceneEditor = dynamic(() => import("@/components/admin/AdminSceneEditor"), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading Map...</div>
});

const CLUE_TYPES = ["TEXT", "IMAGE", "RIDDLE", "LOCATION", "OBJECT", "QUESTION"];
const SIDEBAR_WIDTH_KEY = "scene-editor-sidebar-width";
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 300;

export default function SceneEditorClient({ scene, initialClues }: { scene: any, initialClues: any[] }) {
  const { navWidth } = useAdminShell();
  const [isDesktop, setIsDesktop] = useState(false);
  const [clues, setClues] = useState(initialClues);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Object library: pick a preset button, then click the photo to place it
  const [sidebarTab, setSidebarTab] = useState<"OBJECTS" | "CLUES">("OBJECTS");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");

  // Clicking an already-placed library object flies the map to its hotspot and
  // highlights it instead of starting a new placement. The signal bumps on each
  // click so re-clicking the same object re-centers the view.
  const [focusedClueId, setFocusedClueId] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  // Toggle behaviour: clicking the object again clears the highlight.
  const focusClue = (id: string) => {
    setSelectedPreset(null);
    setFocusedClueId(prev => (prev === id ? null : id));
    setSelectedClueId(id);
    setFocusSignal(n => n + 1);
  };

  // Picking an unplaced object starts placement mode (and drops any highlight).
  const selectPreset = (item: string) => {
    setFocusedClueId(null);
    setSelectedPreset(prev => (prev === item ? null : item));
  };

  const [newClueCoords, setNewClueCoords] = useState<{x: number, y: number} | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "TEXT",
    points: 100,
    optionsText: "",
    correctAnswer: ""
  });

  // Editing an existing clue: opened by clicking its marker (or sidebar card),
  // pre-filled with the clue's current values including its answer.
  const [defaultRadius, setDefaultRadius] = useState(scene.clickTolerance ?? 5);
  const [editingClueId, setEditingClueId] = useState<string | null>(null);
  // Original hotspot when the editor opened, so Cancel can undo live-preview edits.
  const [editOriginal, setEditOriginal] = useState<{ radius: number; shape: "CIRCLE" | "SQUARE" } | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    type: "TEXT",
    points: 100,
    optionsText: "",
    correctAnswer: "",
    radius: defaultRadius,
    shape: "CIRCLE" as "CIRCLE" | "SQUARE"
  });

  const openClueEditor = (id: string) => {
    const clue = clues.find(c => c.id === id);
    if (!clue) return;
    setSelectedClueId(id);
    setEditingClueId(id);
    setEditOriginal({ radius: clue.radius ?? defaultRadius, shape: (clue.shape ?? "CIRCLE") as "CIRCLE" | "SQUARE" });
    setEditFormData({
      name: clue.name ?? "",
      description: clue.description ?? "",
      type: clue.type ?? "TEXT",
      points: clue.points ?? 100,
      optionsText: (clue.options ?? []).join("\n"),
      correctAnswer: clue.correctAnswer ?? "",
      radius: clue.radius ?? defaultRadius,
      shape: (clue.shape ?? "CIRCLE") as "CIRCLE" | "SQUARE"
    });
  };

  // Close the editor without saving, restoring the pre-edit hotspot size + shape.
  const cancelClueEditor = () => {
    if (editingClueId && editOriginal) {
      const { radius, shape } = editOriginal;
      setClues(prev => prev.map(c => c.id === editingClueId ? { ...c, radius, shape } : c));
    }
    setEditingClueId(null);
  };

  const handleShapeChange = (shape: "CIRCLE" | "SQUARE") => {
    setEditFormData(prev => ({ ...prev, shape }));
    if (editingClueId) {
      setClues(prev => prev.map(c => c.id === editingClueId ? { ...c, shape } : c));
    }
  };

  // Resizing the hotspot updates the form and live-previews on the map by
  // patching the clue in local state (the editor re-renders its circle).
  const handleRadiusChange = (radius: number) => {
    setEditFormData(prev => ({ ...prev, radius }));
    if (editingClueId) {
      setClues(prev => prev.map(c => c.id === editingClueId ? { ...c, radius } : c));
    }
  };

  const defaultRadiusSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDefaultRadiusChange = (radius: number) => {
    setDefaultRadius(radius);
    if (defaultRadiusSaveTimer.current) clearTimeout(defaultRadiusSaveTimer.current);
    defaultRadiusSaveTimer.current = setTimeout(async () => {
      const res = await updateSceneClickTolerance(scene.id, radius);
      if (res.error) toast.error(res.error);
    }, 400);
  };

  const [applyingHotspotSize, setApplyingHotspotSize] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (Number.isFinite(w)) setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w)));
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const onResizeStart = useCallback((clientX: number) => {
    dragStart.current = { x: clientX, w: sidebarWidth };
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = e.clientX - dragStart.current.x;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStart.current.w + delta));
      setSidebarWidth(next);
    };

    const onUp = () => {
      dragStart.current = null;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setSidebarWidth(w => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
        return w;
      });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizing]);

  const handleApplyHotspotToAll = async () => {
    setApplyingHotspotSize(true);
    const res = await applyHotspotSizeToAllClues(scene.id, defaultRadius);
    if (res.error) {
      toast.error(res.error);
    } else {
      setClues(prev => prev.map(c => ({ ...c, radius: null })));
      if (editingClueId) {
        setEditFormData(prev => ({ ...prev, radius: defaultRadius }));
      }
      toast.success(`All ${res.data?.cluesUpdated ?? clues.length} objects set to ${defaultRadius}px`);
    }
    setApplyingHotspotSize(false);
  };

  const handleUpdateClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClueId) return;
    setLoading(true);

    const { optionsText, correctAnswer, radius, shape, ...clueData } = editFormData;
    const res = await updateClue(editingClueId, {
      ...clueData,
      radius: Number.isFinite(radius) ? Math.round(radius) : null,
      shape,
      options: optionsText.split("\n").map(o => o.trim()).filter(Boolean),
      correctAnswer: correctAnswer.trim() || null
    });

    if (res.error || !res.data) {
      toast.error(res.error || "Failed to update clue");
    } else {
      toast.success("Clue updated");
      setClues(prev => prev.map(c => c.id === editingClueId ? { ...c, ...res.data } : c));
      setEditingClueId(null);
    }
    setLoading(false);
  };

  const handleMapClick = (x: number, y: number) => {
    setNewClueCoords({ x, y });
    setFormData({
      name: selectedPreset ?? "",
      description: selectedPreset ? `Find the ${selectedPreset.toLowerCase()} in the scene.` : "",
      type: selectedPreset ? "OBJECT" : "TEXT",
      points: 100,
      optionsText: "",
      correctAnswer: ""
    });
    setIsModalOpen(true);
  };

  const handleCreateClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClueCoords) return;
    setLoading(true);

    const { optionsText, correctAnswer, ...clueData } = formData;
    const res = await createClue(scene.id, {
      ...clueData,
      targetX: newClueCoords.x,
      targetY: newClueCoords.y,
      radius: null, // inherit scene default; fine-tune per object in the editor
      shape: "CIRCLE",
      options: optionsText.split("\n").map(o => o.trim()).filter(Boolean),
      correctAnswer: correctAnswer.trim() || null
    });

    if (res.error || !res.data) {
      toast.error(res.error || "Failed to create clue");
    } else {
      toast.success("Clue created");
      setClues(prev => [...prev, res.data]);
      setIsModalOpen(false);
      setSelectedClueId(res.data.id);
      setSelectedPreset(null);
    }
    setLoading(false);
  };

  const handleUpdateClueCoords = async (id: string, x: number, y: number) => {
    const res = await updateClueLocation(id, x, y);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Location updated");
      setClues(prev => prev.map(c => c.id === id ? { ...c, targetX: x, targetY: y } : c));
    }
  };

  const handleDeleteClue = async (id: string) => {
    if (!confirm("Delete this clue forever?")) return;
    const res = await deleteClue(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Clue deleted");
      setClues(prev => prev.filter(c => c.id !== id));
      if (selectedClueId === id) setSelectedClueId(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TEXT': return <FileText className="w-4 h-4" />;
      case 'IMAGE': return <ImageIcon className="w-4 h-4" />;
      case 'RIDDLE': return <HelpCircle className="w-4 h-4" />;
      case 'LOCATION': return <MapPin className="w-4 h-4" />;
      case 'OBJECT': return <Search className="w-4 h-4" />;
      case 'QUESTION': return <HelpCircle className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const editorLeft = isDesktop ? navWidth : 0;

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-30 flex overflow-hidden bg-[#fafafa] animate-in fade-in duration-500 transition-[left] duration-300"
      style={{ left: editorLeft }}
    >

      {/* Object library sidebar — width is drag-adjustable */}
      {!sidebarCollapsed && (
        <div
          className="shrink-0 h-full relative bg-white border-r border-zinc-200 flex flex-col min-h-0 z-10 shadow-sm"
          style={{ width: sidebarWidth }}
        >
        <button
          type="button"
          onClick={() => setSidebarCollapsed(true)}
          className="absolute top-3 right-2 z-20 p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
          title="Hide object library"
          aria-label="Hide object library"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
        <div className="p-6 border-b border-zinc-200 bg-zinc-50">
          <Link href="/admin/scenes" className="text-sm text-[#e8842c] hover:underline mb-4 inline-block font-medium">&larr; Back to Scenes</Link>
          <h1 className="text-2xl font-black text-zinc-900">{scene.name}</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <Crosshair className="w-4 h-4 shrink-0" />
            {selectedPreset
              ? <>Now click the photo where the <strong className="text-[#c99a00]">{selectedPreset}</strong> is.</>
              : "Pick an object below (or click the map directly), then click the photo to place it."}
          </p>
          {selectedPreset && (
            <button
              onClick={() => setSelectedPreset(null)}
              className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-2 py-1 rounded-md transition-colors"
            >
              <X className="w-3 h-3" /> Cancel placement
            </button>
          )}
          <div className="mt-4 pt-4 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-zinc-600">Default hotspot size</label>
              <span className="text-xs font-mono text-[#a8820a] bg-[#f5c518]/15 px-2 py-0.5 rounded">{Math.round(defaultRadius)} px</span>
            </div>
            <input
              type="range"
              min={2}
              max={80}
              step={1}
              value={defaultRadius}
              onChange={e => handleDefaultRadiusChange(parseInt(e.target.value))}
              className="w-full accent-[#f5c518]"
            />
            <p className="text-xs text-zinc-400 mt-1">Size of dashed circles for objects without a custom hotspot.</p>
            <button
              type="button"
              onClick={handleApplyHotspotToAll}
              disabled={applyingHotspotSize}
              className="mt-2 w-full text-xs font-medium py-2 px-3 rounded-lg border border-[#f5c518]/40 bg-[#f5c518]/10 text-[#a8820a] hover:bg-[#f5c518]/20 disabled:opacity-50 transition-colors"
            >
              {applyingHotspotSize ? "Applying…" : `Apply ${Math.round(defaultRadius)}px to all objects`}
            </button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex border-b border-zinc-200 bg-white">
          <button
            onClick={() => setSidebarTab("OBJECTS")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              sidebarTab === "OBJECTS" ? "text-[#c99a00] border-b-2 border-[#f5c518] bg-[#f5c518]/10" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Object Library
          </button>
          <button
            onClick={() => setSidebarTab("CLUES")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
              sidebarTab === "CLUES" ? "text-[#c99a00] border-b-2 border-[#f5c518] bg-[#f5c518]/10" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Clues ({clues.length})
          </button>
        </div>

        {sidebarTab === "OBJECTS" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                placeholder="Search objects..."
                className="w-full bg-white border border-zinc-300 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
              />
            </div>

            {OBJECT_LIBRARY.map(({ category, items }) => {
              const visible = items.filter(item => item.toLowerCase().includes(librarySearch.toLowerCase()));
              if (visible.length === 0) return null;
              return (
                <div key={category}>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">{category}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {visible.map(item => {
                      const placedClue = clues.find(c => c.name.toLowerCase() === item.toLowerCase());
                      const isPlaced = !!placedClue;
                      const isSelected = selectedPreset === item;
                      const isFocused = isPlaced && focusedClueId === placedClue!.id;
                      return (
                        <button
                          key={item}
                          onClick={() => (isPlaced ? focusClue(placedClue!.id) : selectPreset(item))}
                          title={isPlaced ? "Show this object's hotspot on the map" : undefined}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isSelected
                              ? "bg-[#f5c518] border-[#f5c518] text-zinc-900 shadow-sm"
                              : isFocused
                                ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
                                : isPlaced
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                  : "bg-white border-zinc-200 text-zinc-600 hover:border-[#f5c518] hover:text-zinc-900"
                          }`}
                        >
                          {isPlaced && <Check className="w-3 h-3" />}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sidebarTab === "CLUES" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">

          {clues.map((clue, idx) => (
            <div 
              key={clue.id}
              onClick={() => openClueEditor(clue.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedClueId === clue.id
                  ? 'bg-[#f5c518]/15 border-[#f5c518]'
                  : 'bg-white border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-zinc-100 text-xs flex items-center justify-center font-bold text-zinc-500 border border-zinc-200">{idx + 1}</span>
                  <h4 className="font-bold text-[#b45309]">{clue.name}</h4>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteClue(clue.id); }}
                  className="text-zinc-400 hover:text-rose-500 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs mt-3">
                <span className="flex items-center gap-1 text-zinc-500 bg-zinc-100 px-2 py-1 rounded border border-zinc-200">
                  {getTypeIcon(clue.type)}
                  {clue.type}
                </span>
                <span className="text-[#a8820a] font-bold bg-[#f5c518]/15 px-2 py-1 rounded border border-[#f5c518]/30">{clue.points} pts</span>
              </div>
            </div>
          ))}

          {clues.length === 0 && (
            <div className="text-center py-12 px-4 border border-dashed border-zinc-300 rounded-xl">
              <Crosshair className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No clues yet.<br/>Click the map to add one.</p>
            </div>
          )}
        </div>
        )}
        </div>
      )}

      <SceneEditorResizeRail
        sidebarCollapsed={sidebarCollapsed}
        isResizing={isResizing}
        onResizeStart={onResizeStart}
        onExpand={() => setSidebarCollapsed(false)}
      />

      {/* Main Map Area */}
      <div className="flex-1 min-w-0 relative bg-zinc-100">
        <AdminSceneEditor
          sceneId={scene.id}
          clues={clues}
          clickTolerance={defaultRadius}
          focusClueId={focusedClueId}
          focusSignal={focusSignal}
          layoutRevision={sidebarWidth + (sidebarCollapsed ? 0 : 1000) + editorLeft}
          onAddClue={handleMapClick}
          onUpdateClue={handleUpdateClueCoords}
          onSelectClue={openClueEditor}
        />
      </div>

      {/* New Clue Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">Create New Clue</h2>
            <p className="text-zinc-500 text-sm mb-6 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> 
              At coordinates: {newClueCoords?.x.toFixed(2)}, {newClueCoords?.y.toFixed(2)}
            </p>
            
            <form onSubmit={handleCreateClue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Clue Name</label>
                <input 
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]" 
                  placeholder="e.g. The Golden Idol" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">{formData.type === "QUESTION" ? "Question (shown to players)" : "Description / Riddle Text"}</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] min-h-[80px]" 
                  placeholder="I am heavy but have no weight..." 
                />
              </div>
              {formData.type === "QUESTION" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 mb-1">Answer Options (one per line)</label>
                    <textarea
                      required
                      value={formData.optionsText}
                      onChange={e => setFormData({ ...formData, optionsText: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] min-h-[100px] font-mono text-sm"
                      placeholder={"0\n1\n2\n3\n4"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 mb-1">Correct Answer</label>
                    <select
                      required
                      value={formData.correctAnswer}
                      onChange={e => setFormData({ ...formData, correctAnswer: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                    >
                      <option value="">Select the correct option...</option>
                      {formData.optionsText.split("\n").map(o => o.trim()).filter(Boolean).map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  >
                    {CLUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Points</label>
                  <input 
                    required 
                    type="number" 
                    value={formData.points} 
                    onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]" 
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 rounded-lg transition-colors flex items-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Place Clue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Clue Modal — opened by clicking a clue marker (or sidebar card),
          pre-filled with the clue's current values including its answer. */}
      {editingClueId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
          <div className="bg-white border border-zinc-200 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">Edit Clue</h2>
            <p className="text-zinc-500 text-sm mb-6 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Drag the marker on the map to move it.
            </p>

            <form onSubmit={handleUpdateClue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Clue Name</label>
                <input
                  required
                  type="text"
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  placeholder="e.g. The Golden Idol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">{editFormData.type === "QUESTION" ? "Question (shown to players)" : "Description / Riddle Text"}</label>
                <textarea
                  value={editFormData.description}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] min-h-[80px]"
                  placeholder="I am heavy but have no weight..."
                />
              </div>
              {editFormData.type === "QUESTION" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 mb-1">Answer Options (one per line)</label>
                    <textarea
                      required
                      value={editFormData.optionsText}
                      onChange={e => setEditFormData({ ...editFormData, optionsText: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] min-h-[100px] font-mono text-sm"
                      placeholder={"0\n1\n2\n3\n4"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-600 mb-1">Correct Answer</label>
                    <select
                      required
                      value={editFormData.correctAnswer}
                      onChange={e => setEditFormData({ ...editFormData, correctAnswer: e.target.value })}
                      className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                    >
                      <option value="">Select the correct option...</option>
                      {editFormData.optionsText.split("\n").map(o => o.trim()).filter(Boolean).map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Type</label>
                  <select
                    value={editFormData.type}
                    onChange={e => setEditFormData({ ...editFormData, type: e.target.value })}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  >
                    {CLUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-600 mb-1">Points</label>
                  <input
                    required
                    type="number"
                    value={editFormData.points}
                    onChange={e => setEditFormData({ ...editFormData, points: parseInt(e.target.value) })}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-4 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-600 mb-1">Hotspot Shape</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["CIRCLE", "SQUARE"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleShapeChange(s)}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-all ${
                        editFormData.shape === s
                          ? "bg-[#f5c518]/20 border-[#f5c518] text-[#a8820a]"
                          : "bg-white border-zinc-300 text-zinc-500 hover:border-zinc-400"
                      }`}
                    >
                      {s === "CIRCLE"
                        ? <CircleIcon className="w-4 h-4" />
                        : <Square className="w-4 h-4" />}
                      {s === "CIRCLE" ? "Circle" : "Square"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-zinc-600">Hotspot Size ({editFormData.shape === "SQUARE" ? "half-width" : "click radius"})</label>
                  <span className="text-xs font-mono text-[#a8820a] bg-[#f5c518]/15 px-2 py-0.5 rounded">{Math.round(editFormData.radius)} px</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={120}
                    step={1}
                    value={editFormData.radius}
                    onChange={e => handleRadiusChange(parseInt(e.target.value))}
                    className="flex-1 accent-[#f5c518]"
                  />
                  <input
                    type="number"
                    min={2}
                    max={400}
                    value={editFormData.radius}
                    onChange={e => handleRadiusChange(parseInt(e.target.value) || 0)}
                    className="w-20 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1">Drag to match the object&apos;s size on the map — the dashed circle resizes live. Bigger = easier to click.</p>
              </div>

              <div className="flex justify-between items-center gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => { handleDeleteClue(editingClueId); setEditingClueId(null); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={cancelClueEditor} className="px-4 py-2 text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 rounded-lg transition-colors flex items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

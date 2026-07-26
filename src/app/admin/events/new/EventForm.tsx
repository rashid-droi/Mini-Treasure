"use client";

import { useActionState, useState } from "react";
import { createEvent } from "@/actions/event";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const initialState = { error: "" };

type Scene = {
  id: string;
  name: string;
};

export default function EventForm({ scenes }: { scenes: Scene[] }) {
  const [state, formAction, isPending] = useActionState(createEvent, initialState);
  const [mode, setMode] = useState<"INDIVIDUAL" | "TEAM">("INDIVIDUAL");

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Event Title *</label>
          <input 
            type="text" 
            name="name"
            required 
            placeholder="e.g. Summer Hunt 2026"
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Status *</label>
          <select
            name="status"
            defaultValue="ACTIVE"
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all appearance-none"
          >
            <option value="DRAFT">Draft (Hidden)</option>
            <option value="UPCOMING">Upcoming (Registration Open)</option>
            <option value="ACTIVE">Active (Playing Now)</option>
            <option value="COMPLETED">Completed (Archived)</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Play Mode *</label>
          <input type="hidden" name="mode" value={mode} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("INDIVIDUAL")}
              className={`text-left p-4 rounded-xl border transition-all ${
                mode === "INDIVIDUAL"
                  ? "bg-[#f5c518]/15 border-[#f5c518] shadow-sm"
                  : "bg-white border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <p className="font-semibold text-zinc-900">Individual</p>
              <p className="text-xs text-zinc-500 mt-1">Everyone plays solo. Each player is their own team.</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("TEAM")}
              className={`text-left p-4 rounded-xl border transition-all ${
                mode === "TEAM"
                  ? "bg-emerald-500/10 border-emerald-400 shadow-sm"
                  : "bg-white border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <p className="font-semibold text-zinc-900">Team (Breakout Room)</p>
              <p className="text-xs text-zinc-500 mt-1">Players join shared teams and solve clues together, live.</p>
            </button>
          </div>
        </div>

        {mode === "TEAM" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Max Players per Team</label>
            <input
              type="number"
              name="maxTeamSize"
              min={1}
              placeholder="e.g. 4 (Optional)"
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
            />
            <p className="text-xs text-zinc-500 mt-1">Leave blank for unlimited.</p>
          </div>
        )}

        {mode === "TEAM" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Number of Teams</label>
            <input
              type="number"
              name="teamCount"
              min={1}
              max={50}
              defaultValue={4}
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
            />
            <p className="text-xs text-zinc-500 mt-1">Each team gets its own join code to share. You can view the codes after creating the event.</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Game Duration (Minutes)</label>
          <input 
            type="number" 
            name="gameDuration"
            placeholder="e.g. 60 (Optional)"
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Max Teams</label>
          <input 
            type="number" 
            name="maxTeams"
            placeholder="e.g. 50 (Optional)"
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Scene Selection</label>
          <select 
            name="sceneId"
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all appearance-none"
          >
            <option value="">-- No Scene Selected --</option>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{scene.name}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">An event can only have one scene at a time.</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-zinc-600 uppercase tracking-wider">Description</label>
          <textarea 
            name="description"
            rows={4}
            placeholder="Event details and rules..."
            className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
          />
        </div>
      </div>

      <div className="flex gap-4 justify-end pt-4 border-t border-zinc-200">
        <Link
          href="/admin/events"
          className="px-6 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-medium hover:bg-zinc-50 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 font-semibold rounded-xl px-8 py-3 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : "Create Event"}
        </button>
      </div>
    </form>
  );
}

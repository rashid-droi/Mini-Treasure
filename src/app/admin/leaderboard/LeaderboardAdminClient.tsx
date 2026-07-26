"use client";

import { useState } from "react";
import LiveLeaderboard from "@/components/game/LiveLeaderboard";
import { Trophy } from "lucide-react";

type EventOption = { id: string; name: string; status: string; mode: string };

export default function LeaderboardAdminClient({ events }: { events: EventOption[] }) {
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? "");

  if (events.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center h-64 text-zinc-400 border border-zinc-200 rounded-xl border-dashed">
          No events yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="event-select" className="text-sm font-medium text-zinc-500">
          Event
        </label>
        <select
          id="event-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm font-medium outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[#f5c518]/30 transition"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {ev.mode === "TEAM" ? "Team" : "Individual"} · {ev.status}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden p-6 shadow-sm">
        <h3 className="font-semibold text-zinc-900 flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-[#c99a00]" />
          Standings
        </h3>
        {/* key forces a fresh fetch/animation when the admin switches events */}
        <LiveLeaderboard key={selectedId} eventId={selectedId} light />
      </div>
    </div>
  );
}

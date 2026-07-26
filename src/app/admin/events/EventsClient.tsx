"use client";

import { useState } from "react";
import { updateEventStatus, deleteEvent } from "@/actions/admin/events";
import { Plus, Trash2, Settings, Play, StopCircle, BarChart3, Edit2, Copy, Check, Users } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function EventsClient({ events }: { events: any[] }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Copied ${code}`);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all teams, answers, and leaderboards!")) return;
    const res = await deleteEvent(id);
    if (res.error) toast.error(res.error);
    else toast.success("Event deleted!");
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await updateEventStatus(id, status);
    if (res.error) toast.error(res.error);
    else toast.success("Status updated!");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Events</h1>
          <p className="text-zinc-500 mt-2 text-sm">Manage live game sessions and active rooms.</p>
        </div>
        <Link
          href="/admin/events/new"
          className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-bold">Event Name</th>
                <th className="px-6 py-4 font-bold">Join Code</th>
                <th className="px-6 py-4 font-bold">Scene</th>
                <th className="px-6 py-4 font-bold">Mode</th>
                <th className="px-6 py-4 font-bold">Teams</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900">{event.name}</td>
                  <td className="px-6 py-4">
                    {event.mode === "TEAM" ? (
                      <Link
                        href={`/admin/events/${event.id}/teams`}
                        className="inline-flex items-center gap-1.5 text-sm text-[#a8820a] hover:underline font-medium"
                        title="Team-mode events use per-team codes"
                      >
                        <Users className="w-4 h-4" />
                        Per-team codes
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-700 font-mono text-sm rounded border border-zinc-200">
                          {event.joinCode}
                        </span>
                        <button
                          onClick={() => handleCopyCode(event.joinCode)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                          title="Copy join code"
                          aria-label={`Copy join code ${event.joinCode}`}
                        >
                          {copiedCode === event.joinCode ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">{event.scene?.name || "No Scene"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        event.mode === "TEAM"
                          ? "bg-[#f5c518]/15 text-[#a8820a] border-[#f5c518]/40"
                          : "bg-zinc-100 text-zinc-600 border-zinc-200"
                      }`}
                    >
                      {event.mode === "TEAM" ? "Team" : "Individual"}
                    </span>
                  </td>
                  <td className="px-6 py-4">{event._count.teams}</td>
                  <td className="px-6 py-4 text-center">
                    <select
                      value={event.status}
                      onChange={(e) => handleStatusChange(event.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border outline-none bg-white ${
                        event.status === 'ACTIVE' ? 'text-emerald-600 border-emerald-300' :
                        event.status === 'COMPLETED' ? 'text-zinc-500 border-zinc-300' :
                        'text-amber-600 border-amber-300'
                      }`}
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="UPCOMING">UPCOMING</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {event.mode === "TEAM" && (
                        <Link href={`/admin/events/${event.id}/teams`} className="p-2 text-zinc-400 hover:text-emerald-600 bg-zinc-100 hover:bg-emerald-50 rounded-lg transition-colors" title="Teams & Scores">
                          <Users className="w-4 h-4" />
                        </Link>
                      )}
                      <Link href={`/admin/events/${event.id}/monitor`} className="p-2 text-zinc-400 hover:text-emerald-600 bg-zinc-100 hover:bg-emerald-50 rounded-lg transition-colors" title="Live Monitor">
                        <Play className="w-4 h-4" />
                      </Link>
                      <Link href={`/admin/events/${event.id}/report`} className="p-2 text-zinc-400 hover:text-[#c99a00] bg-zinc-100 hover:bg-[#f5c518]/10 rounded-lg transition-colors" title="Post-Game Report">
                        <BarChart3 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(event.id)} className="p-2 text-zinc-400 hover:text-rose-500 bg-zinc-100 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Event">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                    No events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createTeamForEvent, deleteTeamForEvent, renameTeamForEvent } from "@/actions/admin/eventTeams";
import { Users, Plus, Copy, Check, Trash2, Loader2, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";

type Team = {
  id: string;
  name: string;
  code: string | null;
  members: number;
  score: number;
};

export default function EventTeamsClient({
  eventId,
  maxTeamSize,
  teams,
}: {
  eventId: string;
  maxTeamSize: number | null;
  teams: Team[];
}) {
  const [newName, setNewName] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isPending, startTransition] = useTransition();

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createTeamForEvent(eventId, name);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Created ${name}`);
        setNewName("");
      }
    });
  };

  const startEdit = (team: Team) => {
    setEditingId(team.id);
    setEditingName(team.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const submitEdit = (team: Team) => {
    const name = editingName.trim();
    if (!name || name === team.name) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      const res = await renameTeamForEvent(team.id, eventId, name);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Renamed to ${name}`);
        cancelEdit();
      }
    });
  };

  const handleDelete = (team: Team) => {
    if (!confirm(`Delete "${team.name}"? Its members, answers, and score will be removed.`)) return;
    startTransition(async () => {
      const res = await deleteTeamForEvent(team.id, eventId);
      if (res.error) toast.error(res.error);
      else toast.success(`Deleted ${team.name}`);
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New team name"
          maxLength={40}
          className="flex-1 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[#f5c518]/30 transition"
        />
        <button
          type="submit"
          disabled={isPending || !newName.trim()}
          className="bg-[#f5c518] hover:bg-[#e6b800] disabled:opacity-50 disabled:cursor-not-allowed text-zinc-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Team
        </button>
      </form>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-bold text-center">Rank</th>
                <th className="px-6 py-4 font-bold">Team</th>
                <th className="px-6 py-4 font-bold">Join Code</th>
                <th className="px-6 py-4 font-bold text-right">Score</th>
                <th className="px-6 py-4 font-bold">Members</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {teams.map((team, i) => (
                <tr key={team.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 text-center font-black text-zinc-500">{i + 1}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">
                    {editingId === team.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          value={editingName}
                          maxLength={40}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitEdit(team);
                            else if (e.key === "Escape") cancelEdit();
                          }}
                          className="w-40 px-2 py-1 rounded-md border border-zinc-300 bg-white text-zinc-900 font-medium outline-none focus:border-[#f5c518] focus:ring-2 focus:ring-[#f5c518]/30"
                        />
                        <button
                          type="button"
                          onClick={() => submitEdit(team)}
                          disabled={isPending}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Save name"
                          aria-label="Save name"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1.5 text-zinc-400 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="Cancel"
                          aria-label="Cancel rename"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(team)}
                        className="group inline-flex items-center gap-1.5 text-left hover:text-[#a8820a] transition-colors"
                        title="Rename team"
                      >
                        {team.name}
                        <Pencil className="w-3.5 h-3.5 text-zinc-300 group-hover:text-[#a8820a]" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {team.code ? (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-700 font-mono text-sm rounded border border-zinc-200">
                          {team.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(team.code!)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                          title="Copy join code"
                          aria-label={`Copy join code ${team.code}`}
                        >
                          {copiedCode === team.code ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-zinc-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-lg text-[#a8820a]">{team.score}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Users className="w-4 h-4 text-zinc-400" />
                      {team.members}
                      {maxTeamSize ? ` / ${maxTeamSize}` : ""}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleDelete(team)}
                        disabled={isPending}
                        className="p-2 text-zinc-400 hover:text-rose-500 bg-zinc-100 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete team"
                        aria-label={`Delete ${team.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                    No teams yet. Add one above.
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

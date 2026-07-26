"use client";

import { deleteTeam } from "@/actions/admin/teams";
import { Trash2, Users } from "lucide-react";
import toast from "react-hot-toast";

export default function TeamsClient({ teams }: { teams: any[] }) {
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the team, removing all its players and deleting all its game progress permanently!")) return;
    const res = await deleteTeam(id);
    if (res.error) toast.error(res.error);
    else toast.success("Team deleted!");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Teams</h1>
          <p className="text-zinc-500 mt-2 text-sm">Manage enrolled teams and force disbands if necessary.</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-bold">Team Name</th>
                <th className="px-6 py-4 font-bold">Event</th>
                <th className="px-6 py-4 font-bold text-center">Players</th>
                <th className="px-6 py-4 font-bold text-center">Wrong Attempts</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#c99a00]" />
                    {team.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-100 text-zinc-700 font-medium text-sm rounded border border-zinc-200">
                      {team.event.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">{team._count.participants}</td>
                  <td className="px-6 py-4 text-center">{team.wrongAttempts}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(team.id)} className="p-2 text-zinc-400 hover:text-rose-500 bg-zinc-100 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Team">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                    No teams found.
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

"use client";

import { deleteUser } from "@/actions/admin/users";
import { Trash2, Shield, User } from "lucide-react";
import toast from "react-hot-toast";

export default function PlayersClient({ users }: { users: any[] }) {
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete the user and all their game progress!")) return;
    const res = await deleteUser(id);
    if (res.error) toast.error(res.error);
    else toast.success("User deleted!");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Players & Users</h1>
          <p className="text-zinc-500 mt-2 text-sm">Manage user accounts and admin privileges.</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-bold">Username</th>
                <th className="px-6 py-4 font-bold">Event</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900 flex items-center gap-2">
                    {user.role === 'ADMIN' ? <Shield className="w-4 h-4 text-[#c99a00]" /> : <User className="w-4 h-4 text-zinc-400" />}
                    {user.username}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const events = Array.from(
                        new Set((user.participants ?? []).map((p: any) => p.team?.event?.name).filter(Boolean))
                      );
                      return events.length > 0
                        ? events.join(", ")
                        : <span className="text-zinc-400">—</span>;
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(user.id)} className="p-2 text-zinc-400 hover:text-rose-500 bg-zinc-100 hover:bg-rose-50 rounded-lg transition-colors" title="Delete User">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">
                    No users found.
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

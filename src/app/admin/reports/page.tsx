import Link from "next/link";
import { generateGlobalReport } from "@/actions/reports";
import GlobalReportExport from "@/components/admin/GlobalReportExport";
import { Calendar, Users, UserCircle, Target, Lightbulb, AlertTriangle, Trophy, Medal, Star } from "lucide-react";

const statusStyles: Record<string, string> = {
  ACTIVE: "text-emerald-600 bg-emerald-50 border-emerald-200",
  COMPLETED: "text-zinc-500 bg-zinc-100 border-zinc-200",
  UPCOMING: "text-amber-600 bg-amber-50 border-amber-200",
  DRAFT: "text-amber-600 bg-amber-50 border-amber-200",
};
const medalTint = ["text-[#c99a00]", "text-zinc-400", "text-amber-700"];

export default async function ReportsAdminPage() {
  const res = await generateGlobalReport();

  if ("error" in res) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports &amp; Analytics</h1>
        <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl p-6">
          Failed to load reports: {res.error}
        </div>
      </div>
    );
  }

  const { overview, perEvent, teamLeaderboard, topPlayers } = res;

  const kpis = [
    { label: "Total Events", value: overview.totalEvents, icon: Calendar, tint: "bg-blue-500/10 text-blue-600", sub: `${overview.activeEvents} active · ${overview.completedEvents} completed` },
    { label: "Total Teams", value: overview.totalTeams, icon: Users, tint: "bg-[#f5c518]/15 text-[#c99a00]", sub: "across all events" },
    { label: "Total Players", value: overview.totalPlayers, icon: UserCircle, tint: "bg-orange-500/10 text-[#e8842c]", sub: "registered participants" },
    { label: "Answers Found", value: overview.totalAnswers, icon: Target, tint: "bg-emerald-500/10 text-emerald-600", sub: "correct submissions" },
    { label: "Hints Used", value: overview.totalHints, icon: Lightbulb, tint: "bg-[#f5c518]/15 text-[#c99a00]", sub: "total across teams" },
    { label: "Wrong Clicks", value: overview.totalWrong, icon: AlertTriangle, tint: "bg-rose-500/10 text-rose-500", sub: "total misses" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports &amp; Analytics</h1>
          <p className="text-zinc-500 mt-2 text-sm">Combined statistics across every event, team, and player.</p>
        </div>
        <GlobalReportExport perEvent={perEvent} topPlayers={topPlayers} teamLeaderboard={teamLeaderboard} />
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(({ label, value, icon: Icon, tint, sub }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tint}`}>
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900">{value.toLocaleString()}</h3>
            <p className="text-zinc-500 text-xs font-medium mt-0.5">{label}</p>
            <p className="text-zinc-400 text-[11px] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Per-event summary */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">All Events</h2>
          <span className="text-xs text-zinc-400">{perEvent.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-bold">Event</th>
                <th className="px-6 py-3 font-bold">Scene</th>
                <th className="px-6 py-3 font-bold text-center">Teams</th>
                <th className="px-6 py-3 font-bold text-center">Players</th>
                <th className="px-6 py-3 font-bold text-center">Answers</th>
                <th className="px-6 py-3 font-bold">Winner</th>
                <th className="px-6 py-3 font-bold text-center">Status</th>
                <th className="px-6 py-3 font-bold text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {perEvent.map((e) => (
                <tr key={e.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900">{e.name}</td>
                  <td className="px-6 py-4">{e.scene}</td>
                  <td className="px-6 py-4 text-center">{e.teams}</td>
                  <td className="px-6 py-4 text-center">{e.players}</td>
                  <td className="px-6 py-4 text-center">
                    {e.solved}
                    {e.totalClues > 0 && <span className="text-zinc-400 text-xs"> / {e.totalClues}</span>}
                  </td>
                  <td className="px-6 py-4">
                    {e.winner ? (
                      <span className="flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-[#c99a00]" />
                        <span className="font-medium text-zinc-900">{e.winner}</span>
                        <span className="text-zinc-400 text-xs">({e.winnerScore})</span>
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyles[e.status] ?? statusStyles.DRAFT}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/events/${e.id}/report`} className="text-[#e8842c] hover:underline text-sm font-medium">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {perEvent.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-400">No events yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global team leaderboard */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#c99a00]" /> Team Leaderboard
            </h2>
          </div>
          {teamLeaderboard.length > 0 ? (
            <ul className="divide-y divide-zinc-200">
              {teamLeaderboard.map((t) => (
                <li key={`${t.rank}-${t.team}`} className="flex items-center gap-3 px-6 py-3">
                  <span className="w-6 flex justify-center shrink-0">
                    {t.rank <= 3 ? <Medal className={`w-5 h-5 ${medalTint[t.rank - 1]}`} /> : <span className="text-sm font-bold text-zinc-400">{t.rank}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 truncate">{t.team}</p>
                    <p className="text-xs text-zinc-400 truncate">{t.event} · {t.time}</p>
                  </div>
                  <span className="font-bold text-zinc-900 shrink-0">{t.score.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-40 flex items-center justify-center text-zinc-400 text-sm">No scores yet.</div>
          )}
        </div>

        {/* Top players */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-[#c99a00]" /> Most Active Players
            </h2>
          </div>
          {topPlayers.length > 0 ? (
            <ul className="divide-y divide-zinc-200">
              {topPlayers.map((p) => (
                <li key={`${p.rank}-${p.username}`} className="flex items-center gap-3 px-6 py-3">
                  <span className="w-6 flex justify-center shrink-0 text-sm font-bold text-zinc-400">{p.rank}</span>
                  <p className="font-semibold text-zinc-900 truncate flex-1">{p.username}</p>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md text-xs shrink-0">
                    {p.cluesFound} found
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-40 flex items-center justify-center text-zinc-400 text-sm">No player activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

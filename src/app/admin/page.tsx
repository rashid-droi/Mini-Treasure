import prisma from "@/lib/prisma";
import DashboardActivityChart from "@/components/admin/DashboardActivityChart";
import { Calendar, Users, UserCircle, Target, Trophy, Medal } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminDashboard() {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [
    activeEvents,
    totalEvents,
    totalTeams,
    totalPlayers,
    answersSubmitted,
    teamsThisWeek,
    playersThisWeek,
    answersThisWeek,
    recentAnswers,
    topTeams,
    recentEvents,
  ] = await Promise.all([
    prisma.event.count({ where: { status: "ACTIVE" } }),
    prisma.event.count(),
    prisma.team.count(),
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
    prisma.teamAnswer.count(),
    prisma.team.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { role: "PARTICIPANT", createdAt: { gte: weekAgo } } }),
    prisma.teamAnswer.count({ where: { foundAt: { gte: weekAgo } } }),
    prisma.teamAnswer.findMany({ where: { foundAt: { gte: weekAgo } }, select: { foundAt: true } }),
    prisma.leaderboard.findMany({
      orderBy: [{ score: "desc" }, { completionTimeMs: "asc" }],
      include: { team: { select: { name: true } }, event: { select: { name: true } } },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { teams: true } }, scene: { select: { name: true } } },
    }),
  ]);

  // Bucket the week's answers into 7 daily counts for the activity chart.
  const chartLabels: string[] = [];
  const chartData = new Array(7).fill(0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startToday.getTime() - i * DAY_MS);
    chartLabels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
  }
  for (const a of recentAnswers) {
    const ad = new Date(a.foundAt);
    ad.setHours(0, 0, 0, 0);
    const idx = 6 - Math.round((startToday.getTime() - ad.getTime()) / DAY_MS);
    if (idx >= 0 && idx < 7) chartData[idx]++;
  }

  // Group the leaderboard rows by event so the dashboard shows each event's own
  // standings instead of one mixed list. Rows arrive already score-desc, so each
  // group is ranked; order the groups by their top score.
  const scoresByEvent = (() => {
    const map = new Map<string, { eventId: string; eventName: string; rows: typeof topTeams }>();
    for (const row of topTeams) {
      const g = map.get(row.eventId) ?? { eventId: row.eventId, eventName: row.event.name, rows: [] as typeof topTeams };
      g.rows.push(row);
      map.set(row.eventId, g);
    }
    return [...map.values()].sort((a, b) => (b.rows[0]?.score ?? 0) - (a.rows[0]?.score ?? 0));
  })();

  const stats = [
    {
      label: "Active Events",
      value: activeEvents.toLocaleString(),
      icon: Calendar,
      tint: "bg-blue-500/10 text-blue-600",
      sub: `${totalEvents.toLocaleString()} total`,
      subTone: "text-zinc-400",
    },
    {
      label: "Total Teams",
      value: totalTeams.toLocaleString(),
      icon: Users,
      tint: "bg-[#f5c518]/15 text-[#c99a00]",
      sub: teamsThisWeek > 0 ? `+${teamsThisWeek} this week` : "No change this week",
      subTone: teamsThisWeek > 0 ? "text-emerald-600" : "text-zinc-400",
    },
    {
      label: "Total Players",
      value: totalPlayers.toLocaleString(),
      icon: UserCircle,
      tint: "bg-orange-500/10 text-[#e8842c]",
      sub: playersThisWeek > 0 ? `+${playersThisWeek} this week` : "No change this week",
      subTone: playersThisWeek > 0 ? "text-emerald-600" : "text-zinc-400",
    },
    {
      label: "Answers Submitted",
      value: answersSubmitted.toLocaleString(),
      icon: Target,
      tint: "bg-emerald-500/10 text-emerald-600",
      sub: answersThisWeek > 0 ? `+${answersThisWeek} this week` : "No change this week",
      subTone: answersThisWeek > 0 ? "text-emerald-600" : "text-zinc-400",
    },
  ];

  const statusStyles: Record<string, string> = {
    ACTIVE: "text-emerald-600 bg-emerald-50 border-emerald-200",
    COMPLETED: "text-zinc-500 bg-zinc-100 border-zinc-200",
    UPCOMING: "text-amber-600 bg-amber-50 border-amber-200",
    DRAFT: "text-amber-600 bg-amber-50 border-amber-200",
  };
  const medalTint = ["text-[#c99a00]", "text-zinc-400", "text-amber-700"];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard Overview</h1>
        <p className="text-zinc-500 mt-2 text-sm">Monitor your event&apos;s realtime performance and statistics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, tint, sub, subTone }) => (
          <div key={label} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-zinc-500 text-sm font-medium">{label}</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 mt-3">{value}</h3>
            <p className={`text-xs mt-2 font-medium ${subTone}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Activity chart + Top teams */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900">Activity Over Time</h3>
            <span className="text-xs text-zinc-400">Answers found · last 7 days</span>
          </div>
          <DashboardActivityChart labels={chartLabels} data={chartData} />
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-[#c99a00]" />
            Team Scores
            {scoresByEvent.length > 0 && (
              <span className="ml-auto text-xs font-medium text-zinc-400">
                {scoresByEvent.length} event{scoresByEvent.length > 1 ? "s" : ""}
              </span>
            )}
          </h3>
          {scoresByEvent.length > 0 ? (
            <div className="space-y-5 max-h-80 overflow-y-auto pr-1">
              {scoresByEvent.map((group) => (
                <div key={group.eventId}>
                  <div className="flex items-center justify-between mb-2 sticky top-0 bg-white py-0.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#a8820a] truncate">
                      {group.eventName}
                    </p>
                    <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
                      {group.rows.length} team{group.rows.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {group.rows.map((row, i) => (
                      <li key={row.id} className="flex items-center gap-3">
                        <span className="w-6 flex justify-center">
                          {i < 3 ? (
                            <Medal className={`w-5 h-5 ${medalTint[i]}`} />
                          ) : (
                            <span className="text-sm font-bold text-zinc-400">{i + 1}</span>
                          )}
                        </span>
                        <p className="min-w-0 flex-1 font-semibold text-zinc-900 truncate">{row.team.name}</p>
                        <span className="font-bold text-zinc-900 shrink-0">{row.score.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-zinc-400 text-sm">
              No scores yet.
            </div>
          )}
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-200">
          <h3 className="font-semibold text-zinc-900">Recent Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-bold">Event</th>
                <th className="px-6 py-3 font-bold">Scene</th>
                <th className="px-6 py-3 font-bold text-center">Teams</th>
                <th className="px-6 py-3 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {recentEvents.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900">{event.name}</td>
                  <td className="px-6 py-4">{event.scene?.name ?? "No Scene"}</td>
                  <td className="px-6 py-4 text-center">{event._count.teams}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusStyles[event.status] ?? statusStyles.DRAFT}`}>
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-400">
                    No events yet.
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

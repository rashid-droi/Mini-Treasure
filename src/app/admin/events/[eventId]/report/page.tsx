import { generateEventReport } from "@/actions/reports";
import { Trophy, Target, AlertTriangle, Users, Medal, Star, Lightbulb } from "lucide-react";
import Link from "next/link";
import ReportExportButtons from "@/components/admin/ReportExportButtons";

export default async function EventReportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const res = await generateEventReport(eventId);

  if (res.error || !res.teams) {
    return <div className="p-8 text-zinc-900 bg-[#fafafa] min-h-screen">Failed to load report: {res.error}</div>;
  }

  const { event, teams, totalClues } = res;

  return (
    <div className="min-h-screen bg-[#fafafa] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-[#c99a00]" />
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Post-Game Report</h1>
          </div>
          <p className="text-zinc-500 mt-2">Analytics for Event: <span className="text-zinc-900 font-medium">{event.name}</span></p>
        </div>
        <div className="flex items-center gap-4">
          <ReportExportButtons event={event} teams={teams} totalClues={totalClues} />
          <Link
            href="/admin/events"
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors"
          >
            Back to Events
          </Link>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden mb-8 shadow-sm">
        <div className="p-6 bg-zinc-50 border-b border-zinc-200">
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Medal className="w-5 h-5 text-[#c99a00]" />
            Team Rankings & Analytics
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-zinc-700">
            <thead className="text-xs uppercase bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-bold">Rank</th>
                <th className="px-6 py-4 font-bold">Team Name</th>
                <th className="px-6 py-4 font-bold text-center">Score</th>
                <th className="px-6 py-4 font-bold text-center">Completion</th>
                <th className="px-6 py-4 font-bold text-center">Accuracy</th>
                <th className="px-6 py-4 font-bold text-center">Mistakes</th>
                <th className="px-6 py-4 font-bold text-center">Hints</th>
                <th className="px-6 py-4 font-bold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {teams.map((team, idx) => (
                <tr key={team.id} className={`hover:bg-zinc-50 transition-colors ${idx === 0 ? "bg-[#f5c518]/5" : ""}`}>
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                      idx === 0 ? "bg-[#f5c518] text-zinc-900" :
                      idx === 1 ? "bg-zinc-300 text-zinc-900" :
                      idx === 2 ? "bg-amber-700 text-white" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {idx + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{team.name}</td>
                  <td className="px-6 py-4 text-center font-black text-[#c99a00] text-lg">{team.score}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-emerald-600">{team.completionPercent}%</span>
                      <span className="text-xs text-zinc-400">{team.solvedClues} / {totalClues}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Target className={`w-4 h-4 ${team.accuracy > 80 ? 'text-emerald-600' : team.accuracy > 50 ? 'text-amber-600' : 'text-rose-500'}`} />
                      <span className="font-bold">{team.accuracy}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-rose-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-bold">{team.wrongAttempts}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-[#c99a00]">
                      <Lightbulb className="w-4 h-4" />
                      <span className="font-bold">{team.hintsUsed}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-zinc-500">
                    {team.timeTaken}
                  </td>
                </tr>
              ))}

              {teams.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-400">
                    No teams have participated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Player MVPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <div key={`mvp-${team.id}`} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-zinc-900 flex items-center gap-2 mb-4 pb-4 border-b border-zinc-200">
              <Users className="w-5 h-5 text-[#c99a00]" />
              {team.name} Activity
            </h3>

            {team.topPlayers.length > 0 ? (
              <div className="space-y-3">
                {team.topPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <span className="text-zinc-700 font-medium flex items-center gap-2">
                      {idx === 0 && <Star className="w-4 h-4 text-[#c99a00]" />}
                      {player.username}
                    </span>
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md text-xs">
                      {player.cluesFound} Clues Found
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm italic text-center py-4">
                No individual player data available.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

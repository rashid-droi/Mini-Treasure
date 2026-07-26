"use client";

import { Download } from "lucide-react";

type PerEvent = {
  name: string; status: string; scene: string; teams: number;
  players: number; solved: number; totalClues: number; winner: string | null; winnerScore: number;
};
type Player = { rank: number; username: string; cluesFound: number };
type TeamRow = { rank: number; team: string; event: string; score: number; time: string };

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function GlobalReportExport({
  perEvent,
  topPlayers,
  teamLeaderboard,
}: {
  perEvent: PerEvent[];
  topPlayers: Player[];
  teamLeaderboard: TeamRow[];
}) {
  const handleExport = () => {
    const rows: (string | number)[][] = [];
    rows.push(["EVENTS"]);
    rows.push(["Event", "Status", "Scene", "Teams", "Players", "Answers Found", "Total Clues", "Winner", "Winner Score"]);
    perEvent.forEach((e) =>
      rows.push([e.name, e.status, e.scene, e.teams, e.players, e.solved, e.totalClues, e.winner ?? "—", e.winnerScore])
    );
    rows.push([]);
    rows.push(["TEAM LEADERBOARD"]);
    rows.push(["Rank", "Team", "Event", "Score", "Time"]);
    teamLeaderboard.forEach((t) => rows.push([t.rank, t.team, t.event, t.score, t.time]));
    rows.push([]);
    rows.push(["TOP PLAYERS"]);
    rows.push(["Rank", "Player", "Clues Found"]);
    topPlayers.forEach((p) => rows.push([p.rank, p.username, p.cluesFound]));

    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`Mini_Treasure_Report_${date}.csv`, rows);
  };

  return (
    <button
      onClick={handleExport}
      className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  );
}

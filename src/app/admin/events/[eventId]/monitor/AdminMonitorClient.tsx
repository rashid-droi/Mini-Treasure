"use client";

import { useEffect, useState } from "react";
import { getAdminMonitorState } from "@/actions/adminMonitor";
import { useSocket } from "@/components/SocketProvider";
import { Loader2, Users, Target, MessageSquare, AlertTriangle, ShieldCheck } from "lucide-react";
import SynchronizedTimer from "@/components/game/SynchronizedTimer";

type TeamMonitor = {
  id: string;
  name: string;
  wrongAttempts: number;
  score: number;
  solvedClues: number;
  totalClues: number;
  onlinePlayers: number;
  chatActivity: boolean; // Visual ping
};

export default function AdminMonitorClient({ eventId }: { eventId: string }) {
  const [teams, setTeams] = useState<TeamMonitor[]>([]);
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { socket } = useSocket();

  useEffect(() => {
    const fetchInitial = async () => {
      const res = await getAdminMonitorState(eventId);
      if (res.error) {
        setError(res.error);
      } else if (res.success) {
        setEventData(res.event);
        setTeams(res.teams.map((t: any) => ({ ...t, onlinePlayers: 0, chatActivity: false })));
      }
      setLoading(false);
    };
    fetchInitial();
  }, [eventId]);

  useEffect(() => {
    if (!socket || loading || !eventData) return;

    // Join the secure admin room
    socket.emit("join_admin_monitor", { eventId });

    const handleChatPing = ({ teamId }: { teamId: string }) => {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, chatActivity: true } : t));
      // Reset ping after 2s
      setTimeout(() => {
        setTeams(prev => prev.map(t => t.id === teamId ? { ...t, chatActivity: false } : t));
      }, 2000);
    };

    const handleWrongClick = ({ teamId }: { teamId: string }) => {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, wrongAttempts: t.wrongAttempts + 1 } : t));
    };

    const handleClueSolved = ({ teamId }: { teamId: string }) => {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, solvedClues: t.solvedClues + 1 } : t));
    };

    const handleScoreUpdate = ({ teamId, pointsAwarded, pointsDeducted }: any) => {
      setTeams(prev => prev.map(t => {
        if (t.id !== teamId) return t;
        let newScore = t.score;
        if (pointsAwarded) newScore += pointsAwarded;
        if (pointsDeducted) newScore -= pointsDeducted;
        return { ...t, score: newScore };
      }));
    };

    const handleOnlinePlayers = ({ teamId, count }: { teamId: string, count: number }) => {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, onlinePlayers: count } : t));
    };

    socket.on("admin_chat_activity", handleChatPing);
    socket.on("admin_wrong_click", handleWrongClick);
    socket.on("admin_clue_solved", handleClueSolved);
    socket.on("score_update", handleScoreUpdate);
    socket.on("admin_online_players", handleOnlinePlayers);

    return () => {
      socket.off("admin_chat_activity", handleChatPing);
      socket.off("admin_wrong_click", handleWrongClick);
      socket.off("admin_clue_solved", handleClueSolved);
      socket.off("score_update", handleScoreUpdate);
      socket.off("admin_online_players", handleOnlinePlayers);
    };
  }, [socket, loading, eventData, eventId]);


  if (loading) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-[#e8842c]" />
    </div>
  );

  if (error || !eventData) return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center text-rose-500">{error}</div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-[#c99a00]" />
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Overwatch Monitor</h1>
          </div>
          <p className="text-zinc-500 mt-2">Live telemetry for Event: <span className="text-zinc-900 font-medium">{eventData.name}</span></p>
        </div>

        {eventData.endTime && (
          <div className="flex flex-col items-end">
            <span className="text-sm text-zinc-400 uppercase tracking-widest font-bold mb-1">Global Clock</span>
            <SynchronizedTimer endTimeString={eventData.endTime} />
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teams.map(team => {
          const progressPercent = team.totalClues > 0 ? (team.solvedClues / team.totalClues) * 100 : 0;
          const isDone = team.solvedClues >= team.totalClues && team.totalClues > 0;

          return (
            <div key={team.id} className={`bg-white border rounded-2xl p-6 transition-all duration-300 relative overflow-hidden shadow-sm ${
              isDone
                ? "border-emerald-400"
                : "border-zinc-200 hover:border-[#f5c518]"
            }`}>
              {/* Progress Background Bar */}
              <div
                className={`absolute inset-0 opacity-15 transition-all duration-1000 ease-out ${isDone ? "bg-emerald-400" : "bg-[#f5c518]"}`}
                style={{ width: `${progressPercent}%` }}
              />

              <div className="relative z-10 flex flex-col h-full">
                {/* Team Header */}
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-xl font-bold text-zinc-900 truncate pr-4">{team.name}</h2>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    team.onlinePlayers > 0
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                      : "bg-zinc-100 text-zinc-500 border-zinc-200"
                  }`}>
                    <Users className="w-3 h-3" />
                    {team.onlinePlayers}
                  </div>
                </div>

                {/* Main Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-center items-center">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Score</span>
                    <span className="text-3xl font-black text-zinc-900">{team.score}</span>
                  </div>

                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-center items-center">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Found</span>
                    <span className="text-3xl font-black text-zinc-900 flex items-baseline gap-1">
                      {team.solvedClues} <span className="text-sm font-medium text-zinc-400">/ {team.totalClues}</span>
                    </span>
                  </div>
                </div>

                {/* Lower Metrics */}
                <div className="flex-1 flex flex-col justify-end gap-3">
                  <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
                    <div className="flex items-center gap-2 text-rose-500">
                      <Target className="w-4 h-4" />
                      <span className="text-sm font-medium">Missed Clicks</span>
                    </div>
                    <span className="font-bold text-rose-500">{team.wrongAttempts}</span>
                  </div>

                  <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-300 ${
                    team.chatActivity
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-zinc-50 border-zinc-200"
                  }`}>
                    <div className={`flex items-center gap-2 ${team.chatActivity ? "text-emerald-600" : "text-zinc-400"}`}>
                      <MessageSquare className={`w-4 h-4 ${team.chatActivity ? "animate-pulse" : ""}`} />
                      <span className="text-sm font-medium">Comms</span>
                    </div>
                    <span className={`text-xs font-bold ${team.chatActivity ? "text-emerald-600" : "text-zinc-400"}`}>
                      {team.chatActivity ? "ACTIVE" : "SILENT"}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { getEventLeaderboard } from "@/actions/leaderboard";
import { useSocket } from "@/components/SocketProvider";
import { Loader2, Trophy, Clock, Star, Medal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LeaderboardRow = {
  id: string;
  team: { id: string; name: string; participants: { user: { username: string } }[] };
  score: number;
  bonusPoints: number;
  completionTimeMs: number | null;
  updatedAt: Date;
};

// `light` renders the board for light backgrounds (player game page);
// the default dark styling is used on the admin pages.
export default function LiveLeaderboard({ eventId, myTeamId, light = false }: { eventId: string; myTeamId?: string; light?: boolean }) {
  const [standings, setStandings] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { socket } = useSocket();

  const fetchStandings = useCallback(async () => {
    const res = await getEventLeaderboard(eventId);
    if (res.error) setError(res.error);
    else if (res.data) setStandings(res.data as any);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  useEffect(() => {
    if (!socket) return;
    
    // Join the global event room to receive global updates
    socket.emit("join_team", { teamId: "admin", eventId });

    // When anyone scores, instantly re-fetch standings
    const handleScoreUpdate = () => {
      fetchStandings();
    };

    socket.on("score_update", handleScoreUpdate);

    return () => {
      socket.off("score_update", handleScoreUpdate);
    };
  }, [socket, eventId]);

  if (loading) return (
    <div className="h-64 flex items-center justify-center text-amber-500">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="h-64 flex items-center justify-center text-red-400 font-medium">
      {error}
    </div>
  );

  if (standings.length === 0) return (
    <div className="h-64 flex flex-col items-center justify-center text-zinc-500 space-y-4">
      <Trophy className="w-12 h-12 opacity-20" />
      <p>No teams on the board yet.</p>
    </div>
  );

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-12 gap-4 text-xs font-bold text-zinc-500 uppercase tracking-wider px-6 pb-2 border-b ${light ? "border-zinc-200" : "border-white/5"}`}>
        <div className="col-span-1 text-center">Rank</div>
        <div className="col-span-4">Team</div>
        <div className="col-span-2 text-right">Score</div>
        <div className="col-span-2 text-right">Bonus</div>
        <div className="col-span-3 text-right">Time</div>
      </div>

      <div className="space-y-3 relative">
        <AnimatePresence>
          {standings.map((row, index) => {
            const isTop3 = index < 3;
            const isMe = !!myTeamId && row.team.id === myTeamId;
            const colors = light
              ? [
                  "text-amber-600 bg-amber-500/10 border-amber-400/50", // Gold
                  "text-zinc-500 bg-zinc-500/10 border-zinc-400/50",    // Silver
                  "text-orange-600 bg-orange-500/10 border-orange-400/50" // Bronze
                ]
              : [
                  "text-amber-400 bg-amber-500/10 border-amber-500/30", // Gold
                  "text-zinc-300 bg-zinc-500/10 border-zinc-500/30",   // Silver
                  "text-orange-400 bg-orange-500/10 border-orange-500/30" // Bronze
                ];
            const rankColor = isTop3
              ? colors[index]
              : light ? "text-zinc-500 bg-zinc-500/5 border-zinc-200" : "text-zinc-500 bg-white/5 border-white/5";

            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                key={row.id}
                className={`grid grid-cols-12 gap-4 items-center p-4 rounded-2xl border ${rankColor} ${
                  isMe
                    ? light
                      ? "ring-2 ring-[#f5c518] ring-offset-2 ring-offset-white"
                      : "ring-2 ring-[#f5c518] ring-offset-2 ring-offset-zinc-900"
                    : ""
                }`}
              >
                <div className="col-span-1 flex justify-center">
                  {isTop3 ? <Medal className="w-6 h-6" /> : <span className="text-lg font-black">{index + 1}</span>}
                </div>
                
                <div className="col-span-4 flex flex-col">
                  <span className={`font-bold text-lg flex items-center gap-2 ${isTop3 ? "" : light ? "text-zinc-800" : "text-zinc-200"}`}>
                    {row.team.name}
                    {isMe && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-[#f5c518] text-zinc-900">
                        You
                      </span>
                    )}
                  </span>
                  <span className="text-xs opacity-50 truncate">
                    {row.team.participants.map(p => p.user.username).join(", ")}
                  </span>
                </div>
                
                <div className="col-span-2 text-right font-black text-xl flex items-center justify-end gap-1">
                  {/* Subtle pop animation on score change could be added here by wrapping the number, but layout handles the row well */}
                  {row.score}
                </div>
                
                <div className="col-span-2 text-right font-medium flex items-center justify-end gap-1 opacity-80">
                  <Star className="w-3 h-3" />
                  {row.bonusPoints}
                </div>
                
                <div className="col-span-3 text-right font-medium flex items-center justify-end gap-1 opacity-80">
                  <Clock className="w-3 h-3" />
                  {row.completionTimeMs ? formatTime(row.completionTimeMs) : "---"}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

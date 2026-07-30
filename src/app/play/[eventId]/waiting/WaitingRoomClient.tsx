"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getWaitingRoomState } from "@/actions/waitingRoom";
import { Loader2, CheckCircle2, Circle, Send, Clock } from "lucide-react";
import { useSocket } from "@/components/SocketProvider";

type WaitingRoomData = {
  userId: string;
  event: any;
  team: any;
  roster: any[];
  players: any[]; // everyone who joined the event, across all teams
  chat: any[];
  lobbyStartedAt: string | Date | null; // earliest join → shared room clock origin
};

// Formats an elapsed millisecond span as H:MM:SS (or M:SS under an hour).
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function WaitingRoomClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<WaitingRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const loadState = useCallback(async () => {
    const res = await getWaitingRoomState(eventId);
    if (res.error) setError(res.error);
    else if (res.data) setData(res.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Tick once a second to drive the live "time in room" clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Join (and rejoin on every reconnect) the socket rooms for this team and
  // event. socket.io-client reuses the same Socket object across a dropped
  // connection, so without listening for "connect" here a reconnect after a
  // network blip would silently leave this client out of the rooms — no
  // more roster/chat/ready updates until a full page refresh.
  useEffect(() => {
    if (!socket || !data) return;

    const rejoin = () => {
      socket.emit("join_team", { teamId: data.team.id, eventId, userId: data.userId });
      // Resync full state too, in case anything changed while disconnected.
      loadState();
    };

    rejoin();
    socket.on("connect", rejoin);
    return () => {
      socket.off("connect", rejoin);
    };
  }, [socket, data?.team?.id, data?.userId, eventId, loadState]);

  useEffect(() => {
    if (!socket || !data) return;

    const handleNewMessage = (chatData: any) => {
      setData(prev => {
        if (!prev) return prev;
        // Avoid duplicate appends if we receive our own message
        if (prev.chat.find(c => c.id === chatData.id)) return prev;
        return { ...prev, chat: [...prev.chat, chatData] };
      });
    };

    const handleParticipantUpdate = ({ participantId, isReady }: any) => {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          roster: prev.roster.map(p =>
            p.id === participantId ? { ...p, isReady } : p
          ),
          players: prev.players.map(p =>
            p.id === participantId ? { ...p, isReady } : p
          )
        };
      });
    };

    // Server sends the full event roster whenever anyone joins
    const handleEventRoster = (players: any[]) => {
      setData(prev => (prev ? { ...prev, players } : prev));
    };

    socket.on("new_message", handleNewMessage);
    socket.on("participant_updated", handleParticipantUpdate);
    socket.on("event_roster", handleEventRoster);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("participant_updated", handleParticipantUpdate);
      socket.off("event_roster", handleEventRoster);
    };
  }, [socket, data?.team?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.chat]);

  const enterGameplay = useCallback(() => {
    setLaunching(true);
    router.push(`/play/${eventId}/game`);
  }, [router, eventId]);

  // Once every required condition is met, move everyone into gameplay
  // automatically — nobody should be stuck in the lobby just because they
  // didn't click the button.
  useEffect(() => {
    if (!data || launching) return;
    if (!data.event.sceneId) return;
    const allReady = data.players.length > 0 && data.players.every(p => p.isReady);
    const canStart = allReady && data.event.status === "ACTIVE";
    if (canStart) enterGameplay();
  }, [data, launching, enterGameplay]);

  const handleToggleReady = () => {
    if (!data || !socket) return;
    const currentUser = data.players.find(p => p.user.id === data.userId);
    if (!currentUser) return;

    const newStatus = !currentUser.isReady;

    // Optimistic
    setData({
      ...data,
      roster: data.roster.map(p => p.id === currentUser.id ? { ...p, isReady: newStatus } : p),
      players: data.players.map(p => p.id === currentUser.id ? { ...p, isReady: newStatus } : p)
    });

    socket.emit("toggle_ready", {
      participantId: currentUser.id,
      teamId: data.team.id,
      eventId,
      isReady: newStatus
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !data || !socket) return;
    
    const message = chatInput.trim();
    setChatInput("");

    // Optimistic chat append
    const tempId = Date.now().toString();
    setData({
      ...data,
      chat: [...data.chat, {
        id: tempId,
        message,
        sender: { username: "You" },
        senderId: data.userId
      }]
    });

    // Event-wide message: no teamId, everyone in the waiting room sees it
    socket.emit("send_message", {
      eventId,
      userId: data.userId,
      content: message
    });
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#fafafa] text-[#e8842c]">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="bg-rose-50 border border-rose-200 text-rose-600 p-6 rounded-2xl max-w-md text-center">
        <h2 className="text-xl font-bold mb-2">Error Accessing Waiting Room</h2>
        <p>{error || "Could not load data."}</p>
      </div>
    </div>
  );

  const currentUser = data.players.find(p => p.user.id === data.userId);
  const hasScene = Boolean(data.event.sceneId);
  // A player can enter once the host has started the event and they themselves
  // are ready — no need to wait for every other player (e.g. idle/stuck ones).
  const canEnter = hasScene && data.event.status === "ACTIVE" && !!currentUser?.isReady;

  return (
    <div className="min-h-screen bg-[#fafafa] p-4 md:p-8 flex flex-col items-center justify-center">
      {!isConnected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium rounded-full flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reconnecting...
        </div>
      )}

      {!hasScene && (
        <div className="w-full max-w-6xl mb-4 px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl text-center">
          This event has no scene yet. Ask the host to pick one in Admin → Events before the game can start.
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Left Panel: Live Event Roster */}
        <div className="md:col-span-3 bg-white border border-zinc-200 rounded-3xl p-6 flex flex-col h-[55vh] md:h-[600px] shadow-sm">
          <h2 className="text-xl font-bold text-zinc-900 mb-2 flex items-center justify-between">
            Players
            <span className="text-xs px-2 py-1 bg-[#f5c518]/20 text-[#c99a00] rounded-lg">
              {data.players.filter(p => p.isReady).length}/{data.players.length} Ready
            </span>
          </h2>
          <div className="mb-4 flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl">
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Clock className="w-3.5 h-3.5 text-[#e8842c]" />
              Time in room
            </span>
            <span className="font-mono font-bold text-zinc-900 tabular-nums">
              {data.lobbyStartedAt
                ? formatElapsed(now - new Date(data.lobbyStartedAt).getTime())
                : "0:00"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {data.players.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <span className="flex items-center gap-2 text-zinc-800 font-medium truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${p.online ? "bg-emerald-500" : "bg-zinc-300"}`}
                    title={p.online ? "Online" : "Offline"}
                  />
                  {p.user.username} {p.user.id === data.userId && "(You)"}
                </span>
                {p.isReady ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-300" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center Panel: Mission Briefing */}
        <div className="md:col-span-5 bg-white border border-zinc-200 rounded-3xl p-6 sm:p-8 flex flex-col min-h-[420px] md:h-[600px] text-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 inset-x-0 h-1 bg-[#f5c518]" />

          <div className="flex-1 flex flex-col items-center justify-center space-y-6">
            <div className="space-y-2">
              <p className="text-[#e8842c] font-semibold tracking-widest uppercase text-sm">Mission Briefing</p>
              <h1 className="text-4xl font-black text-zinc-900">{data.event.name}</h1>
            </div>

            <p className="text-zinc-500 max-w-sm">
              {data.event.description || "Find the hidden clues within the scene as fast as possible to climb the leaderboard."}
            </p>

            {data.event.scene?.name && (
              <div className="px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-600">
                Target Location: <span className="text-zinc-900 font-medium">{data.event.scene.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-4 w-full">
            <button
              onClick={handleToggleReady}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                currentUser?.isReady
                  ? "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200"
                  : "bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {currentUser?.isReady ? "Cancel Ready Status" : "I'm Ready!"}
            </button>

            <button
              onClick={enterGameplay}
              disabled={!canEnter || launching}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all border ${
                canEnter && !launching
                  ? "bg-[#2b2b2b] hover:bg-[#333] border-[#2b2b2b] text-white cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-transparent border-zinc-200 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {launching
                ? "Launching..."
                : data.event.status !== "ACTIVE"
                  ? "Waiting for Host to start Event..."
                  : !currentUser?.isReady
                    ? "Tap “I'm Ready!” to enter"
                    : "Enter Game"}
            </button>
          </div>
        </div>

        {/* Right Panel: Chat */}
        <div className="md:col-span-4 bg-white border border-zinc-200 rounded-3xl flex flex-col h-[55vh] md:h-[600px] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-200 bg-zinc-50">
            <h3 className="font-bold text-zinc-900">Event Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {data.chat.length === 0 ? (
              <div className="text-zinc-400 text-center text-sm h-full flex items-center justify-center">
                Say hello to everyone!
              </div>
            ) : (
              data.chat.map(msg => {
                const isMe = msg.senderId === data.userId;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-zinc-400 mb-1 px-1">{isMe ? "You" : msg.sender?.username}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                      isMe
                        ? "bg-[#f5c518] text-zinc-900 rounded-br-sm"
                        : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-zinc-50 border-t border-zinc-200 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Message everyone..."
              className="flex-1 bg-white border border-zinc-300 rounded-xl px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 bg-[#f5c518] hover:bg-[#e6b800] disabled:opacity-50 text-zinc-900 rounded-xl transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

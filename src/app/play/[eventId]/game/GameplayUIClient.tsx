"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useSocket } from "@/components/SocketProvider";
import SceneViewer from "@/components/game/SceneViewer";
import { Clue, ClueType } from "@/components/game/ClueDisplay";
import LiveChat from "@/components/game/LiveChat";
import LiveLeaderboard from "@/components/game/LiveLeaderboard";
import SynchronizedTimer from "@/components/game/SynchronizedTimer";
import { getNextClue } from "@/actions/gameplay";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Search, Lightbulb, CheckCircle2, HelpCircle, Minus, Plus, Trophy } from "lucide-react";
import toast from "react-hot-toast";

interface GameplayEvent {
  id: string;
  name: string;
  sceneId: string;
  startTime: string;
  endTime: string;
  gameDuration: number | null;
}

interface GameplayTeam {
  id: string;
  name: string;
  activeClueHints: number | null;
  wrongAttempts: number;
}

interface SceneClue {
  id: string;
  name: string;
  type: ClueType;
  targetX: number;
  targetY: number;
  radius?: number | null;
  shape?: string | null;
}

// Sidebar clue groups, in display order (matches the MiniTreasure reference UI)
const CLUE_SECTIONS: { types: ClueType[]; label: string }[] = [
  { types: ["TEXT", "QUESTION"], label: "Straightforward Clues" },
  { types: ["RIDDLE"], label: "Rhyming Clues" },
  { types: ["IMAGE"], label: "Image Clues" },
  { types: ["OBJECT"], label: "Object Clues" },
  { types: ["LOCATION"], label: "Location Clues" },
];

// Unfound clues only show a teaser of their name, e.g. "How many..."
const teaser = (name: string) => (name.length > 16 ? `${name.slice(0, 16).trimEnd()}...` : name);

function useMinsUsed(endTime: string, gameDuration: number | null) {
  const [minsUsed, setMinsUsed] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(endTime).getTime();
    if (!gameDuration || isNaN(end)) {
      setMinsUsed(null);
      return;
    }

    const compute = () => {
      const remainingMs = Math.max(0, end - Date.now());
      const elapsedMs = gameDuration * 60000 - remainingMs;
      setMinsUsed(Math.min(gameDuration, Math.max(0, Math.ceil(elapsedMs / 60000))));
    };

    compute();
    const timer = setInterval(compute, 5000);
    return () => clearInterval(timer);
  }, [endTime, gameDuration]);

  return minsUsed;
}

export default function GameplayUIClient({
  event,
  team,
  userId,
  playerName,
  initialClues,
  initialFoundClues,
  clickTolerance = 8,
  sceneGuideUrl = null
}: {
  event: GameplayEvent;
  team: GameplayTeam;
  userId: string;
  playerName: string;
  initialClues: SceneClue[];
  initialFoundClues: string[];
  clickTolerance?: number;
  sceneGuideUrl?: string | null;
}) {
  const { socket } = useSocket();
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [foundClues, setFoundClues] = useState<string[]>(initialFoundClues);
  const [hintsUsed, setHintsUsed] = useState<number>(team.activeClueHints || 0);
  const [failedClicks, setFailedClicks] = useState<number>(team.wrongAttempts || 0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loadingClue, setLoadingClue] = useState(true);
  const [unreadChat, setUnreadChat] = useState(0);

  // Real image aspect ratio, reported by the viewer once tiles are measured,
  // so the scene panel hugs the image exactly (no letterboxing)
  const [sceneAspect, setSceneAspect] = useState(16 / 9);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    leaderboard: true,
  });

  // Clear the dropdown whenever the team moves on to a new clue
  useEffect(() => {
    setSelectedAnswer("");
  }, [activeClue?.id]);

  const minsUsed = useMinsUsed(event.endTime, event.gameDuration);

  const toggleSection = (key: string) => {
    if (key === "chat") setUnreadChat(0);
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Note: loadingClue starts (and is reset by callers) as true; state updates
  // happen in the promise callback, so this is safe to call from effects.
  const fetchClue = useCallback(() => {
    getNextClue(team.id, event.id).then((res) => {
      if (res.completed) {
        setGameCompleted(true);
      } else if (res.clue) {
        setActiveClue(res.clue as Clue);
        setHintsUsed(res.hintsUsed || 0);
      }
      setLoadingClue(false);
    });
  }, [team.id, event.id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join_team", { teamId: team.id, eventId: event.id, userId });

    socket.on("clue_locked", ({ clueId, userId: solverId, pointsAwarded, nextClue, completed }) => {
      setFoundClues(prev => [...prev, clueId]);
      setHintsUsed(0);
      setLoadingClue(false);

      if (solverId !== userId) {
        toast.success(`A teammate found the object! +${pointsAwarded ?? 0} Points`, { icon: "🔥" });
      } else {
        toast.success(`Object Found! +${pointsAwarded ?? 0} Points`, { icon: "🎯" });
      }

      if (completed) {
        setGameCompleted(true);
        setActiveClue(null);
      } else if (nextClue) {
        setActiveClue(nextClue as Clue);
      }
    });

    socket.on("hint_unlocked", ({ hintsUsed }) => {
      setHintsUsed(hintsUsed);
    });

    socket.on("bad_click_registered", ({ userId: clickerId }: { userId?: string }) => {
      setFailedClicks(prev => prev + 1);
      // The clicker already gets a toast from the validate_click callback
      if (clickerId && clickerId !== userId) {
        toast.error("A teammate missed. Accuracy Penalty applied.", { icon: "❌" });
      }
    });

    return () => {
      socket.off("clue_locked");
      socket.off("hint_unlocked");
      socket.off("bad_click_registered");
    };
  }, [socket, team.id, event.id, userId, fetchClue]);

  useEffect(() => {
    fetchClue();
  }, [fetchClue]);

  // Track unread chat messages while the chat panel is collapsed
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (chat: { senderId?: string }) => {
      if (chat.senderId === userId) return;
      setUnreadChat(u => (openSections.chat ? 0 : u + 1));
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, userId, openSections.chat]);

  const handleBuyHint = () => {
    if (hintsUsed >= 3 || !activeClue) return;
    socket?.emit("buy_hint", { teamId: team.id, eventId: event.id, clueId: activeClue.id });
  };

  // Tapping an object button on the image submits that spot. The server scores
  // it correct only when it matches the team's current active clue.
  const handleObjectClick = (x: number, y: number) => {
    if (!activeClue || gameCompleted || submittingAnswer) return;
    if (activeClue.type === "QUESTION") return; // answered via the dropdown
    setSubmittingAnswer(true);
    const resetTimer = setTimeout(() => setSubmittingAnswer(false), 5000);
    socket?.emit("validate_click", { x, y }, (res: { status?: string; error?: string }) => {
      clearTimeout(resetTimer);
      setSubmittingAnswer(false);
      if (res.status === "wrong") {
        toast.error("Incorrect. Accuracy Penalty applied.", { icon: "❌" });
      } else if (res.error) {
        toast.error(res.error || "Failed to submit.");
      }
      // "correct" is handled automatically by the "clue_locked" socket broadcast
    });
  };

  // Submit an answer by name: QUESTION clues send the picked dropdown option,
  // object clues send the name of the object button the player clicked.
  const sendAnswer = useCallback((answer: string) => {
    if (!activeClue || !answer || submittingAnswer) return;
    setSubmittingAnswer(true);
    // Safety net: re-enable the buttons if the server ack never arrives
    const resetTimer = setTimeout(() => setSubmittingAnswer(false), 5000);

    socket?.emit("submit_answer", { answer }, (res: { status?: string; error?: string }) => {
      clearTimeout(resetTimer);
      setSubmittingAnswer(false);
      if (res.status === "wrong") {
        setSelectedAnswer("");
        toast.error("Incorrect. Accuracy Penalty applied.", { icon: "❌" });
      } else if (res.error) {
        toast.error(res.error || "Failed to submit.");
      }
      // "correct" is handled automatically by the "clue_locked" socket broadcast
    });
  }, [activeClue, submittingAnswer, socket]);

  const handleSubmitAnswer = () => sendAnswer(selectedAnswer);

  const clueSections = useMemo(
    () =>
      CLUE_SECTIONS
        .map(section => ({ ...section, clues: initialClues.filter(c => section.types.includes(c.type)) }))
        .filter(section => section.clues.length > 0),
    [initialClues]
  );

  const foundSet = useMemo(() => new Set(foundClues), [foundClues]);
  const todoCount = initialClues.length - foundClues.length;

  // -------------------------------------------------------------
  // UI RENDERERS
  // -------------------------------------------------------------

  const STAT_CHIPS = [
    { label: "To do", value: String(todoCount), chip: "bg-amber-50 border-amber-100", num: "text-amber-600" },
    { label: "Passed", value: String(foundClues.length), chip: "bg-emerald-50 border-emerald-100", num: "text-emerald-600" },
    { label: "Failed", value: String(failedClicks), chip: "bg-rose-50 border-rose-100", num: "text-rose-500" },
    {
      label: "Mins used",
      value: minsUsed !== null && event.gameDuration ? `${minsUsed}/${event.gameDuration}` : "—",
      chip: "bg-zinc-100 border-zinc-200",
      num: "text-zinc-600",
    },
  ];

  const renderHeader = () => (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Brand + Select */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mini Treasure" className="h-8 sm:h-10 w-auto shrink-0" />

          <div className="hidden sm:block h-8 w-px bg-zinc-200" />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/select.png" alt="Select" className="hidden sm:block h-9 w-auto" />
        </div>

        {/* Player of team */}
        <div className="hidden md:block text-xl font-bold text-zinc-800 truncate text-center flex-1 min-w-0 order-last md:order-none w-full md:w-auto">
          {playerName} <span className="text-[#e8842c] font-semibold">of</span> {team.name}
        </div>

        {/* Timer + stat chips + help — scrolls horizontally on very small screens
            instead of breaking the header layout. */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto max-w-full -mx-1 px-1">
          <SynchronizedTimer endTimeString={event.endTime} startTimeString={event.startTime} />
          {STAT_CHIPS.map(({ label, value, chip, num }) => (
            <div key={label} className={`px-3 py-1.5 rounded-lg border text-center min-w-[58px] shrink-0 ${chip}`}>
              <div className="text-[11px] leading-tight text-zinc-500">{label}</div>
              <div className={`text-base font-bold leading-tight ${num}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );

  const renderQuestionArea = () => {
    const helperText = (
      <p className="text-sm text-zinc-500">
        Having issues with the image? First,{" "}
        <button onClick={() => window.location.reload()} className="text-[#e8842c] hover:underline">
          refresh the page
        </button>
        , then{" "}
        <a
          href={`/play/test-viewer?sceneId=${encodeURIComponent(event.sceneId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#e8842c] hover:underline"
        >
          try this different viewer
        </a>
        {sceneGuideUrl && (
          <>
            . As a last resort,{" "}
            <a href={sceneGuideUrl} target="_blank" rel="noopener noreferrer" className="text-[#e8842c] hover:underline">
              open the image in a new tab
            </a>
          </>
        )}
        .
      </p>
    );

    return (
      <AnimatePresence mode="wait">
        {loadingClue ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 text-zinc-500 p-4"
          >
            <Search className="w-6 h-6 animate-spin opacity-50" />
            Loading your next clue...
          </motion.div>
        ) : gameCompleted ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm max-w-md"
          >
            <CheckCircle2 className="w-16 h-16 text-emerald-600 mb-4" />
            <h2 className="text-2xl font-black text-emerald-950 mb-2">Hunt Complete!</h2>
            <p className="text-emerald-800/90">You&apos;ve found all the targets. Check the leaderboard for your final ranking and bonuses!</p>
          </motion.div>
        ) : activeClue ? (
          <motion.div
            key={`clue-${activeClue.id}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col md:flex-row gap-4 items-stretch"
          >
            {/* Dark "YOUR QUESTION" panel */}
            <div className="relative bg-[#2b2b2b] text-white rounded-2xl p-5 md:w-96 shrink-0 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[#f5c518] font-semibold text-sm tracking-wide">YOUR QUESTION</span>
                <HelpCircle className="w-5 h-5 text-[#f5c518]" />
              </div>
              <h2 className="text-2xl font-black mt-3 leading-snug">
                {activeClue.description || activeClue.name}
              </h2>
              <p className="text-zinc-400 text-sm mt-3">
                {activeClue.type === "QUESTION" ? "Answer correctly" : "Find this object"} to earn{" "}
                <span className="text-[#f5c518] font-semibold">{activeClue.points} points</span>
              </p>
            </div>

            {/* Right column: helper text + action */}
            <div className="flex-1 flex flex-col justify-between gap-4 min-w-0">
              {helperText}

              {activeClue.type === "QUESTION" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[#e8842c] text-sm">Select your answer, then submit</span>
                  <select
                    value={selectedAnswer}
                    onChange={e => setSelectedAnswer(e.target.value)}
                    className="bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                  >
                    <option value="">Please select...</option>
                    {(activeClue.options ?? []).map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!selectedAnswer || submittingAnswer}
                    className="px-6 py-2.5 bg-[#f5c518] hover:bg-[#e6b800] disabled:opacity-50 disabled:hover:bg-[#f5c518] text-zinc-900 font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    {submittingAnswer ? "Checking..." : "Submit"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <button
                    onClick={handleBuyHint}
                    disabled={hintsUsed >= 3}
                    className="flex items-center gap-2 px-7 py-3 bg-[#f5c518] hover:bg-[#e6b800] disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-zinc-900 font-semibold rounded-xl transition-colors shadow-sm"
                  >
                    <Lightbulb className="w-5 h-5" />
                    {hintsUsed >= 3 ? "Max Hints Used" : "Buy Hint (-10)"}
                  </button>
                  {hintsUsed > 0 && (
                    <span className="text-xs text-zinc-500">Hints used: {hintsUsed}/3</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    );
  };

  const renderCard = (
    key: string,
    icon: ReactNode,
    title: ReactNode,
    content: ReactNode,
    { collapsible = true }: { collapsible?: boolean } = {}
  ) => {
    const isOpen = collapsible ? !!openSections[key] : true;
    return (
      <div key={key} className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={collapsible ? () => toggleSection(key) : undefined}
          className={`w-full flex items-center justify-between px-5 py-4 text-left ${collapsible ? "" : "cursor-default"}`}
        >
          <span className="flex items-center gap-2.5 text-zinc-800 font-semibold">
            <span className="text-[#e8842c]">{icon}</span>
            {title}
          </span>
          {collapsible && (
            <span className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
              {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </span>
          )}
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={collapsible ? { height: 0, opacity: 0 } : false}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">{content}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSidebar = () => (
    <aside className="flex flex-col gap-4">
      {renderCard(
        "leaderboard",
        <Trophy className="w-5 h-5" />,
        "Leaderboard",
        <LiveLeaderboard eventId={event.id} myTeamId={team.id} light />,
        { collapsible: false }
      )}

      {renderCard(
        "chat",
        <MessageSquare className="w-5 h-5" />,
        <>
          Chat with your team
          {unreadChat > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {unreadChat}
            </span>
          )}
        </>,
        <div className="h-72 flex flex-col bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
          <LiveChat teamId={team.id} userId={userId} />
        </div>
      )}

      {renderCard(
        "clues",
        <Search className="w-5 h-5" />,
        "Object clues",
        <div className="space-y-4">
          {clueSections.map(section => (
            <div key={section.label}>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">{section.label}</p>
              <ul className="space-y-1.5">
                {section.clues.map(clue => {
                  const isFound = foundSet.has(clue.id);
                  const isActive = activeClue?.id === clue.id;
                  return (
                    <li
                      key={clue.id}
                      className={
                        isActive
                          ? "font-bold text-zinc-900 bg-amber-50 rounded px-2 py-0.5"
                          : isFound
                            ? "text-emerald-700 line-through px-2 py-0.5"
                            : "text-zinc-700 px-2 py-0.5"
                      }
                    >
                      {isFound || isActive ? clue.name : teaser(clue.name)}
                      {isFound && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1.5 -mt-0.5" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {clueSections.length === 0 && (
            <p className="text-sm text-zinc-500">No clues to list.</p>
          )}
        </div>
      )}
    </aside>
  );

  return (
    <div className="min-h-dvh bg-[#fafafa] text-zinc-900 flex flex-col">
      {renderHeader()}

      <main className="relative flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 py-5 grid gap-6 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        {/* Scene + active clue */}
        <div className="space-y-4">
          <div
            className="relative w-full mx-auto rounded-2xl overflow-hidden border border-zinc-200 shadow-sm bg-white"
            style={{ aspectRatio: String(sceneAspect), maxWidth: `calc(68vh * ${sceneAspect})` }}
          >
            <SceneViewer
              sceneId={event.sceneId}
              activeClue={activeClue}
              foundClues={initialClues.filter(c => foundSet.has(c.id))}
              hiddenClues={initialClues.filter(c => !foundSet.has(c.id))}
              clickTolerance={clickTolerance}
              hintsUsed={hintsUsed}
              onObjectClick={handleObjectClick}
              onAspectRatio={setSceneAspect}
            />

          </div>

          {renderQuestionArea()}
        </div>

        {renderSidebar()}

        {/* Decorative dots (bottom-right), matching the reference art */}
        <div
          aria-hidden
          className="pointer-events-none hidden lg:block absolute bottom-2 right-6 w-28 h-16 opacity-70"
          style={{
            backgroundImage: "radial-gradient(#f5c518 1.6px, transparent 1.6px)",
            backgroundSize: "11px 11px",
          }}
        />
      </main>

      <footer className="border-t border-zinc-200 py-4 px-4 text-center text-sm text-zinc-500">
        <p>© 2025 Select Training &amp; Management Consultancy LLC. All rights reserved.</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="#" className="hover:text-zinc-900 hover:underline">Privacy</a>
          <a href="#" className="hover:text-zinc-900 hover:underline">Terms</a>
          <a href="#" className="hover:text-zinc-900 hover:underline">Support</a>
        </div>
      </footer>
    </div>
  );
}

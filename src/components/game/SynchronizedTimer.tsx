"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function SynchronizedTimer({
  endTimeString,
  startTimeString,
}: {
  endTimeString?: string;
  startTimeString?: string;
}) {
  const [displayMs, setDisplayMs] = useState<number>(0);
  const [isFinished, setIsFinished] = useState(false);

  const end = endTimeString ? new Date(endTimeString).getTime() : NaN;
  const start = startTimeString ? new Date(startTimeString).getTime() : NaN;
  // Count DOWN when the event has a fixed end (a duration was set); otherwise
  // count UP the elapsed time since the game started.
  const isCountdown = !isNaN(end);
  const isCountUp = !isCountdown && !isNaN(start);

  useEffect(() => {
    if (!isCountdown && !isCountUp) {
      setDisplayMs(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      if (isCountdown) {
        const diff = end - now;
        if (diff <= 0) {
          setDisplayMs(0);
          setIsFinished(true);
          return false; // stop the interval
        }
        setDisplayMs(diff);
        return true;
      }
      // Count up: elapsed since start.
      setDisplayMs(Math.max(0, now - start));
      return true;
    };

    tick();
    const timer = setInterval(() => {
      if (!tick()) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [endTimeString, startTimeString]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  // Warning/finish states only make sense for a countdown, never for count-up.
  const isWarning = isCountdown && displayMs > 0 && displayMs <= 60000; // Less than 1 minute

  return (
    <motion.div 
      animate={isWarning ? { scale: [1, 1.1, 1], textShadow: ["0px 0px 0px rgba(249,115,22,0)", "0px 0px 20px rgba(249,115,22,0.8)", "0px 0px 0px rgba(249,115,22,0)"] } : { scale: 1 }}
      transition={isWarning ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : {}}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-md font-mono text-xl font-bold transition-colors ${
        isFinished
          ? "bg-red-100/90 text-red-600 border-red-300"
          : isWarning
            ? "bg-orange-100/90 text-orange-600 border-orange-300"
            : "bg-white/80 text-emerald-600 border-emerald-500/40"
      }`}
    >
      <Clock className={`w-5 h-5 ${isFinished ? "text-red-600" : isWarning ? "text-orange-600" : "text-emerald-600"}`} />
      {formatTime(displayMs)}
    </motion.div>
  );
}

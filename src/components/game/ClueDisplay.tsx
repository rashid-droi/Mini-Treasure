"use client";

import { FileText, Image as ImageIcon, HelpCircle, MapPin, Box } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

export type ClueType = "TEXT" | "IMAGE" | "RIDDLE" | "LOCATION" | "OBJECT" | "QUESTION";

export interface Clue {
  id: string;
  name: string;
  description: string | null;
  type: ClueType;
  mediaUrl: string | null;
  points: number;
  targetX: number;
  targetY: number;
  options?: string[];
}

export default function ClueDisplay({ clue }: { clue: Clue }) {
  
  const renderContent = () => {
    if (clue.type === "TEXT") {
      return (
        <div className="bg-white/90 backdrop-blur-xl border border-zinc-200 rounded-2xl p-6 shadow-xl w-full max-w-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">{clue.name}</h3>
          </div>
          <p className="text-zinc-600 leading-relaxed">
            {clue.description}
          </p>
          <div className="mt-4 text-xs font-medium text-zinc-500 uppercase tracking-widest">
            Worth {clue.points} pts
          </div>
        </div>
      );
    }

    if (clue.type === "IMAGE") {
      return (
        <div className="bg-white/90 backdrop-blur-md border border-zinc-200 rounded-2xl p-2 shadow-2xl w-full max-w-sm group">
          <div className="relative rounded-xl overflow-hidden aspect-video bg-zinc-100 border border-zinc-200">
            {clue.mediaUrl ? (
              <Image 
                src={clue.mediaUrl} 
                alt={clue.name}
                fill
                sizes="(max-width: 768px) 100vw, 384px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                priority={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-400">
                <ImageIcon className="w-10 h-10 opacity-50" />
              </div>
            )}
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-bold text-white border border-white/20">
              {clue.points} pts
            </div>
          </div>
          <div className="p-4 text-center">
            <h3 className="text-lg font-bold text-zinc-900">{clue.name}</h3>
            {clue.description && <p className="text-sm text-zinc-600 mt-1">{clue.description}</p>}
          </div>
        </div>
      );
    }

    if (clue.type === "RIDDLE") {
      return (
        <div className="relative bg-amber-50 border border-amber-300 rounded-lg p-8 shadow-[0_0_30px_rgba(217,119,6,0.15)] w-full max-w-sm overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-100 via-amber-50 to-white pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <HelpCircle className="w-8 h-8 text-amber-600 mb-4 opacity-80" />
            <h3 className="text-lg font-serif italic text-amber-700 mb-2">{clue.name}</h3>
            <p className="text-amber-900 font-serif text-lg leading-relaxed mb-6">
              &quot;{clue.description}&quot;
            </p>
            <div className="w-12 h-px bg-amber-400" />
            <div className="mt-4 text-xs font-medium text-amber-700 tracking-[0.2em]">
              REWARD: {clue.points} PTS
            </div>
          </div>
        </div>
      );
    }

    if (clue.type === "LOCATION") {
      return (
        <div className="bg-emerald-50/95 backdrop-blur-xl border border-emerald-300 rounded-2xl p-6 shadow-lg shadow-emerald-900/10 w-full max-w-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 text-emerald-500/10 rotate-12 pointer-events-none">
            <MapPin className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <MapPin className="w-5 h-5" />
              <span className="text-xs font-bold tracking-widest uppercase">Location Hint</span>
            </div>
            <h3 className="text-2xl font-bold text-emerald-950 mb-3">{clue.name}</h3>
            <p className="text-emerald-800 text-sm leading-relaxed border-l-2 border-emerald-400 pl-3">
              {clue.description}
            </p>
            <div className="mt-4 flex justify-end">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                +{clue.points} Points
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (clue.type === "OBJECT") {
      return (
        <div className="bg-white/95 backdrop-blur-xl border-t-4 border-t-[#f5c518] border-x border-b border-x-zinc-200 border-b-zinc-200 rounded-xl p-6 shadow-2xl w-full max-w-sm">
          <div className="flex justify-between items-start gap-3 mb-3">
            <span className="text-xs font-bold tracking-widest uppercase text-[#c99a00]">Your Question</span>
            <div className="p-2 bg-[#f5c518]/15 text-[#c99a00] rounded-lg shrink-0">
              <Box className="w-6 h-6" />
            </div>
          </div>
          <p className="text-lg font-bold text-zinc-900 leading-snug">
            {clue.description || clue.name}
          </p>
          <div className="mt-4 text-center">
            <span className="text-xs font-medium text-zinc-500">
              Find this object to earn <strong className="text-[#c99a00]">{clue.points} points</strong>
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      key={clue.id} // Re-animate when ID changes
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, y: -20, filter: "blur(10px)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {renderContent()}
    </motion.div>
  );
}

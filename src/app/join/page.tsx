"use client";

import { useActionState, useEffect, useState } from "react";
import { joinEventByCode, lookupEventByCode } from "@/actions/join";
import Link from "next/link";
import { Loader2, Users, User } from "lucide-react";

const initialState = { error: "" };

type EventPreview = { found: true; name: string; mode: "TEAM" | "INDIVIDUAL" } | { found: false };

export default function JoinEventPage() {
  const [state, formAction, isPending] = useActionState(joinEventByCode, initialState);

  // Peek at the event once a full code is typed, so the player can see its name
  // and whether it's a Team or Individual game before committing.
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<EventPreview | null>(null);

  useEffect(() => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length < 6) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await lookupEventByCode(normalized);
      if (!cancelled) setPreview(res as EventPreview);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mini Treasure" className="h-11 w-auto mx-auto mb-5" />
          <h1 className="text-3xl font-black text-zinc-900">Join an Event</h1>
          <p className="text-zinc-500 mt-2 text-sm">
            Enter the code your event host shared with you and pick a name.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Your Name</label>
            <input
              type="text"
              name="username"
              required
              autoComplete="off"
              maxLength={24}
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all duration-300"
              placeholder="Shown to other players"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Join Code</label>
            <input
              type="text"
              name="code"
              required
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 text-center text-2xl font-mono tracking-[0.4em] uppercase placeholder:text-zinc-400 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all duration-300"
              placeholder="e.g. XK4T2M"
            />

            {preview?.found && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <span className="text-sm font-medium text-zinc-700 truncate">{preview.name}</span>
                <span
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    preview.mode === "TEAM"
                      ? "bg-[#f5c518]/15 text-[#a8820a] border-[#f5c518]/40"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  }`}
                >
                  {preview.mode === "TEAM" ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  {preview.mode === "TEAM" ? "Team mode" : "Individual mode"}
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 font-semibold rounded-xl px-4 py-3 shadow-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining event...
              </>
            ) : "Join Event"}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Changed your mind?{" "}
          <Link href="/" className="text-[#e8842c] hover:underline font-medium">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { unlockAdmin } from "@/actions/adminGate";
import { Loader2, Lock } from "lucide-react";

const initialState = { error: "" };

export default function AdminGate() {
  const [state, formAction, isPending] = useActionState(unlockAdmin, initialState);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mini Treasure" className="h-11 w-auto mx-auto mb-5" />
          <div className="w-12 h-12 rounded-2xl bg-[#f5c518]/15 text-[#c99a00] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-zinc-900">Admin Access</h1>
          <p className="text-zinc-500 mt-2 text-sm">Enter the access code to open the admin panel.</p>
        </div>

        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Access Code</label>
            <input
              type="password"
              name="code"
              required
              autoFocus
              autoComplete="off"
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 text-center text-lg tracking-widest placeholder:tracking-normal placeholder:text-base placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 font-semibold rounded-xl px-4 py-3 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Unlocking...
              </>
            ) : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

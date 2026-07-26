"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";
import Link from "next/link";
import { Loader2 } from "lucide-react";

const initialState = { error: "" };

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Mini Treasure" className="h-11 w-auto mx-auto mb-5" />
          <h1 className="text-3xl font-black text-zinc-900">Welcome Back</h1>
          <p className="text-zinc-500 mt-2 text-sm">Enter your credentials to access your account.</p>
        </div>

        <form action={formAction} className="space-y-5">
          {state?.error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              name="email"
              required
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all duration-300"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#f5c518] transition-all duration-300"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 font-semibold rounded-xl px-4 py-3 shadow-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : "Sign In"}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Need an account?{" "}
          <Link href="/register" className="text-[#e8842c] hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

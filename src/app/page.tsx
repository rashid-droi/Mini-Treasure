import Link from "next/link";
import { Ticket, Users, Target, Lightbulb, Trophy, Medal } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      {/* Top nav */}
      <header className="flex items-center gap-4 px-6 sm:px-10 py-5 border-b border-zinc-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Mini Treasure" className="h-10 w-auto" />
        <div className="hidden sm:block h-8 w-px bg-zinc-200" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/select.png" alt="Select" className="hidden sm:block h-9 w-auto" />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-[#f5c518]/20 text-[#c99a00] flex items-center justify-center">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-900 max-w-3xl">
          The Ultimate Treasure Hunt Experience
        </h1>
        <p className="text-zinc-500 mt-5 max-w-xl text-base sm:text-lg">
          Team up, race the clock, and hunt hidden clues across interactive scenes.
          Join an event with a code — no account needed to play.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mt-10">
          <Link
            href="/join"
            className="px-8 py-4 bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 font-semibold rounded-xl shadow-sm transition-all duration-300 active:scale-[0.98] flex items-center gap-2 text-lg"
          >
            <Ticket className="w-5 h-5" />
            Join an Event
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 w-full max-w-5xl">
          {[
            { icon: Target, color: "text-emerald-600 bg-emerald-500/10", title: "Find the Clues", text: "Click the hidden objects in each scene before time runs out." },
            { icon: Users, color: "text-blue-600 bg-blue-500/10", title: "Play in Teams", text: "Chat live with your teammates and solve clues together." },
            { icon: Lightbulb, color: "text-[#c99a00] bg-[#f5c518]/15", title: "Use Hints Wisely", text: "Stuck? Buy a hint — but it will cost your team points." },
            { icon: Medal, color: "text-[#e8842c] bg-orange-500/10", title: "Climb the Board", text: "Watch the live leaderboard and race to the top spot." },
          ].map(({ icon: Icon, color, title, text }) => (
            <div key={title} className="bg-white border border-zinc-200 rounded-2xl p-6 text-left shadow-sm">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-zinc-900 font-bold mb-1">{title}</h3>
              <p className="text-zinc-500 text-sm">{text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-zinc-500 text-sm py-6 border-t border-zinc-200 bg-white">
        Hosting an event?{" "}
        <Link href="/login" className="text-[#e8842c] hover:underline">
          Sign in
        </Link>{" "}
        to manage your games.
      </footer>
    </div>
  );
}

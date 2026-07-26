import prisma from "@/lib/prisma";
import LeaderboardAdminClient from "./LeaderboardAdminClient";

export default async function LeaderboardAdminPage() {
  // Active events first (and most recent first) so the selector defaults to the
  // event an organiser is most likely watching.
  const events = await prisma.event.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true, mode: true },
  });

  // Put ACTIVE events at the top of the list regardless of the DB ordering.
  const ordered = [...events].sort(
    (a, b) => (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1),
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Leaderboard Management</h1>
          <p className="text-zinc-500 mt-2 text-sm">Pick an event to watch its live team standings.</p>
        </div>
      </div>

      <LeaderboardAdminClient events={ordered} />
    </div>
  );
}

import Link from "next/link";
import prisma from "@/lib/prisma";
import { ArrowLeft } from "lucide-react";
import { ensureTeamCodes } from "@/actions/admin/eventTeams";
import EventTeamsClient from "./EventTeamsClient";

// Admin view: create/delete teams for a TEAM-mode event, hand out each team's
// shareable join code, and watch live standings. Players are still auto-assigned
// to a team when they join with the EVENT code — the per-team code is for the
// organiser to reference and share.
export default async function EventTeamsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  // Make sure every team has a code before we render, so there's always one to
  // copy (older teams may predate per-team codes).
  await ensureTeamCodes(eventId);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      mode: true,
      maxTeamSize: true,
      teams: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
          _count: { select: { participants: true } },
          leaderboards: { where: { eventId }, select: { score: true } },
        },
      },
    },
  });

  if (!event) {
    return <div className="p-8 text-zinc-900">Event not found.</div>;
  }

  // Rank teams by score (highest first) for the standings view.
  const rankedTeams = [...event.teams]
    .map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      members: t._count.participants,
      score: t.leaderboards[0]?.score ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <Link href="/admin/events" className="text-sm text-[#e8842c] hover:underline mb-3 inline-flex items-center gap-1 font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{event.name} — Teams &amp; Scores</h1>
        <p className="text-zinc-500 mt-2 text-sm">
          {event.mode === "TEAM"
            ? "Create teams, share each team's code, and watch live standings. Players are auto-assigned to a team when they join with the event code and their name."
            : "This is an Individual-mode event, so it has no shared teams."}
        </p>
      </div>

      {event.mode === "TEAM" && (
        <EventTeamsClient
          eventId={event.id}
          maxTeamSize={event.maxTeamSize}
          teams={rankedTeams}
        />
      )}
    </div>
  );
}

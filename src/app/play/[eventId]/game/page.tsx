import prisma from "@/lib/prisma";
import GameplayUIClient from "./GameplayUIClient";
import { getPlayerFromCookies } from "@/lib/playerSession";

export default async function GameplayRoute({
  params
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params;

  const payload = await getPlayerFromCookies();
  if (!payload) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-900 p-4 text-center">
        <h1 className="text-xl font-bold mb-2">You&apos;re not signed in</h1>
        <p className="text-zinc-500">Join this event with your code and name first.</p>
      </div>
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { scene: true }
  });

  if (!event) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-rose-500">
        Event not found.
      </div>
    );
  }

  const participant = await prisma.participant.findFirst({
    where: { userId: payload.id, team: { eventId } },
    include: { team: true }
  });

  if (!participant) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-900 p-4 text-center">
        <h1 className="text-xl font-bold mb-2">You haven&apos;t joined this event</h1>
        <p className="text-zinc-500">Use your event code to join before entering gameplay.</p>
      </div>
    );
  }

  if (event.status !== "ACTIVE") {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-900 text-center p-8">
        <h1 className="text-2xl font-bold mb-2">Game is not active</h1>
        <p className="text-zinc-500">The event is currently in {event.status} status.</p>
      </div>
    );
  }

  // Safety net for events that were made ACTIVE before startTime was stamped
  // (e.g. legacy events, or activated by a path that didn't set it): mark the
  // start when the first player actually enters. The `startTime: null` guard
  // makes this idempotent and race-safe across simultaneous entries.
  if (!event.startTime) {
    const now = new Date();
    const endTime = event.gameDuration ? new Date(now.getTime() + event.gameDuration * 60_000) : null;
    const stamped = await prisma.event.updateMany({
      where: { id: eventId, startTime: null },
      data: { startTime: now, endTime },
    });
    if (stamped.count > 0) {
      event.startTime = now;
      event.endTime = endTime;
    } else {
      const fresh = await prisma.event.findUnique({
        where: { id: eventId },
        select: { startTime: true, endTime: true },
      });
      event.startTime = fresh?.startTime ?? null;
      event.endTime = fresh?.endTime ?? null;
    }
  }

  if (!event.sceneId || !event.scene) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center text-zinc-900 text-center p-8">
        <h1 className="text-2xl font-bold mb-2">No scene assigned</h1>
        <p className="text-zinc-500 max-w-md">
          This event does not have a scene yet. Ask the organizer to pick a scene in the admin panel before gameplay can start.
        </p>
      </div>
    );
  }

  // Fetch all clues for the map setup
  const clues = await prisma.clue.findMany({
    where: { sceneId: event.sceneId }
  });

  // Fetch already found clues
  const foundAnswers = await prisma.teamAnswer.findMany({
    where: { teamId: participant.teamId, eventId, isCorrect: true },
    select: { clueId: true }
  });
  const foundClues = foundAnswers.map(a => a.clueId);

  return (
    <GameplayUIClient
      event={{
        id: event.id,
        name: event.name,
        sceneId: event.sceneId,
        startTime: event.startTime?.toISOString() ?? "",
        endTime: event.endTime?.toISOString() ?? "",
        gameDuration: event.gameDuration
      }}
      team={participant.team}
      userId={payload.id}
      playerName={payload.username}
      initialClues={clues}
      initialFoundClues={foundClues}
      clickTolerance={event.scene?.clickTolerance ?? 8}
      sceneGuideUrl={event.scene?.imageUrl ?? null}
    />
  );
}

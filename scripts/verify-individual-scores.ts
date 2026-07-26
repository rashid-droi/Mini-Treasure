// Proves individual scoring: two players join an event (each as their own solo
// team named after them, exactly as join.ts does), each answers their current
// question, and the leaderboard shows two separate rows with individual scores.
//
// Run: npx tsx scripts/verify-individual-scores.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { validateClick } from "../src/actions/gameplay";

const SCENE_ID = "scene1";
const tag = `indiv-${Date.now()}`;

async function joinSolo(eventId: string, name: string, activeClueId: string) {
  const user = await prisma.user.create({ data: { email: `${name}@t.co`, username: name, password: "x" } });
  const team = await prisma.team.create({ data: { name, eventId, activeClueId } }); // solo team named after the player
  await prisma.participant.create({ data: { userId: user.id, teamId: team.id } });
  return { user, team };
}

async function main() {
  const clues = await prisma.clue.findMany({ where: { sceneId: SCENE_ID }, orderBy: { order: "asc" } });
  const q1 = clues[0];

  const event = await prisma.event.create({
    data: { name: tag, joinCode: tag, sceneId: SCENE_ID, status: "ACTIVE", startTime: new Date(), endTime: new Date(Date.now() + 30 * 60000) },
  });

  const alice = await joinSolo(event.id, `${tag}-Alice`, q1.id);
  const bob = await joinSolo(event.id, `${tag}-Bob`, q1.id);

  // Alice answers her Q1 correctly; Bob does not answer yet.
  await validateClick(alice.team.id, event.id, q1.targetX, q1.targetY, alice.user.id);
  // Bob answers his Q1 correctly too, a moment later.
  await validateClick(bob.team.id, event.id, q1.targetX, q1.targetY, bob.user.id);

  const board = await prisma.leaderboard.findMany({
    where: { eventId: event.id },
    include: { team: { select: { name: true, participants: { select: { user: { select: { username: true } } } } } } },
    orderBy: { score: "desc" },
  });

  console.log("Leaderboard rows (one per player):");
  for (const row of board) {
    console.log(`  ${row.team.name.replace(tag + "-", "")}: ${row.score} pts  (players: ${row.team.participants.map(p => p.user.username.replace(tag + "-", "")).join(", ")})`);
  }

  const ok = board.length === 2 && board.every(r => r.score === q1.points) && board.every(r => r.team.participants.length === 1);
  console.log(ok
    ? "\n✅ PASS: two separate leaderboard rows, each with the player's own individual score."
    : "\n❌ FAIL: scores did not land as individual per-player rows.");

  await prisma.event.delete({ where: { id: event.id } });
  await prisma.user.deleteMany({ where: { username: { in: [alice.user.username, bob.user.username] } } });
  console.log("cleaned up.");
  if (!ok) process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

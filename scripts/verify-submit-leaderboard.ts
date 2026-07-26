// Proves the "Submit this" path: submitting the current question's object via
// validateClick() scores it correct, advances to the next question, and adds
// the points to the leaderboard. Creates throwaway data and cleans it up.
//
// Run: npx tsx scripts/verify-submit-leaderboard.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { validateClick } from "../src/actions/gameplay";

const SCENE_ID = "scene1";
const tag = `verify-${Date.now()}`;

async function main() {
  const clues = await prisma.clue.findMany({
    where: { sceneId: SCENE_ID },
    orderBy: { order: "asc" },
  });
  if (clues.length < 2) throw new Error("Seed scene1 first (need the 30 quiz clues).");
  const q1 = clues[0];
  const q2 = clues[1];
  console.log(`Q1 (order ${q1.order}): "${q1.description}" @ (${q1.targetX}, ${q1.targetY}), ${q1.points} pts`);

  // Throwaway player + event(ACTIVE) + team, with Q1 as the active clue.
  const user = await prisma.user.create({
    data: { email: `${tag}@t.co`, username: tag, password: "x" },
  });
  const event = await prisma.event.create({
    data: {
      name: tag, joinCode: tag, sceneId: SCENE_ID, status: "ACTIVE",
      startTime: new Date(),
      endTime: new Date(Date.now() + 30 * 60000),
    },
  });
  const team = await prisma.team.create({
    data: { name: `${tag}-team`, eventId: event.id, activeClueId: q1.id },
  });
  const participant = await prisma.participant.create({
    data: { userId: user.id, teamId: team.id },
  });

  const before = await prisma.leaderboard.findUnique({
    where: { eventId_teamId: { eventId: event.id, teamId: team.id } },
  });
  console.log(`Leaderboard before: ${before?.score ?? 0} (no row yet)`);

  // Submit the CORRECT object for the current question (Q1's own coordinates).
  const res = await validateClick(team.id, event.id, q1.targetX, q1.targetY, user.id);
  console.log("validateClick result:", JSON.stringify(res));

  const after = await prisma.leaderboard.findUnique({
    where: { eventId_teamId: { eventId: event.id, teamId: team.id } },
  });
  const teamAfter = await prisma.team.findUnique({ where: { id: team.id } });

  const ok =
    "status" in res && res.status === "correct" &&
    (after?.score ?? 0) === q1.points &&
    teamAfter?.activeClueId === q2.id;

  console.log(`Leaderboard after:  ${after?.score ?? 0}`);
  console.log(`Next active clue:   ${teamAfter?.activeClueId === q2.id ? `Q2 "${q2.description}"` : teamAfter?.activeClueId}`);
  console.log(ok
    ? "\n✅ PASS: correct submit added points to leaderboard AND advanced to the next question."
    : "\n❌ FAIL: something in the submit/leaderboard/advance chain did not happen.");

  // Also confirm a WRONG object (Q2's spot, not the active question) does NOT score.
  const wrong = await validateClick(team.id, event.id, q2.targetX, q2.targetY, user.id);
  console.log(`\nWrong-object submit -> status: ${"status" in wrong ? wrong.status : JSON.stringify(wrong)} (expected "wrong")`);

  // Cleanup (event delete cascades team/participant/leaderboard/answers).
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Cleaned up test data.");

  if (!ok) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

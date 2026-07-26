// End-to-end: connects a real socket.io client (like a browser tab), joins a
// throwaway team, and emits validate_click for the current question's object —
// exactly what the "Submit this" button does. Asserts the server acks "correct",
// broadcasts the next clue + score_update, and the leaderboard is incremented.
//
// Requires the dev server running. Run: npx tsx scripts/verify-socket-submit.ts
import "dotenv/config";
import prisma from "../src/lib/prisma";
import { io } from "socket.io-client";

const URL = "http://localhost:3000";
const SCENE_ID = "scene1";
const tag = `sock-${Date.now()}`;

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const clues = await prisma.clue.findMany({ where: { sceneId: SCENE_ID }, orderBy: { order: "asc" } });
  const q1 = clues[0], q2 = clues[1];

  const user = await prisma.user.create({ data: { email: `${tag}@t.co`, username: tag, password: "x" } });
  const event = await prisma.event.create({
    data: { name: tag, joinCode: tag, sceneId: SCENE_ID, status: "ACTIVE", startTime: new Date(), endTime: new Date(Date.now() + 30 * 60000) },
  });
  const team = await prisma.team.create({ data: { name: `${tag}-t`, eventId: event.id, activeClueId: q1.id } });
  await prisma.participant.create({ data: { userId: user.id, teamId: team.id } });

  const socket = io(URL, { transports: ["websocket", "polling"] });
  let clueLocked: any = null;
  let scoreUpdate: any = null;
  socket.on("clue_locked", (p) => { clueLocked = p; });
  socket.on("score_update", (p) => { scoreUpdate = p; });

  await new Promise<void>((res, rej) => {
    socket.on("connect", () => res());
    socket.on("connect_error", (e) => rej(e));
    setTimeout(() => rej(new Error("connect timeout")), 5000);
  });
  console.log("socket connected:", socket.id);

  socket.emit("join_team", { teamId: team.id, eventId: event.id, userId: user.id });
  await wait(500);

  console.log(`Submitting Q1 "${q1.description}" @ (${q1.targetX}, ${q1.targetY})`);
  const ack: any = await new Promise((res) => {
    socket.emit("validate_click", { x: q1.targetX, y: q1.targetY }, (r: any) => res(r));
    setTimeout(() => res({ error: "ack timeout" }), 5000);
  });
  console.log("validate_click ack:", JSON.stringify(ack));

  await wait(500); // let broadcasts arrive
  const lb = await prisma.leaderboard.findUnique({ where: { eventId_teamId: { eventId: event.id, teamId: team.id } } });

  console.log("clue_locked broadcast:", clueLocked ? `nextClue="${clueLocked.nextClue?.description}" pts=${clueLocked.pointsAwarded}` : "NONE");
  console.log("score_update broadcast:", scoreUpdate ? JSON.stringify(scoreUpdate) : "NONE");
  console.log("leaderboard score:", lb?.score ?? 0);

  const ok = ack.status === "correct" && !!clueLocked && clueLocked.nextClue?.id === q2.id && !!scoreUpdate && (lb?.score ?? 0) === q1.points;
  console.log(ok
    ? "\n✅ PASS: socket submit acked correct, broadcast next question, and incremented the leaderboard."
    : "\n❌ FAIL: something in the live socket path did not fire.");

  socket.disconnect();
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("cleaned up.");
  if (!ok) process.exitCode = 1;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

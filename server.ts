import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server, Socket } from "socket.io";
import { parse } from "url";
import prisma from "./src/lib/prisma";
import { validateClick, submitAnswer } from "./src/actions/gameplay";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  function isRateLimited(socket: Socket, key: string, limitMs = 500) {
    if (!socket.data.rateLimits) socket.data.rateLimits = new Map<string, number>();
    const now = Date.now();
    const lastTime = socket.data.rateLimits.get(key) || 0;
    if (now - lastTime < limitMs) return true;
    socket.data.rateLimits.set(key, now);
    return false;
  }

  const onlineByEvent = new Map<string, Map<string, number>>();
  function markOnline(eventId: string, userId: string) {
    const users = onlineByEvent.get(eventId) ?? new Map<string, number>();
    users.set(userId, (users.get(userId) ?? 0) + 1);
    onlineByEvent.set(eventId, users);
  }
  function markOffline(eventId: string, userId: string) {
    const users = onlineByEvent.get(eventId);
    if (!users) return;
    const remaining = (users.get(userId) ?? 1) - 1;
    if (remaining <= 0) users.delete(userId);
    else users.set(userId, remaining);
  }
  function getOnlineUserIds(eventId: string): Set<string> {
    return new Set(onlineByEvent.get(eventId)?.keys() ?? []);
  }

  async function broadcastEventRoster(eventId: string) {
    try {
      const players = await prisma.participant.findMany({
        where: { team: { eventId } },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { joinedAt: "asc" }
      });
      const online = getOnlineUserIds(eventId);
      const withPresence = players.map(p => ({ ...p, online: online.has(p.userId) }));
      io.to(`event_${eventId}`).emit("event_roster", withPresence);
    } catch (err) {
      console.error("Failed to broadcast event roster:", err);
    }
  }

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join Admin Monitor
    socket.on("join_admin_monitor", ({ eventId }) => {
      socket.join(`admin_monitor_${eventId}`);
    });

    // Join Team (Authenticates and stores in socket.data)
    socket.on("join_team", async ({ teamId, eventId, userId }) => {
      // Admin bypass
      if (teamId === "admin") {
        socket.join(`event_${eventId}`);
        return;
      }

      try {
        // Validate that this user is actually in this team and event
        const participant = await prisma.participant.findFirst({
          where: { userId, teamId, team: { eventId } }
        });

        if (!participant) {
          console.warn(`Unauthorized join_team attempt by user ${userId}`);
          return;
        }

        // Leave previous rooms if reconnecting/switching
        if (socket.data.teamId) {
          socket.leave(`team_${socket.data.teamId}`);
          socket.leave(`event_${socket.data.eventId}`);
        }

        socket.join(`team_${teamId}`);
        socket.join(`event_${eventId}`);

        socket.data.teamId = teamId;
        socket.data.eventId = eventId;
        socket.data.userId = userId;
        socket.data.participantId = participant.id;

        markOnline(eventId, userId);

        const count = io.sockets.adapter.rooms.get(`team_${teamId}`)?.size || 0;
        io.to(`admin_monitor_${eventId}`).emit("admin_online_players", { teamId, count });
        console.log(`Socket ${socket.id} joined team_${teamId} and event_${eventId}`);

        broadcastEventRoster(eventId);
      } catch (err) {
        console.error("Failed to authenticate join_team:", err);
      }
    });

    socket.on("toggle_ready", async ({ isReady }) => {
      const { participantId, teamId, eventId } = socket.data;
      if (!participantId || !teamId || !eventId) return;

      try {
        await prisma.participant.update({
          where: { id: participantId },
          data: { isReady }
        });
        io.to(`event_${eventId}`).emit("participant_updated", { participantId, isReady });
      } catch (err) {
        console.error("Failed to toggle ready via socket:", err);
      }
    });

    socket.on("send_message", async ({ content }) => {
      if (isRateLimited(socket, "send_message", 500)) return;
      
      const { teamId, eventId, userId } = socket.data;
      if (!eventId || !userId) return; // Must be authenticated

      try {
        const chat = await prisma.chat.create({
          data: {
            teamId: teamId ?? null,
            eventId,
            senderId: userId,
            message: content
          },
          include: {
            sender: { select: { id: true, username: true } }
          }
        });
        io.to(`team_${teamId}`).emit("new_message", chat);
        io.to(`admin_monitor_${eventId}`).emit("admin_chat_activity", { teamId, content, senderId: userId });
      } catch (err) {
        console.error("Failed to save chat via socket:", err);
      }
    });

    socket.on("validate_click", async ({ x, y }, callback) => {
      if (isRateLimited(socket, "validate_click", 500)) return;

      const { teamId, eventId, participantId, userId } = socket.data;
      const teamRoom = `team_${teamId}`;
      const eventRoom = `event_${eventId}`;
      if (!teamId || !eventId || !participantId) return;

      try {
        // Pass the User id (not participantId): it is recorded as TeamAnswer.userId,
        // which is a foreign key to User.
        const res = await validateClick(teamId, eventId, x, y, userId);
        
        if ('error' in res) {
          socket.emit("validate_click_response", { success: false, error: res.error });
          return;
        }

        if (res.status === "correct") {
          // Broadcast to team
          io.to(teamRoom).emit("clue_locked", {
            clueId: res.clueId,
            userId: socket.data.userId,
            pointsAwarded: res.pointsAwarded,
            nextClue: res.nextClue,
            completed: res.completed
          });
          io.to(eventRoom).emit("score_update", { teamId, pointsAwarded: res.pointsAwarded });
          io.to(`admin_monitor_${eventId}`).emit("admin_clue_solved", { teamId });
        } else {
          socket.emit("validate_click_response", { success: false, status: res.status });
          io.to(teamRoom).emit("bad_click_registered", { userId: socket.data.userId });
          io.to(`admin_monitor_${eventId}`).emit("admin_wrong_click", { teamId });
        }
        
        if (callback) callback(res);
      } catch (err) {
        console.error("Failed to validate click via socket:", err);
        if (callback) callback({ error: "Server error during validation" });
      }
    });

    socket.on("submit_answer", async ({ answer }, callback) => {
      if (isRateLimited(socket, "submit_answer", 500)) return;

      const { teamId, eventId, participantId, userId } = socket.data;
      const teamRoom = `team_${teamId}`;
      const eventRoom = `event_${eventId}`;
      if (!teamId || !eventId || !participantId) return;
      if (typeof answer !== "string" || !answer.trim()) return;

      try {
        // Pass the User id (not participantId): it is recorded as TeamAnswer.userId,
        // which is a foreign key to User.
        const res = await submitAnswer(teamId, eventId, answer, userId);

        if ('error' in res) {
          socket.emit("validate_click_response", { success: false, error: res.error });
          if (callback) callback(res);
          return;
        }

        if (res.status === "correct") {
          // Broadcast to team
          io.to(teamRoom).emit("clue_locked", {
            clueId: res.clueId,
            userId: socket.data.userId,
            pointsAwarded: res.pointsAwarded,
            nextClue: res.nextClue,
            completed: res.completed
          });
          io.to(eventRoom).emit("score_update", { teamId, pointsAwarded: res.pointsAwarded });
          io.to(`admin_monitor_${eventId}`).emit("admin_clue_solved", { teamId });
        } else {
          socket.emit("validate_click_response", { success: false, status: res.status });
          io.to(teamRoom).emit("bad_click_registered", { userId: socket.data.userId });
          io.to(`admin_monitor_${eventId}`).emit("admin_wrong_click", { teamId });
        }

        if (callback) callback(res);
      } catch (err) {
        console.error("Failed to submit answer via socket:", err);
        if (callback) callback({ error: "Server error during validation" });
      }
    });

    socket.on("buy_hint", async () => {
      if (isRateLimited(socket, "buy_hint", 1000)) return;

      const { teamId, eventId } = socket.data;
      if (!teamId || !eventId) return;

      try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team || team.activeClueHints >= 3) return;

        const newHints = team.activeClueHints + 1;

        await prisma.team.update({
          where: { id: teamId },
          data: { 
            activeClueHints: newHints,
            totalHintsUsed: { increment: 1 } 
          }
        });

        await prisma.leaderboard.upsert({
          where: { eventId_teamId: { eventId, teamId } },
          update: { score: { decrement: 10 } },
          create: { eventId, teamId, score: -10 }
        });

        io.to(`team_${teamId}`).emit("hint_unlocked", { hintsUsed: newHints });
        io.to(`event_${eventId}`).emit("score_update", { teamId, pointsDeducted: 10 });
      } catch (err) {
        console.error("Failed to buy hint:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);

      const { teamId, eventId, userId } = socket.data;
      if (!eventId) return;

      try {
        if (userId) {
          markOffline(eventId, userId);
          broadcastEventRoster(eventId);
        }
        if (teamId) {
          const count = io.sockets.adapter.rooms.get(`team_${teamId}`)?.size || 0;
          io.to(`admin_monitor_${eventId}`).emit("admin_online_players", { teamId, count });
        }
      } catch (err) {
        console.error("Error during disconnect cleanup:", err);
      }
    });
  });

  // Exit loudly if the port can't be bound (e.g. another dev server is still
  // running) instead of lingering as a process that serves nothing.
  httpServer.once("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`> Port ${port} is already in use. Stop the other server (lsof -nP -iTCP:${port} -sTCP:LISTEN) and try again.`);
    } else {
      console.error("> Failed to start server:", err);
    }
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

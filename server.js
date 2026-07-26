"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // Must load env before the Prisma client is created below
var node_http_1 = require("node:http");
var next_1 = __importDefault(require("next"));
var socket_io_1 = require("socket.io");
var url_1 = require("url");
var prisma_1 = __importDefault(require("./src/lib/prisma")); // Direct DB access from socket server
var dev = process.env.NODE_ENV !== "production";
var hostname = "localhost";
var port = parseInt(process.env.PORT || "3000", 10);
var app = (0, next_1.default)({ dev: dev, hostname: hostname, port: port });
var handle = app.getRequestHandler();
app.prepare().then(function () {
    var httpServer = (0, node_http_1.createServer)(function (req, res) {
        var parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    var io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    // Basic in-memory rate limiting to prevent spam
    var rateLimits = new Map();
    function isRateLimited(socketId, limitMs) {
        if (limitMs === void 0) { limitMs = 500; }
        var now = Date.now();
        var lastTime = rateLimits.get(socketId) || 0;
        if (now - lastTime < limitMs)
            return true;
        rateLimits.set(socketId, now);
        return false;
    }
    // Send the full list of joined players to everyone waiting in the event room
    function broadcastEventRoster(eventId) {
        return __awaiter(this, void 0, void 0, function () {
            var players, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.default.participant.findMany({
                                where: { team: { eventId: eventId } },
                                include: { user: { select: { id: true, username: true } } },
                                orderBy: { joinedAt: "asc" }
                            })];
                    case 1:
                        players = _a.sent();
                        io.to("event_".concat(eventId)).emit("event_roster", players);
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        console.error("Failed to broadcast event roster:", err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    io.on("connection", function (socket) {
        console.log("Socket connected: ".concat(socket.id));
        // Join Team and Event rooms
        socket.on("join_admin_monitor", function (_a) {
            var eventId = _a.eventId;
            socket.join("admin_monitor_".concat(eventId));
        });
        socket.on("join_team", function (_a) {
            var _b;
            var teamId = _a.teamId, eventId = _a.eventId;
            socket.join("team_".concat(teamId));
            socket.join("event_".concat(eventId));
            // Notify admin monitor of player count change
            var count = ((_b = io.sockets.adapter.rooms.get("team_".concat(teamId))) === null || _b === void 0 ? void 0 : _b.size) || 0;
            io.to("admin_monitor_".concat(eventId)).emit("admin_online_players", { teamId: teamId, count: count });
            console.log("Socket ".concat(socket.id, " joined team_").concat(teamId, " and event_").concat(eventId));
            // Push the up-to-date roster to everyone in the waiting room (including this socket)
            broadcastEventRoster(eventId);
        });
        // Handle Ready Toggle
        socket.on("toggle_ready", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var room, err_2;
            var participantId = _b.participantId, teamId = _b.teamId, eventId = _b.eventId, isReady = _b.isReady;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, prisma_1.default.participant.update({
                                where: { id: participantId },
                                data: { isReady: isReady }
                            })];
                    case 1:
                        _c.sent();
                        room = eventId ? "event_".concat(eventId) : "team_".concat(teamId);
                        io.to(room).emit("participant_updated", { participantId: participantId, isReady: isReady });
                        return [3 /*break*/, 3];
                    case 2:
                        err_2 = _c.sent();
                        console.error("Failed to toggle ready via socket:", err_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
        // Handle Chat Messages (event-wide when no teamId is given)
        socket.on("send_message", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var eventIdStr, senderId, chat, err_3;
            var _c;
            var eventId = _b.eventId, teamId = _b.teamId, userId = _b.userId, participantId = _b.participantId, content = _b.content;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (isRateLimited(socket.id, 500))
                            return [2 /*return*/]; // Max 2 messages per sec
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        eventIdStr = eventId
                            || ((_c = Array.from(socket.rooms).find(function (r) { return r.startsWith("event_"); })) === null || _c === void 0 ? void 0 : _c.replace("event_", ""));
                        if (!eventIdStr)
                            return [2 /*return*/];
                        senderId = userId || participantId;
                        return [4 /*yield*/, prisma_1.default.chat.create({
                                data: {
                                    teamId: teamId !== null && teamId !== void 0 ? teamId : null,
                                    eventId: eventIdStr,
                                    senderId: senderId,
                                    message: content
                                },
                                include: {
                                    sender: { select: { id: true, username: true } }
                                }
                            })];
                    case 2:
                        chat = _d.sent();
                        // Team messages go to the team room; event-wide messages to the event room
                        io.to(teamId ? "team_".concat(teamId) : "event_".concat(eventIdStr)).emit("new_message", chat);
                        // Broadcast to Admin Monitor
                        io.to("admin_monitor_".concat(eventIdStr)).emit("admin_chat_activity", { teamId: teamId, content: content, senderId: senderId });
                        return [3 /*break*/, 4];
                    case 3:
                        err_3 = _d.sent();
                        console.error("Failed to save chat via socket:", err_3);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        // Handle Game Progress (Clue Found)
        socket.on("clue_found", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var teamId = _b.teamId, eventId = _b.eventId, clueId = _b.clueId, userId = _b.userId;
            return __generator(this, function (_c) {
                // In a real app, we'd also call submitClueAnswer logic here to validate.
                // For now, we'll just broadcast the UI lock immediately to make it snappy,
                // and let the server action or a separate DB call finalize it.
                io.to("team_".concat(teamId)).emit("clue_locked", { clueId: clueId, userId: userId });
                // We can also broadcast a global score update
                io.to("event_".concat(eventId)).emit("score_update", { teamId: teamId, pointsAwarded: 10 });
                // Notify Admin Monitor
                io.to("admin_monitor_".concat(eventId)).emit("admin_clue_solved", { teamId: teamId });
                return [2 /*return*/];
            });
        }); });
        // Handle Buying Hints
        socket.on("buy_hint", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var team, newHints, err_4;
            var teamId = _b.teamId, eventId = _b.eventId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, prisma_1.default.team.findUnique({ where: { id: teamId } })];
                    case 1:
                        team = _c.sent();
                        if (!team || team.activeClueHints >= 3)
                            return [2 /*return*/];
                        newHints = team.activeClueHints + 1;
                        // 1. Increment hints
                        return [4 /*yield*/, prisma_1.default.team.update({
                                where: { id: teamId },
                                data: { activeClueHints: newHints }
                            })];
                    case 2:
                        // 1. Increment hints
                        _c.sent();
                        // 2. Deduct 10 points
                        return [4 /*yield*/, prisma_1.default.leaderboard.upsert({
                                where: { eventId_teamId: { eventId: eventId, teamId: teamId } },
                                update: { score: { decrement: 10 } },
                                create: { eventId: eventId, teamId: teamId, score: -10 }
                            })];
                    case 3:
                        // 2. Deduct 10 points
                        _c.sent();
                        // 3. Broadcast to Team that hint is unlocked
                        io.to("team_".concat(teamId)).emit("hint_unlocked", { hintsUsed: newHints });
                        // 4. Broadcast global score update (Admin dashboard)
                        io.to("event_".concat(eventId)).emit("score_update", { teamId: teamId, pointsDeducted: 10 });
                        return [3 /*break*/, 5];
                    case 4:
                        err_4 = _c.sent();
                        console.error("Failed to buy hint:", err_4);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); });
        // Handle Wrong Clicks (Accuracy Penalty)
        socket.on("wrong_click", function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var err_5;
            var teamId = _b.teamId, eventId = _b.eventId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (isRateLimited(socket.id, 1000))
                            return [2 /*return*/]; // Prevent spam-clicking penalty buildup
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, prisma_1.default.team.update({
                                where: { id: teamId },
                                data: { wrongAttempts: { increment: 1 } }
                            })];
                    case 2:
                        _c.sent();
                        // Broadcast the bad click so the UI can shake or show an X (optional visual feedback)
                        io.to("team_".concat(teamId)).emit("bad_click_registered");
                        // Notify Admin Monitor
                        io.to("admin_monitor_".concat(eventId)).emit("admin_wrong_click", { teamId: teamId });
                        return [3 /*break*/, 4];
                    case 3:
                        err_5 = _c.sent();
                        console.error("Failed to register wrong click:", err_5);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
        socket.on("disconnect", function () {
            console.log("Socket disconnected: ".concat(socket.id));
            // In a real app, we would ideally untrack the socket from its team room here and update the admin.
            // Since Socket.io removes disconnected sockets from rooms automatically before 'disconnecting' or during, 
            // we could listen to 'disconnecting' to grab the rooms and notify admins.
        });
    });
    httpServer.listen(port, function () {
        console.log("> Ready on http://".concat(hostname, ":").concat(port));
    });
});

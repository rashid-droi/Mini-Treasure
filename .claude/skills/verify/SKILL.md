---
name: verify
description: How to launch and drive Mini Treasure (custom Next.js + Socket.IO server) for runtime verification.
---

# Verifying Mini Treasure

## Build/launch

- Dev: `npm run dev` (runs `tsx server.ts` directly — no separate build step, but
  the process must be **restarted** to pick up any edit to `server.ts` or files it
  imports; only Next.js page/component code hot-reloads).
- Check first whether a dev server is already running before starting a new one:
  `pgrep -f "tsx server.ts"` / `lsof -i :3000 -sTCP:LISTEN -t`. If one is running
  and predates your edits (`ps -p <pid> -o lstart`), kill and restart it — `tsx`
  won't pick up server-side changes on its own.
- `server.js` is a **stale, hand-orphaned build artifact** (no script regenerates
  it; `tsconfig.json` has `noEmit: true`). Don't hand-edit it and don't trust it
  to reflect current `server.ts` behavior — `npm start` (production) would need a
  real rebuild step first.
- DB: `.env` has `DATABASE_URL`; any standalone script that imports
  `@/lib/prisma` (or `./src/lib/prisma`) must `import "dotenv/config"` **first**,
  or Prisma silently tries to connect with no URL and fails with `ECONNREFUSED`.

## Driving it without a browser

No browser/Playwright is available in this environment. Two surfaces are
reachable without one:

1. **Raw HTTP** for anything not behind a Next.js Server Action — e.g.
   `curl -i "http://localhost:3000/socket.io/?EIO=4&transport=polling"` performs
   a real Engine.IO handshake and is the fastest way to sanity-check the socket
   server is actually reachable (should be `200` with a JSON handshake body, not
   a Next.js 404 page).
2. **`socket.io-client` from a throwaway `tsx` script** to act as one or more
   real browser tabs against the live dev server. This is the main verification
   path for anything in `server.ts` (join_team, event_roster, participant_updated,
   send_message/new_message, buy_hint/hint_unlocked, wrong_click/bad_click_registered,
   disconnect cleanup). Connect with `io("http://localhost:3000")` — no custom
   `path`/`addTrailingSlash` needed; defaults on both ends already match.

Most gameplay/auth flows are Next.js Server Actions (`"use server"` functions
bound to `<form action={fn}>`), which call `cookies()` from `next/headers` —
that throws outside a real request context, so **you cannot import and call
these directly from a script**. Driving them for real requires either a browser
or replicating Next's server-action POST protocol (non-trivial). When you need
to exercise one, seed the underlying DB state directly via Prisma instead
(create the `Event`/`User`/`Team`/`Participant` rows the action would have
created) and drive the *downstream* effect (e.g. the socket layer) from there.

## Useful known state

Real event `394b9710-91a1-4884-aeac-67ac3e5a32ce` (join code `BBZQ5Q`, status
`ACTIVE`) is the user's own manual test event with two real teams/participants
(`TestAdmin`, `rashid`) — this appears to be actively used for the user's own
browser testing. Don't write throwaway/test messages or state into it; seed
separate temp `Event`/`User`/`Team`/`Participant` rows for scripted verification
and delete them (`prisma.event.delete` cascades teams/participants/answers/
leaderboards/chats) plus the throwaway `.ts` scripts when done.

## Gotcha already found this way

The client (`src/components/SocketProvider.tsx`) previously passed
`path: "/socket.io/", addTrailingSlash: false` to `io()`. Engine.io-client
strips any trailing slash from `path` first and only re-adds it when
`addTrailingSlash` is true, so that config produced `/socket.io` (no slash) —
which the server (default path `/socket.io/`) never matches, 404ing every
connection. Confirmed via `curl` returning 404 for `/socket.io` vs 200 for
`/socket.io/`. Fixed by dropping both overrides and using library defaults on
both ends.

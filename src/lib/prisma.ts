import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// `npx prisma dev` drops idle Postgres connections aggressively. A pooled
// connection the server has already closed surfaces as a connection error the
// next time it's reused — under many different signatures depending on whether
// pg, the driver adapter, or Prisma reports it first. We match broadly (message
// substrings AND error codes, walking `cause` chains) so the retry below always
// fires instead of leaking a generic failure up to the UI.
const TRANSIENT_MESSAGE_FRAGMENTS = [
  "Server has closed the connection",
  "Connection terminated",
  "connection terminated unexpectedly",
  "terminating connection",
  "Connection ended unexpectedly",
  "connection is closed",
  "Client has encountered a connection error",
  "Can't reach database server",
  "socket hang up",
  "read ECONNRESET",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "Timed out fetching a new connection",
];

// pg driver codes (SQLSTATE 08xxx / 57P0x) and Prisma connection error codes.
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED",
  "08000", "08003", "08006", "08P01", // pg connection_exception family
  "57P01", "57P02", "57P03",          // admin shutdown / crash / cannot connect now
  "P1001", "P1002", "P1008", "P1017", // Prisma: unreachable / timed out / closed
]);

function isTransientConnectionError(error: unknown): boolean {
  let current: unknown = error;
  // Walk the cause chain: pg's real error is often wrapped by the adapter/Prisma.
  for (let depth = 0; current && depth < 5; depth++) {
    const message = current instanceof Error ? current.message : String(current ?? "");
    if (TRANSIENT_MESSAGE_FRAGMENTS.some((m) => message.includes(m))) return true;

    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && TRANSIENT_ERROR_CODES.has(code)) return true;

    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const prismaClientSingleton = () => {
  // Reap our own idle connections quickly (before the dev server kills them) so
  // most queries open a fresh connection instead of reusing a dead one.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
  });

  // An idle client dropped by the server emits 'error' on the pool. Without a
  // listener that event is thrown and crashes the dev server, so swallow it —
  // the pool discards the dead client and reconnects on demand.
  pool.on("error", () => {});

  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Belt-and-suspenders: if a query still grabs a stale connection, retry it a
  // few times. Each failed attempt makes pg discard that dead client, so a fresh
  // connection is used on the next try. Only retries connection-drop errors.
  const extended = client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const MAX_ATTEMPTS = 4;
        let lastError: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (attempt === MAX_ATTEMPTS || !isTransientConnectionError(error)) throw error;
            await new Promise((r) => setTimeout(r, 50 * attempt));
          }
        }
        throw lastError;
      },
    },
  });

  // The extension only wraps query execution — it adds no models/fields — so the
  // runtime object is API-compatible with the base client. Keep the exported
  // type as PrismaClient so callers (e.g. functions taking Prisma.Transaction
  // Client) type-check exactly as before.
  return extended as unknown as PrismaClient;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

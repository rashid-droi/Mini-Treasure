import { cookies } from "next/headers";
import { verifyToken, JWTPayload } from "./auth";

// Player identity for game flows (joining, waiting room, playing).
// Players get their own "player_token" cookie, separate from the account
// login cookie, so joining as a player never logs an admin out of the
// dashboard in the same browser. The dedicated player cookie wins; we fall
// back to the account login so signed-in users can play under their account.
export async function getPlayerFromCookies(): Promise<JWTPayload | null> {
  const store = await cookies();
  return (
    verifyToken(store.get("player_token")?.value ?? "") ||
    verifyToken(store.get("token")?.value ?? "")
  );
}

import { getUsers } from "@/actions/admin/users";
import PlayersClient from "./PlayersClient";

export default async function PlayersAdminPage() {
  const res = await getUsers();
  const users = res.success && res.data ? res.data : [];

  return <PlayersClient users={users} />;
}

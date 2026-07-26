import { getTeams } from "@/actions/admin/teams";
import TeamsClient from "./TeamsClient";

export default async function TeamsAdminPage() {
  const res = await getTeams();
  const teams = res.success && res.data ? res.data : [];

  return <TeamsClient teams={teams} />;
}

import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getSessionUser } from "@/lib/session";
import { isAdminUnlocked } from "@/lib/adminGate";
import AdminGate from "@/components/admin/AdminGate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Login step removed: uses the signed-in user if present, otherwise an admin.
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") {
    // No admin account available — send to the (open) join page.
    redirect("/join");
  }

  // Passcode gate: without a valid unlock cookie, show the code entry screen
  // instead of the panel. Applies to every /admin/* page (this layout wraps them).
  if (!(await isAdminUnlocked())) {
    return <AdminGate />;
  }

  return <AdminShell>{children}</AdminShell>;
}

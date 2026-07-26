import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
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

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row text-zinc-900 font-sans overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 h-screen overflow-y-auto relative p-6 md:p-10">
        <div className="relative z-10 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

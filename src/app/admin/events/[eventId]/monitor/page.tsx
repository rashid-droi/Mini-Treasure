import AdminMonitorClient from "./AdminMonitorClient";
import prisma from "@/lib/prisma";

export default async function AdminMonitorPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  // Just a quick check to see if it exists
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) {
    return <div className="p-8 text-zinc-900">Event not found.</div>;
  }

  return <AdminMonitorClient eventId={eventId} />;
}

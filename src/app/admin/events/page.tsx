import { getEvents } from "@/actions/admin/events";
import EventsClient from "./EventsClient";
import prisma from "@/lib/prisma";

export default async function EventsAdminPage() {
  const res = await getEvents();
  const events = res.success && res.data ? res.data : [];
  const scenes = await prisma.scene.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <EventsClient events={events} scenes={scenes} />;
}

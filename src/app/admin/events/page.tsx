import { getEvents } from "@/actions/admin/events";
import EventsClient from "./EventsClient";

export default async function EventsAdminPage() {
  const res = await getEvents();
  const events = res.success && res.data ? res.data : [];

  return <EventsClient events={events} />;
}

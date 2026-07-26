import WaitingRoomClient from "./WaitingRoomClient";

// In Next.js 15, route params for dynamic routes are accessed as a Promise
export default async function WaitingRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  const eventId = resolvedParams.eventId;

  return <WaitingRoomClient eventId={eventId} />;
}

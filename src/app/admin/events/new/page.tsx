import prisma from "@/lib/prisma";
import EventForm from "./EventForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NewEventPage() {
  // Fetch available scenes for the dropdown
  const scenes = await prisma.scene.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex flex-col gap-2">
        <Link href="/admin/events" className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1 text-sm font-medium w-fit transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mt-2">Create New Event</h1>
        <p className="text-zinc-500 text-sm">Configure your new hidden object competition event.</p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <EventForm scenes={scenes} />
      </div>
    </div>
  );
}

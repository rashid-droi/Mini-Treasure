"use client";

import { useState } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from "@dnd-kit/core";
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy 
} from "@dnd-kit/sortable";
import { moveParticipant } from "@/actions/teams";
import SortablePlayerCard from "./SortablePlayerCard";
import DroppableColumn from "./DroppableColumn";
import { Loader2 } from "lucide-react";

type User = { id: string; username: string; email: string };
type Participant = { id: string; user: User };
type Team = { id: string; name: string; participants: Participant[] };

interface Props {
  eventId: string;
  initialTeams: Team[];
  initialUnassigned: User[];
}

export default function TeamBuilder({ eventId, initialTeams, initialUnassigned }: Props) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [unassigned, setUnassigned] = useState<User[]>(initialUnassigned);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findContainer = (id: string) => {
    if (id === "unassigned") return "unassigned";
    if (unassigned.find(u => u.id === id)) return "unassigned";
    
    for (const team of teams) {
      if (team.id === id) return team.id;
      if (team.participants.find(p => p.user.id === id)) return team.id;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    setActiveId(id);

    // Find the user being dragged
    let user = unassigned.find(u => u.id === id);
    if (!user) {
      for (const team of teams) {
        const p = team.participants.find(p => p.user.id === id);
        if (p) {
          user = p.user;
          break;
        }
      }
    }
    setActiveUser(user || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    // Moving between containers in the UI
    if (activeContainer === "unassigned") {
      const userIndex = unassigned.findIndex(u => u.id === activeId);
      const user = unassigned[userIndex];
      
      setUnassigned(prev => prev.filter(u => u.id !== activeId));
      
      setTeams(prev => prev.map(t => {
        if (t.id === overContainer) {
          return { ...t, participants: [...t.participants, { id: `temp-${user.id}`, user }] };
        }
        return t;
      }));
    } else if (overContainer === "unassigned") {
      let movedUser: User | null = null;
      setTeams(prev => prev.map(t => {
        if (t.id === activeContainer) {
          const p = t.participants.find(p => p.user.id === activeId);
          if (p) movedUser = p.user;
          return { ...t, participants: t.participants.filter(p => p.user.id !== activeId) };
        }
        return t;
      }));
      
      if (movedUser) {
        setUnassigned(prev => [...prev, movedUser!]);
      }
    } else {
      // Team to Team
      let movedUser: User | null = null;
      setTeams(prev => {
        const newTeams = [...prev];
        const sourceTeam = newTeams.find(t => t.id === activeContainer)!;
        const p = sourceTeam.participants.find(p => p.user.id === activeId);
        
        if (p) movedUser = p.user;
        sourceTeam.participants = sourceTeam.participants.filter(p => p.user.id !== activeId);
        
        const destTeam = newTeams.find(t => t.id === overContainer)!;
        if (movedUser) {
          destTeam.participants.push({ id: `temp-${movedUser.id}`, user: movedUser });
        }
        
        return newTeams;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveUser(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    // Call server action to save to DB (Auto-save)
    if (activeContainer !== overContainer && overContainer) {
      setIsSaving(true);
      const newTeamId = overContainer === "unassigned" ? null : overContainer;
      await moveParticipant(activeId, newTeamId, eventId);
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      {isSaving && (
        <div className="absolute top-0 right-0 z-50 px-3 py-1 bg-[#f5c518]/20 text-[#c99a00] rounded-full text-xs font-medium border border-[#f5c518]/40 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving...
        </div>
      )}

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Unassigned Pool */}
          <div className="lg:col-span-1">
            <DroppableColumn id="unassigned" title={`Unassigned (${unassigned.length})`}>
              <SortableContext items={unassigned.map(u => u.id)} strategy={rectSortingStrategy}>
                {unassigned.map(user => (
                  <SortablePlayerCard key={user.id} user={user} />
                ))}
              </SortableContext>
              {unassigned.length === 0 && (
                <div className="text-zinc-500 text-sm text-center py-8">All players assigned</div>
              )}
            </DroppableColumn>
          </div>

          {/* Teams Grid */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {teams.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500 shadow-sm">
                No teams have been created for this event yet.
              </div>
            ) : (
              teams.map(team => (
                <DroppableColumn key={team.id} id={team.id} title={`${team.name} (${team.participants.length})`}>
                  <SortableContext items={team.participants.map(p => p.user.id)} strategy={rectSortingStrategy}>
                    {team.participants.map(p => (
                      <SortablePlayerCard key={p.user.id} user={p.user} />
                    ))}
                  </SortableContext>
                  {team.participants.length === 0 && (
                    <div className="text-zinc-500 text-sm text-center py-8">Empty team</div>
                  )}
                </DroppableColumn>
              ))
            )}
          </div>
        </div>

        <DragOverlay>
          {activeUser ? (
            <div className="opacity-80 scale-105">
              <SortablePlayerCard user={activeUser} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

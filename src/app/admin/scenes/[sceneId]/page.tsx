import { getSceneById } from "@/actions/admin/scenes";
import SceneEditorClient from "./SceneEditorClient";

export default async function SceneEditorPage({ params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await params;
  const res = await getSceneById(sceneId);

  if (res.error || !res.data) {
    return <div className="p-8 text-zinc-900 bg-[#fafafa] min-h-screen">Failed to load scene: {res.error}</div>;
  }

  const scene = res.data;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SceneEditorClient scene={scene} initialClues={scene.clues} />
    </div>
  );
}

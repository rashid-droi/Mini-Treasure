import SceneViewer from "@/components/game/SceneViewer";

// Simple fallback viewer: renders just the scene, no game UI. Players land
// here from the "try this different viewer" link when the in-game viewer
// misbehaves. Defaults to the demo scene when no sceneId is given.
export default async function TestViewerPage({
  searchParams
}: {
  searchParams: Promise<{ sceneId?: string }>
}) {
  const { sceneId } = await searchParams;

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      <SceneViewer
        sceneId={sceneId || "demo-scene"}
      />
    </div>
  );
}

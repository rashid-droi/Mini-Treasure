import { getScenes } from "@/actions/admin/scenes";
import { overviewCrop } from "@/lib/sceneThumb";
import ScenesClient from "./ScenesClient";

export default async function ScenesAdminPage() {
  const res = await getScenes();
  const rawScenes = res.success && res.data ? res.data : [];

  // Attach the overview crop (drops the tile's white padding) for each thumbnail.
  const scenes = rawScenes.map((s: { imageUrl?: string | null }) => ({
    ...s,
    crop: overviewCrop(s.imageUrl),
  }));

  return <ScenesClient scenes={scenes} />;
}

/** Deepest zoom index for a tiled scene (z=0 … z=N). Uses meta.json when present. */
export function maxNativeZoomFromDimensions(width: number, height: number): number {
  return Math.max(0, Math.ceil(Math.log2(Math.max(width, height) / 256)));
}

export async function fetchSceneMaxNativeZoom(sceneId: string): Promise<number> {
  const meta = await fetch(`/tiles/${sceneId}/meta.json`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);

  if (meta?.width && meta?.height) {
    return maxNativeZoomFromDimensions(meta.width, meta.height);
  }

  const exists = (z: number) =>
    new Promise<boolean>(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `/tiles/${sceneId}/${z}/0/0.jpg`;
    });

  let max = 0;
  for (let z = 0; z <= 12; z++) {
    if (await exists(z)) max = z;
    else if (z > 0) break;
  }
  return max || 3;
}

/** Shared TileLayer props for sharp, native-resolution scene pyramids. */
export const SCENE_TILE_LAYER_PROPS = {
  tileSize: 256,
  detectRetina: true,
  updateWhenIdle: true,
  updateWhenZooming: true,
  keepBuffer: 2,
  noWrap: true,
} as const;

"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle, Rectangle, useMap, useMapEvents } from "react-leaflet";
import { Maximize, Minimize, RotateCcw, Eye, EyeOff } from "lucide-react";

interface SceneViewerProps {
  sceneId: string;
  width?: string;
  height?: string;
  foundClues?: { id: string, targetX: number, targetY: number, radius?: number | null, shape?: string | null }[];
  hiddenClues?: { id: string, name: string, targetX: number, targetY: number, radius?: number | null, shape?: string | null }[];
  activeClue?: { id: string, targetX: number, targetY: number } | null;
  hintsUsed?: number;
  clickTolerance?: number;
  // Admins get visible hotspot circles (plus a toggle to hide/show them) so they
  // can see where every object sits. For players the same hotspots stay
  // clickable but are rendered fully transparent — so objects can still be
  // tapped without revealing every answer — and the toggle button is hidden.
  isAdmin?: boolean;
  onMapClick?: (x: number, y: number) => void;
  onObjectClick?: (x: number, y: number) => void;
  onAspectRatio?: (ratio: number) => void;
}

// Measures the scene image by probing the max-zoom tile grid (including the
// exact pixel size of the last, partial tiles), then fits the view so the
// whole image is visible. Reports the bounds and aspect ratio back to the
// parent so the container can be sized to match the image exactly.
const FitSceneBounds = ({
  sceneId,
  maxZoom,
  onBounds,
  onAspectRatio
}: {
  sceneId: string,
  maxZoom: number,
  onBounds: (bounds: L.LatLngBounds) => void,
  onAspectRatio?: (ratio: number) => void
}) => {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;

    const loadTile = (url: string) => new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

    // Walk consecutive tiles from index 0 (grid is at most 2^maxZoom wide),
    // keeping the last tile image so its real pixel size can be measured.
    const gridLimit = Math.min(64, Math.pow(2, maxZoom));
    const probe = async (urlFor: (i: number) => string) => {
      let count = 1;
      let lastTile = await loadTile(urlFor(0));
      for (let i = 1; i < gridLimit; i++) {
        const tile = await loadTile(urlFor(i));
        if (tile) {
          count = i + 1;
          lastTile = tile;
        } else break;
      }
      return { count, lastTile };
    };

    (async () => {
      const scale = Math.pow(2, maxZoom); // map units = source pixels / 2^maxZoom
      let widthPx: number, heightPx: number;

      // Preferred: exact source dimensions from the tiler's meta.json. The
      // "google" tile layout pads edge tiles out to a full 256px square with a
      // white background, so probing tile pixels overshoots the real image and
      // leaves white margins on the right/bottom — meta.json avoids that.
      const meta = await fetch(`/tiles/${sceneId}/meta.json`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      if (cancelled) return;

      if (meta?.width && meta?.height) {
        widthPx = meta.width;
        heightPx = meta.height;
      } else {
        // Fallback: measure the tile grid (works, but includes any white pad).
        const colProbe = await probe(x => `/tiles/${sceneId}/${maxZoom}/0/${x}.jpg`);
        const rowProbe = await probe(y => `/tiles/${sceneId}/${maxZoom}/${y}/0.jpg`);
        if (cancelled) return;
        widthPx = (colProbe.count - 1) * 256 + (colProbe.lastTile?.naturalWidth ?? 256);
        heightPx = (rowProbe.count - 1) * 256 + (rowProbe.lastTile?.naturalHeight ?? 256);
      }

      const bounds = L.latLngBounds([-(heightPx / scale), 0], [0, widthPx / scale]);

      // Contain-fit: zoom so the WHOLE image is visible inside the viewport,
      // and allow zooming back out to it. With the container sized to the
      // image's aspect ratio this fills the frame edge-to-edge.
      const containZoom = map.getBoundsZoom(bounds, false);
      map.setMinZoom(containZoom);
      map.setView(bounds.getCenter(), containZoom);
      map.setMaxBounds(bounds);
      onBounds(bounds);
      onAspectRatio?.(widthPx / heightPx);
    })();

    return () => { cancelled = true; };
  }, [map, sceneId, maxZoom, onBounds, onAspectRatio]);

  return null;
};

// Keeps the map in sync when its container is resized (e.g. once the parent
// learns the image aspect ratio, or on window resize): re-measure, keep the
// contain-fit as the minimum zoom, and refit if we were at full view.
const ResizeHandler = ({ sceneBounds }: { sceneBounds: L.LatLngBounds | null }) => {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => {
      const wasAtMin = map.getZoom() <= map.getMinZoom();
      map.invalidateSize();
      if (sceneBounds) {
        const containZoom = map.getBoundsZoom(sceneBounds, false);
        map.setMinZoom(containZoom);
        if (wasAtMin || map.getZoom() < containZoom) {
          map.setView(sceneBounds.getCenter(), containZoom);
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [map, sceneBounds]);

  return null;
};

// Custom UI Overlay for full control over zoom/fullscreen
const ViewerControls = ({
  containerRef,
  sceneBounds,
  showMarkers,
  onToggleMarkers,
  showMarkerToggle
}: {
  containerRef: React.RefObject<HTMLDivElement | null>,
  sceneBounds: L.LatLngBounds | null,
  showMarkers: boolean,
  onToggleMarkers: () => void,
  showMarkerToggle: boolean
}) => {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Let leaflet know the container size changed
      setTimeout(() => map.invalidateSize(), 100);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [map]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const resetView = () => {
    // Refit so the whole scene image is visible, or fall back to the default view
    if (sceneBounds) map.setView(sceneBounds.getCenter(), map.getBoundsZoom(sceneBounds, false));
    else map.setView([0, 0], 1);
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl flex flex-col">
        <button 
          onClick={resetView}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Reset View"
          aria-label="Reset View"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {showMarkerToggle && (
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl">
          <button
            onClick={onToggleMarkers}
            className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            title={showMarkers ? "Hide Markers" : "Show Markers"}
            aria-label={showMarkers ? "Hide Markers" : "Show Markers"}
          >
            {showMarkers ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>
      )}

      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl">
        <button
          onClick={toggleFullscreen}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Toggle Fullscreen"
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

// Handles answer clicks. Instead of overlaying invisible interactive circles
// (which intercept mouse-drags and break panning), unfound objects are
// hit-tested mathematically: a click within tolerance of one snaps to its
// exact coordinates so the server-side distance check matches perfectly.
type PickableClue = { id: string; name: string; targetX: number; targetY: number };

const MapClickHandler = ({
  activeClue,
  hiddenClues = [],
  clickTolerance = 8,
  onPickObject
}: {
  activeClue?: { id: string } | null,
  hiddenClues?: PickableClue[],
  clickTolerance?: number,
  onPickObject?: (clue: PickableClue) => void
}) => {
  // The map layer reliably receives clicks (unlike the transparent object
  // hotspots, whose zero-opacity fill doesn't always capture pointer events).
  // So we resolve the tapped object here: pick the nearest unfound object within
  // the click tolerance and hand it up to show the "Submit this" confirmation.
  useMapEvents({
    click(e) {
      if (!activeClue || !onPickObject) return;
      const { lat, lng } = e.latlng;

      let nearest: PickableClue | null = null;
      let nearestDist = Infinity;
      for (const clue of hiddenClues) {
        const dist = Math.hypot(lng - clue.targetX, lat - clue.targetY);
        if (dist <= clickTolerance && dist < nearestDist) {
          nearest = clue;
          nearestDist = dist;
        }
      }

      if (nearest) onPickObject(nearest);
    }
  });
  return null;
};

const HintCameraController = ({ activeClue, hintsUsed }: { activeClue?: { id: string, targetX: number, targetY: number } | null, hintsUsed?: number }) => {
  const map = useMap();
  useEffect(() => {
    if (hintsUsed === 1 && activeClue) {
      // Pan to slightly offset area
      const offsetX = (Math.random() - 0.5) * 200;
      const offsetY = (Math.random() - 0.5) * 200;
      map.flyTo([activeClue.targetY + offsetY, activeClue.targetX + offsetX], 3, {
        duration: 2,
        easeLinearity: 0.25
      });
    }
  }, [hintsUsed, activeClue, map]);
  return null;
};

export default function SceneViewerInternal({
  sceneId,
  width = "100%",
  height = "100%",
  foundClues = [],
  hiddenClues = [],
  activeClue = null,
  hintsUsed = 0,
  clickTolerance = 8,
  isAdmin = false,
  onMapClick,
  onObjectClick,
  onAspectRatio
}: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sceneBounds, setSceneBounds] = useState<L.LatLngBounds | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  // The object whose dot was last tapped, shown in a React overlay with a
  // Submit button (kept out of the Leaflet popup, whose onClick can be eaten
  // by Leaflet's disableClickPropagation before React's handler runs).
  const [selected, setSelected] = useState<{ name: string, x: number, y: number } | null>(null);

  // Close the selection panel whenever the active question changes.
  useEffect(() => { setSelected(null); }, [activeClue?.id]);

  // The tiler emits a different number of zoom levels per image (bigger images
  // produce more levels). Detect the deepest level that actually exists so we
  // render at full resolution and fit against the correct level, instead of
  // assuming a fixed max zoom (which misfits larger uploads).
  const [maxNativeZoom, setMaxNativeZoom] = useState(3);
  useEffect(() => {
    let cancelled = false;
    const exists = (z: number) => new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `/tiles/${sceneId}/${z}/0/0.jpg`;
    });
    (async () => {
      let max = 0;
      for (let z = 1; z <= 8; z++) {
        if (await exists(z)) max = z; else break;
      }
      if (!cancelled && max > 0) setMaxNativeZoom(max);
    })();
    return () => { cancelled = true; };
  }, [sceneId]);

  // Custom glowing icon for completed clues
  const glowingIcon = new L.DivIcon({
    html: `
      <div class="relative w-full h-full flex items-center justify-center">
        <div class="absolute inset-2 border-2 border-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.8)]"></div>
        <div class="w-3 h-3 bg-emerald-400 rounded-full shadow-lg"></div>
      </div>
    `,
    className: 'bg-transparent',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });


  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ width, height }}
    >
      <MapContainer
        crs={L.CRS.Simple}
        center={[0, 0]}
        zoom={1}
        minZoom={0}
        maxZoom={5}
        zoomSnap={0} // free fractional zoom so the contain-fit is exact, no letterboxing
        maxBoundsViscosity={1.0} // hard stop at the image edges instead of bouncing back
        style={{ width: "100%", height: "100%", background: "transparent" }}
        zoomControl={true}
        keyboard={true}
        attributionControl={false}
      >
        <FitSceneBounds sceneId={sceneId} maxZoom={maxNativeZoom} onBounds={setSceneBounds} onAspectRatio={onAspectRatio} />
        <ResizeHandler sceneBounds={sceneBounds} />
        <HintCameraController activeClue={activeClue} hintsUsed={hintsUsed} />
        <MapClickHandler
          activeClue={activeClue}
          hiddenClues={hiddenClues}
          clickTolerance={clickTolerance}
          onPickObject={(clue) => setSelected({ name: clue.name, x: clue.targetX, y: clue.targetY })}
        />

        <TileLayer
          // sharp's "google" tile layout is {z}/{y}/{x} (row folder, column file)
          key={maxNativeZoom}
          url={`/tiles/${sceneId}/{z}/{y}/{x}.jpg`}
          errorTileUrl={`/tiles/${sceneId}/blank.png`}
          noWrap={true}
          maxNativeZoom={maxNativeZoom}
          bounds={[
            [-256, 0],
            [0, 256]
          ]} // extent of the zoom-0 tile; no tiles exist outside this
        />

        {showMarkers && foundClues.map(clue => (
          <Marker
            key={clue.id}
            position={[clue.targetY, clue.targetX]}
            icon={glowingIcon}
            interactive={false}
          />
        ))}

        {/* A clickable hotspot over each unfound object, sized to the object's
            own radius (or the scene's click tolerance) so it matches the
            server-side hit area. The hotspot is always clickable — clicking it
            selects the object and reveals a Submit button below. Only ADMINS see
            its outline/fill; for players it's fully transparent so it doesn't
            reveal where every object sits, while the object in the photo itself
            stays clickable. The admin toggle can hide it entirely. */}
        {(isAdmin ? showMarkers : true) && hiddenClues.map(clue => {
          const r = clue.radius ?? clickTolerance;
          const pathOptions = isAdmin
            ? {
                color: "#ffffff",
                weight: 2,
                opacity: 0.9,
                fillColor: "#e8842c",
                fillOpacity: 0.2,
              }
            : {
                // Invisible but still hit-testable (fill present, just transparent).
                stroke: false,
                fill: true,
                fillColor: "#ffffff",
                fillOpacity: 0,
              };
          const handlers = {
            click: () => setSelected({ name: clue.name, x: clue.targetX, y: clue.targetY }),
            // Only admins get the hover highlight; a player hover must stay invisible.
            ...(isAdmin
              ? {
                  mouseover: (e: any) => e.target.setStyle({ fillOpacity: 0.4, weight: 3 }),
                  mouseout: (e: any) => e.target.setStyle({ fillOpacity: 0.2, weight: 2 }),
                }
              : {}),
          };
          return clue.shape === "SQUARE" ? (
            <Rectangle
              key={clue.id}
              bounds={[[clue.targetY - r, clue.targetX - r], [clue.targetY + r, clue.targetX + r]]}
              pathOptions={pathOptions}
              eventHandlers={handlers}
            />
          ) : (
            <Circle
              key={clue.id}
              center={[clue.targetY, clue.targetX]}
              radius={r}
              pathOptions={pathOptions}
              eventHandlers={handlers}
            />
          );
        })}

        <ViewerControls
          containerRef={containerRef}
          sceneBounds={sceneBounds}
          showMarkers={showMarkers}
          onToggleMarkers={() => setShowMarkers(v => !v)}
          showMarkerToggle={isAdmin}
        />

      </MapContainer>

      {/* Selection overlay: name + Submit for the last-tapped object. Rendered
          outside the Leaflet layer so its button click is a normal React event. */}
      {selected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-black/70 backdrop-blur-xl border border-white/15 rounded-xl px-4 py-2.5 shadow-2xl">
          <span className="text-white text-sm font-semibold">{selected.name}</span>
          <button
            onClick={() => {
              onObjectClick?.(selected.x, selected.y);
              setSelected(null);
            }}
            className="px-3 py-1 text-xs font-semibold rounded-md bg-[#e8842c] text-white hover:bg-[#d97722] transition-colors"
          >
            Submit this
          </button>
          <button
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="text-white/60 hover:text-white text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

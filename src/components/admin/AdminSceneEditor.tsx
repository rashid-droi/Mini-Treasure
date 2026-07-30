"use client";

import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle, Rectangle, useMap, useMapEvents } from "react-leaflet";
import { Maximize, Minimize, RotateCcw, Plus, ZoomIn, ZoomOut, Eye, EyeOff } from "lucide-react";

interface AdminSceneEditorProps {
  sceneId: string;
  clues: any[];
  clickTolerance?: number; // scene default radius, used when a clue has no radius of its own
  focusClueId?: string | null; // clue whose hotspot should be highlighted
  focusSignal?: number; // bumps each time a focus is requested, so re-focusing re-centers
  onAddClue: (x: number, y: number) => void;
  onUpdateClue: (id: string, x: number, y: number) => void;
  onSelectClue: (id: string) => void;
}

// Measures the scene image by probing the max-zoom tile grid (including the
// exact pixel size of the last, partial tiles), then fits the view so the whole
// image is contained in the viewport and constrains panning to the image.
const FitSceneBounds = ({
  sceneId,
  maxZoom,
  onBounds
}: {
  sceneId: string,
  maxZoom: number,
  onBounds: (bounds: L.LatLngBounds) => void
}) => {
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

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

      // Contain-fit: zoom so the WHOLE image exactly fills the (aspect-matched)
      // viewport, lock panning to the image, and use that as the minimum zoom.
      const fit = () => {
        map.invalidateSize({ animate: false });
        const containZoom = map.getBoundsZoom(bounds, false);
        map.setMinZoom(containZoom);
        map.setMaxBounds(bounds);
        map.setView(bounds.getCenter(), containZoom, { animate: false });
      };
      fit();
      onBounds(bounds);

      // The map container starts at a placeholder ratio and resizes once the
      // real image ratio is applied (and on fullscreen) — refit each time so the
      // image stays exactly framed and the tiles' white padding never shows.
      ro = new ResizeObserver(() => fit());
      ro.observe(map.getContainer());
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [map, sceneId, maxZoom, onBounds]);

  return null;
};

// Custom UI Overlay for full control over zoom/fullscreen
const ViewerControls = ({
  containerRef,
  sceneBounds,
  showMarkers,
  onToggleMarkers,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>,
  sceneBounds: L.LatLngBounds | null,
  showMarkers: boolean,
  onToggleMarkers: () => void,
}) => {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => map.invalidateSize(), 100);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [map]);

  // Keep clicks/scrolls on the control buttons from reaching the map, which
  // would otherwise register as a "place clue here" click or pan/zoom the map.
  useEffect(() => {
    if (controlsRef.current) {
      L.DomEvent.disableClickPropagation(controlsRef.current);
      L.DomEvent.disableScrollPropagation(controlsRef.current);
    }
  }, []);

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
    <div ref={controlsRef} className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl flex flex-col">
        <button
          onClick={() => map.zoomIn()}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

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

      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl">
        <button
          onClick={onToggleMarkers}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title={showMarkers ? "Hide object markers" : "Show object markers"}
          aria-label={showMarkers ? "Hide object markers" : "Show object markers"}
        >
          {showMarkers ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
      </div>

      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl">
        <button 
          onClick={toggleFullscreen}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

// Overlay button on the photo: drops a new object at the center of the current view
const AddObjectButton = ({ onAddObject }: { onAddObject: (x: number, y: number) => void }) => {
  const map = useMap();
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const center = map.getCenter();
    onAddObject(center.lng, center.lat);
  };

  // Prevent the button click from also registering as a map "place clue" click.
  useEffect(() => {
    if (wrapRef.current) L.DomEvent.disableClickPropagation(wrapRef.current);
  }, []);

  return (
    <div ref={wrapRef} className="absolute top-4 left-4 z-[1000] pointer-events-auto">
      <button
        onClick={handleAdd}
        className="bg-[#f5c518] hover:bg-[#e6b800] text-zinc-900 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg flex items-center gap-2 border border-black/10"
        title="Add a new object at the center of the view"
      >
        <Plus className="w-5 h-5" />
        Add Object
      </button>
    </div>
  );
};

const MapEvents = ({ onMapClick }: { onMapClick: (x: number, y: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lng, e.latlng.lat);
    }
  });
  return null;
};

// Flies the view to a clue's hotspot whenever `signal` changes (i.e. an object
// was clicked in the sidebar). Zooms in enough that the highlighted hotspot is
// clearly visible without overshooting the map's max zoom.
const FocusController = ({ clue, signal }: { clue: any | null; signal: number }) => {
  const map = useMap();
  useEffect(() => {
    if (!clue || signal === 0) return;
    const targetZoom = Math.min(3, map.getMaxZoom());
    map.flyTo([clue.targetY, clue.targetX], Math.max(map.getZoom(), targetZoom), {
      animate: true,
      duration: 0.6,
    });
    // Only react to a new focus request, not to unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
};

// Custom Marker Icons
const createDivIcon = (html: string, className: string) => {
  if (typeof window === "undefined") return undefined;
  return L.divIcon({
    html,
    className,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

export default function AdminSceneEditor({
  sceneId,
  clues,
  clickTolerance = 5,
  focusClueId = null,
  focusSignal = 0,
  onAddClue,
  onUpdateClue,
  onSelectClue
}: AdminSceneEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [sceneBounds, setSceneBounds] = useState<L.LatLngBounds | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // The tiler emits a different number of zoom levels per image (bigger images
  // produce more levels). Detect the deepest level that actually exists so the
  // image is measured and rendered at full resolution, instead of assuming a
  // fixed max zoom (which misfits larger uploads into the top-left corner).
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

  useEffect(() => {
    setMounted(true);
    // Fix leaflet marker icon issues in nextjs
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  if (!mounted) {
    return <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-500">Loading Map...</div>;
  }

  const clueIconHtml = `
    <div class="relative group cursor-pointer">
      <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-pulse"></div>
      <svg class="w-8 h-8 text-amber-500 drop-shadow-xl" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    </div>
  `;

  // Frame the map to the image's exact aspect ratio (falling back to 16:9 until
  // the real dimensions load). With no letterbox, the tiles' white padding —
  // which lives just outside the image edge — never enters the viewport.
  const aspect = sceneBounds
    ? (sceneBounds.getEast() - sceneBounds.getWest()) /
      (sceneBounds.getNorth() - sceneBounds.getSouth())
    : 16 / 9;

  return (
    <div ref={containerRef} className="w-full h-full relative bg-zinc-100 flex items-center justify-center overflow-hidden">
      <div
        className="relative"
        style={{ width: "100%", maxWidth: "100%", maxHeight: "100%", aspectRatio: `${aspect}` }}
      >
      <MapContainer
        center={[0, 0]}
        zoom={1}
        minZoom={0}
        maxZoom={5}
        zoomSnap={0} // free fractional zoom so the contain-fit is exact, no letterboxing
        maxBoundsViscosity={1.0} // hard stop at the image edges instead of bouncing back
        className="w-full h-full z-0"
        crs={L.CRS.Simple}
        zoomControl={false} // Custom controls used instead
        attributionControl={false}
      >
        <FitSceneBounds sceneId={sceneId} maxZoom={maxNativeZoom} onBounds={setSceneBounds} />
        <MapEvents onMapClick={onAddClue} />
        <FocusController clue={clues.find(c => c.id === focusClueId) ?? null} signal={focusSignal} />
        
        {/* Deep Zoom Tile Layer */}
        <TileLayer
          // sharp's "google" tile layout is {z}/{y}/{x} (row folder, column file)
          key={maxNativeZoom}
          url={`/tiles/${sceneId}/{z}/{y}/{x}.jpg`}
          noWrap={true}
          maxNativeZoom={maxNativeZoom} // deepest tile level that exists; upscale beyond that
          bounds={[[-256, 0], [0, 256]]} // extent of the zoom-0 tile; no tiles exist outside this
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" // transparent fallback
        />
        
        <ViewerControls
          containerRef={containerRef}
          sceneBounds={sceneBounds}
          showMarkers={showMarkers}
          onToggleMarkers={() => setShowMarkers(v => !v)}
        />
        <AddObjectButton onAddObject={onAddClue} />

        {/* Hotspot area for each clue, sized to its radius (or the scene
            default). Non-interactive so it never blocks the pin drag or a
            map click; it just shows the admin the real clickable target size. */}
        {showMarkers && clues.map((clue) => {
          const r = clue.radius ?? clickTolerance;
          const isFocused = clue.id === focusClueId;
          // The focused hotspot gets a solid, brighter, thicker outline so it
          // stands out from the other dashed hotspots.
          const pathOptions = isFocused
            ? {
                color: "#059669",
                weight: 3,
                opacity: 1,
                fillOpacity: 0,
              }
            : {
                color: "#f59e0b",
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0,
                dashArray: "4 4",
              };
          return clue.shape === "SQUARE" ? (
            <Rectangle
              key={`r-${clue.id}`}
              bounds={[[clue.targetY - r, clue.targetX - r], [clue.targetY + r, clue.targetX + r]]}
              interactive={false}
              pathOptions={pathOptions}
            />
          ) : (
            <Circle
              key={`r-${clue.id}`}
              center={[clue.targetY, clue.targetX]}
              radius={r}
              interactive={false}
              pathOptions={pathOptions}
            />
          );
        })}

        {showMarkers && clues.map((clue) => (
          <Marker
            key={clue.id}
            position={[clue.targetY, clue.targetX]}
            icon={createDivIcon(clueIconHtml, "clue-marker bg-transparent border-none")}
            draggable={true}
            eventHandlers={{
              click: () => onSelectClue(clue.id),
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                onUpdateClue(clue.id, position.lng, position.lat);
              }
            }}
          />
        ))}
      </MapContainer>
      </div>
    </div>
  );
}

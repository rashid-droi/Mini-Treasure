"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle, Rectangle, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Maximize, Minimize, RotateCcw, Plus, ZoomIn, ZoomOut, Eye, EyeOff } from "lucide-react";
import { fetchSceneMaxNativeZoom, SCENE_TILE_LAYER_PROPS } from "@/lib/sceneTiles";

interface AdminSceneEditorProps {
  sceneId: string;
  clues: any[];
  clickTolerance?: number; // scene default radius, used when a clue has no radius of its own
  focusClueId?: string | null; // clue whose hotspot should be highlighted
  focusSignal?: number; // bumps each time a focus is requested, so re-focusing re-centers
  layoutRevision?: number; // bumps when sidebar width changes so map can reflow
  onAddClue: (x: number, y: number) => void;
  onUpdateClue: (id: string, x: number, y: number) => void;
  onSelectClue: (id: string) => void;
}

const MapInvalidateOnLayout = ({ revision }: { revision: number }) => {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize({ animate: false }));
    return () => cancelAnimationFrame(id);
  }, [map, revision]);
  return null;
};

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
  onBounds: (bounds: L.LatLngBounds, fitZoom: number) => void
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

      // Contain-fit on first load; on later resizes only refit if the user was
      // already at minimum zoom — otherwise preserve their zoom/pan so +/- buttons
      // aren't undone by sidebar/aspect-ratio layout shifts.
      const applyBounds = (resetView: boolean) => {
        map.invalidateSize({ animate: false });
        const containZoom = map.getBoundsZoom(bounds, false);
        const prevMinZoom = map.getMinZoom();
        map.setMinZoom(containZoom);
        map.setMaxZoom(maxZoom);
        map.setMaxBounds(bounds);
        onBounds(bounds, containZoom);

        const shouldResetView =
          resetView ||
          map.getZoom() <= prevMinZoom + 0.01 ||
          map.getZoom() < containZoom - 0.01;

        if (shouldResetView) {
          map.setView(bounds.getCenter(), containZoom, { animate: false });
        }
      };

      applyBounds(true);

      ro = new ResizeObserver(() => applyBounds(false));
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
  fitZoom,
  showMarkers,
  onToggleMarkers,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>,
  sceneBounds: L.LatLngBounds | null,
  fitZoom: number | null,
  showMarkers: boolean,
  onToggleMarkers: () => void,
}) => {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [minZoom, setMinZoom] = useState(() => map.getMinZoom());
  const controlsRef = useRef<HTMLDivElement>(null);

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setMinZoom(map.getMinZoom());
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
    setMinZoom(map.getMinZoom());
  }, [map, sceneBounds]);

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

  useEffect(() => {
    setZoom(map.getZoom());
    setMinZoom(map.getMinZoom());
  }, [map, sceneBounds, fitZoom]);

  const snapToFitView = useCallback(() => {
    if (!sceneBounds) return map.getMinZoom();
    const target =
      fitZoom ?? map.getBoundsZoom(sceneBounds, false);
    map.setView(sceneBounds.getCenter(), target, { animate: true });
    setZoom(target);
    return target;
  }, [map, sceneBounds, fitZoom]);

  const resetView = () => {
    if (sceneBounds) snapToFitView();
    else map.setView([0, 0], 1);
  };

  const ZOOM_STEP = 0.25;
  const FIT_EPS = 0.05;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = Math.min(map.getMaxZoom(), map.getZoom() + ZOOM_STEP);
    map.setZoom(next, { animate: true });
    setZoom(next);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sceneBounds) {
      const next = Math.max(map.getMinZoom(), map.getZoom() - ZOOM_STEP);
      map.setZoom(next, { animate: true });
      setZoom(next);
      return;
    }

    const targetFit = fitZoom ?? map.getBoundsZoom(sceneBounds, false);
    const current = map.getZoom();

    // Already at full-scene view — re-center without changing zoom.
    if (current <= targetFit + FIT_EPS) {
      snapToFitView();
      return;
    }

    const next = current - ZOOM_STEP;
    if (next <= targetFit + FIT_EPS) {
      map.setView(sceneBounds.getCenter(), targetFit, { animate: true });
      setZoom(targetFit);
    } else {
      map.setZoom(next, { animate: true });
      setZoom(next);
    }
  };

  const stopMapEvent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={controlsRef} className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-1 shadow-2xl flex flex-col">
        <button
          type="button"
          onClick={handleZoomIn}
          onMouseDown={stopMapEvent}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          onMouseDown={stopMapEvent}
          className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Zoom Out (full scene view)"
          aria-label="Zoom Out"
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

const dragHandleIcon =
  typeof window === "undefined"
    ? undefined
    : L.divIcon({
        html: '<div class="admin-hotspot-drag-handle" title="Drag to move"></div>',
        className: "admin-hotspot-drag-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

export default function AdminSceneEditor({
  sceneId,
  clues,
  clickTolerance = 5,
  focusClueId = null,
  focusSignal = 0,
  layoutRevision = 0,
  onAddClue,
  onUpdateClue,
  onSelectClue
}: AdminSceneEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [sceneBounds, setSceneBounds] = useState<L.LatLngBounds | null>(null);
  const [fitZoom, setFitZoom] = useState<number | null>(null);
  const [showMarkers, setShowMarkers] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSceneBounds = useCallback((bounds: L.LatLngBounds, zoom: number) => {
    setSceneBounds(bounds);
    setFitZoom(zoom);
  }, []);

  // The tiler emits a different number of zoom levels per image (bigger images
  // produce more levels). Detect the deepest level that actually exists so the
  // image is measured and rendered at full resolution, instead of assuming a
  // fixed max zoom (which misfits larger uploads into the top-left corner).
  const [maxNativeZoom, setMaxNativeZoom] = useState(5);
  useEffect(() => {
    let cancelled = false;
    fetchSceneMaxNativeZoom(sceneId).then(z => {
      if (!cancelled) setMaxNativeZoom(z);
    });
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
        maxZoom={maxNativeZoom}
        zoomSnap={0} // free fractional zoom so the contain-fit is exact, no letterboxing
        maxBoundsViscosity={1.0} // hard stop at the image edges instead of bouncing back
        fadeAnimation={false}
        zoomAnimation={false}
        className="w-full h-full z-0 scene-map"
        crs={L.CRS.Simple}
        zoomControl={false} // Custom controls used instead
        attributionControl={false}
      >
        <FitSceneBounds sceneId={sceneId} maxZoom={maxNativeZoom} onBounds={handleSceneBounds} />
        <MapInvalidateOnLayout revision={layoutRevision} />
        <MapEvents onMapClick={onAddClue} />
        <FocusController clue={clues.find(c => c.id === focusClueId) ?? null} signal={focusSignal} />
        
        {/* Deep Zoom Tile Layer */}
        <TileLayer
          // sharp's "google" tile layout is {z}/{y}/{x} (row folder, column file)
          key={maxNativeZoom}
          url={`/tiles/${sceneId}/{z}/{y}/{x}.jpg`}
          {...SCENE_TILE_LAYER_PROPS}
          maxNativeZoom={maxNativeZoom}
          maxZoom={maxNativeZoom}
          bounds={[[-256, 0], [0, 256]]} // extent of the zoom-0 tile; no tiles exist outside this
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" // transparent fallback
        />
        
        <ViewerControls
          containerRef={containerRef}
          sceneBounds={sceneBounds}
          fitZoom={fitZoom}
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
          const label = (
            <Tooltip
              permanent
              direction="center"
              className="admin-hotspot-tooltip"
              offset={[0, 0]}
            >
              <span
                className={`admin-hotspot-tooltip__text${isFocused ? " admin-hotspot-tooltip__text--focused" : ""}`}
              >
                {clue.name}
              </span>
            </Tooltip>
          );

          return clue.shape === "SQUARE" ? (
            <Rectangle
              key={`r-${clue.id}`}
              bounds={[[clue.targetY - r, clue.targetX - r], [clue.targetY + r, clue.targetX + r]]}
              interactive={false}
              pathOptions={pathOptions}
            >
              {label}
            </Rectangle>
          ) : (
            <Circle
              key={`r-${clue.id}`}
              center={[clue.targetY, clue.targetX]}
              radius={r}
              interactive={false}
              pathOptions={pathOptions}
            >
              {label}
            </Circle>
          );
        })}

        {showMarkers && clues.map((clue) => (
          <Marker
            key={clue.id}
            position={[clue.targetY, clue.targetX]}
            icon={dragHandleIcon}
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

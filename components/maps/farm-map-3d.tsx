"use client";

import { useEffect, useRef, useState } from "react";
import type { Farm } from "@/lib/types";

/* ==========================================================================
   FarmMap3D — tilted terrain view with extruded farm footprints
   --------------------------------------------------------------------------
   MapLibre GL + Terrarium DEM tiles (AWS Open Data, keyless). Each farm becomes
   a raised translucent block at its real production height, so a dairy farm
   looks different from a vegetable plot at a glance.

   Import through dynamic(..., { ssr: false }) — MapLibre touches window.
   ========================================================================== */

type Props = {
  farms: Farm[];
  activeFarmId?: string | null;
  onSelect?: (farmId: string) => void;
  height?: number;
  className?: string;
};

const TYPE_COLOR: Record<string, string> = {
  vegetables: "#1f7a4d",
  dairy: "#7fb2d6",
  poultry: "#c9a227",
  fish: "#2f8f9d",
  fruits: "#b8622c",
};

/** Visual height per farm type — purely informational, not survey data. */
const TYPE_HEIGHT: Record<string, number> = {
  vegetables: 900,
  dairy: 2600,
  poultry: 1700,
  fish: 500,
  fruits: 1400,
};

export default function FarmMap3D({
  farms,
  activeFarmId,
  onSelect,
  height = 420,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              // CARTO dark raster basemap
              basemap: {
                type: "raster",
                tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
                tileSize: 256,
                attribution: "&copy; OpenStreetMap &copy; CARTO",
              },
              // Terrain RGB (Mapzen Terrarium) — keyless, public
              terrain: {
                type: "raster-dem",
                tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
                encoding: "terrarium",
                tileSize: 256,
                maxzoom: 13,
              },
            },
            layers: [
              { id: "bg", type: "background", paint: { "background-color": "#0b0f0d" } },
              { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.85 } },
            ],
            sky: {
              "sky-color": "#0b0f0d",
              "horizon-color": "#163a2b",
              "fog-color": "#0b0f0d",
              "sky-horizon-blend": 0.6,
              "horizon-fog-blend": 0.5,
              "fog-ground-blend": 0.7,
            },
          },
          center: [90.35, 23.85],
          zoom: 6.6,
          pitch: 55,
          bearing: -18,
          attributionControl: { compact: true },
          dragRotate: true,
        });

        mapRef.current = map;
        map.on("load", () => {
          try {
            map.setTerrain({ source: "terrain", exaggeration: 1.6 });
          } catch {
            /* terrain is decorative — a DEM failure must not blank the map */
          }
          setReady(true);
        });

        requestAnimationFrame(() => map.resize());
      } catch (err) {
        setError((err as Error).message || "৩ডি ম্যাপ লোড হয়নি");
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // build farm footprints as extruded polygons
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const map = mapRef.current;
      if (cancelled || !map) return;

      const features = farms.map((farm) => {
        const ring =
          Array.isArray(farm.boundary) && farm.boundary.length >= 3
            ? (farm.boundary as [number, number][])
            : squareAround(Number(farm.lng), Number(farm.lat), 0.0016);

        return {
          type: "Feature" as const,
          properties: {
            id: farm.id,
            name: farm.name_bn,
            district: farm.district,
            type: farm.type,
            color: TYPE_COLOR[farm.type] ?? "#1f7a4d",
            height: TYPE_HEIGHT[farm.type] ?? 1200,
            cameras: farm.online_cameras ?? 0,
            active: farm.id === activeFarmId,
          },
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        };
      });

      const collection = { type: "FeatureCollection" as const, features };
      const sourceId = "farms";
      const existing = map.getSource(sourceId) as import("maplibre-gl").GeoJSONSource | undefined;

      if (existing) {
        existing.setData(collection as never);
      } else {
        map.addSource(sourceId, { type: "geojson", data: collection as never });

        map.addLayer({
          id: "farms-extrusion",
          type: "fill-extrusion",
          source: sourceId,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.72,
          },
        });

        map.addLayer({
          id: "farms-outline",
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#b7ead2",
            "line-width": ["case", ["get", "active"], 2.5, 1],
            "line-opacity": 0.65,
          },
        });

        map.on("click", "farms-extrusion", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const id = feature.properties?.id as string | undefined;
          if (id) onSelect?.(id);
        });

        map.on("mouseenter", "farms-extrusion", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "farms-extrusion", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // labels
      if (!map.getLayer("farms-labels")) {
        map.addSource("farms-labels", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: farms.map((f) => ({
              type: "Feature" as const,
              properties: { name: f.name_bn },
              geometry: { type: "Point" as const, coordinates: [Number(f.lng), Number(f.lat)] },
            })),
          },
        });
        map.addLayer({
          id: "farms-labels",
          type: "symbol",
          source: "farms-labels",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, -0.6],
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": "#e8f6ee",
            "text-halo-color": "rgba(0,0,0,.85)",
            "text-halo-width": 1.4,
          },
        });
      }

      if (activeFarmId) {
        const farm = farms.find((f) => f.id === activeFarmId);
        if (farm) {
          map.flyTo({
            center: [Number(farm.lng), Number(farm.lat)],
            zoom: 11.5,
            pitch: 62,
            bearing: 20,
            duration: 1200,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, farms, activeFarmId, onSelect]);

  return (
    <div className={`relative overflow-hidden rounded-2xl ring-1 ring-white/10 ${className}`}>
      <div ref={containerRef} style={{ height }} className="w-full bg-[#0b0f0d]" />

      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b0f0d]/90">
          <div className="flex flex-col items-center gap-2">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
            <p className="text-[11px] text-white/50">৩ডি টেরেইন লোড হচ্ছে…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b0f0d]/90 px-6 text-center">
          <div className="space-y-2">
            <p className="text-sm text-white/80">৩ডি ম্যাপ লোড করা যায়নি</p>
            <p className="text-[11px] text-white/45">আপনার ব্রাউজারে WebGL প্রয়োজন</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur">
        🏔️ ৩ডি টেরেইন · টেনে ঘোরান
      </div>
    </div>
  );
}

function squareAround(lng: number, lat: number, d: number): [number, number][] {
  return [
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ];
}

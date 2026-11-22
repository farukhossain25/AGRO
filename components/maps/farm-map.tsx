"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Farm } from "@/lib/types";

/* ==========================================================================
   FarmMap — 2D Leaflet map using CARTO dark tiles (no API key required)
   --------------------------------------------------------------------------
   • cluster-free: we render every farm marker plus an optional camera layer
   • polygon boundary drawn when the farm has one
   • fully client-side; imported through dynamic(..., { ssr: false })
   ========================================================================== */

type Props = {
  farms: Farm[];
  /** draw camera pins for these farm ids */
  cameraFarms?: string[];
  activeFarmId?: string | null;
  onSelect?: (farmId: string) => void;
  height?: number;
  zoom?: number;
  className?: string;
};

export default function FarmMap({
  farms,
  cameraFarms = [],
  activeFarmId,
  onSelect,
  height = 340,
  zoom = 7,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  const cameraIds = useMemo(() => new Set(cameraFarms), [cameraFarms]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [23.8103, 90.4125],
        zoom,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);

      // Fit to the farms once the container has real dimensions.
      if (farms.length) {
        const bounds = L.latLngBounds(farms.map((f) => [f.lat, f.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.25), { animate: false });
      }

      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw pins whenever data or selection changes
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      const leaflet = (await import("leaflet")).default;
      if (cancelled || !layerRef.current || !mapRef.current) return;

      const layer = layerRef.current;
      layer.clearLayers();

      for (const farm of farms) {
        const active = farm.id === activeFarmId;
        const hasCam = cameraIds.has(farm.id);

        // boundary polygon
        if (Array.isArray(farm.boundary) && farm.boundary.length >= 3) {
          const ring = (farm.boundary as [number, number][]).map(([lng, lat]) => [lat, lng]);
          leaflet
            .polygon(ring as [number, number][], {
              color: active ? "#b7ead2" : "#1f7a4d",
              weight: active ? 2.5 : 1.5,
              fillColor: "#1f7a4d",
              fillOpacity: active ? 0.28 : 0.14,
            })
            .addTo(layer);
        }

        const icon = leaflet.divIcon({
          className: "",
          html: `<div style="
              display:flex;align-items:center;justify-content:center;
              width:${active ? 40 : 32}px;height:${active ? 40 : 32}px;
              border-radius:9999px;
              background:${active ? "#b7ead2" : "rgba(31,122,77,.92)"};
              border:2px solid ${active ? "#fff" : "rgba(183,234,210,.55)"};
              box-shadow:0 4px 14px rgba(0,0,0,.45);
              font-size:${active ? 18 : 15}px;line-height:1;">${
                farm.type === "dairy" ? "🐄" : farm.type === "poultry" ? "🐓" : farm.type === "fish" ? "🐟" : farm.type === "fruits" ? "🥭" : "🥬"
              }</div>`,
          iconSize: [active ? 40 : 32, active ? 40 : 32],
          iconAnchor: [active ? 20 : 16, active ? 20 : 16],
        });

        const marker = leaflet.marker([Number(farm.lat), Number(farm.lng)], { icon, title: farm.name_bn });

        marker.bindTooltip(
          `<div style="font-family:inherit;text-align:right">
             <strong style="font-size:12px">${escapeHtml(farm.name_bn)}</strong><br/>
             <span style="font-size:10px;opacity:.75">${escapeHtml(farm.district)} · ${
               farm.online_cameras ?? 0
             } লাইভ</span>
           </div>`,
          { direction: "top", offset: [0, -10], opacity: 0.95 }
        );

        marker.on("click", () => onSelect?.(farm.id));
        marker.addTo(layer);

        // camera pins (small dots around the farm)
        if (hasCam) {
          for (const cam of farm.cameras ?? []) {
            if (cam.location_lat == null || cam.location_lng == null) continue;
            leaflet
              .circleMarker([Number(cam.location_lat), Number(cam.location_lng)], {
                radius: 4,
                color: cam.status === "online" ? "#b7ead2" : "#6b7280",
                fillColor: cam.status === "online" ? "#b7ead2" : "#4b5563",
                fillOpacity: 0.9,
                weight: 1,
              })
              .bindTooltip(escapeHtml(cam.name_bn), { direction: "top" })
              .addTo(layer);
          }
        }
      }
    })();

    if (activeFarmId && mapRef.current) {
      const farm = farms.find((f) => f.id === activeFarmId);
      if (farm) mapRef.current.flyTo([Number(farm.lat), Number(farm.lng)], 13, { duration: 0.8 });
    }

    return () => {
      cancelled = true;
    };
  }, [ready, farms, cameraIds, activeFarmId, onSelect]);

  return (
    <div className={`relative overflow-hidden rounded-2xl ring-1 ring-white/10 ${className}`}>
      <div ref={containerRef} style={{ height }} className="w-full bg-ink-800" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-ink-800/80">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
        </div>
      )}
      {/* Leaflet's default attribution/controls need a dark treatment */}
      <style jsx global>{`
        .leaflet-container {
          background: #0e1210;
          font-family: inherit;
        }
        .leaflet-control-attribution {
          background: rgba(17, 19, 18, 0.75) !important;
          color: rgba(255, 255, 255, 0.45) !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a {
          color: rgba(183, 234, 210, 0.6) !important;
        }
        .leaflet-bar a {
          background: #161a18 !important;
          color: #b7ead2 !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-bar a:hover {
          background: #1f2421 !important;
        }
        .leaflet-tooltip {
          background: rgba(14, 18, 16, 0.94) !important;
          border: 1px solid rgba(183, 234, 210, 0.22) !important;
          color: #eaf5ee !important;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5) !important;
          border-radius: 8px !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: rgba(183, 234, 210, 0.22) !important;
        }
      `}</style>
    </div>
  );
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

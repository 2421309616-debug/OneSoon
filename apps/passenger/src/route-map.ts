import { load } from "@amap/amap-jsapi-loader";
import type { MapPlace } from "@/passenger-map";

const ROUTE_COLOR = "#1aae5a";

export type RouteSummary = {
  distance: number;
  duration: number;
};

type Avoid = [top: number, bottom: number, left: number, right: number];
type AMapLngLat = { getLng: () => number; getLat: () => number };
type AMapOverlay = object;
type AMapDrivingRoute = {
  distance: number;
  time: number;
  steps: { path: AMapLngLat[] }[];
};
type AMapDriving = {
  search: (
    origin: [number, number],
    destination: [number, number],
    callback: (status: string, result: { routes?: AMapDrivingRoute[] } | string) => void,
  ) => void;
};
type AMapMap = {
  destroy: () => void;
  add: (overlays: AMapOverlay[]) => void;
  setFitView: (overlays: AMapOverlay[], immediately: boolean, avoid: Avoid, maxZoom: number) => void;
};
type AMapApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapOverlay;
  Polyline: new (options: Record<string, unknown>) => AMapOverlay;
  Pixel: new (x: number, y: number) => unknown;
  Driving: new (options: Record<string, unknown>) => AMapDriving;
};

export async function mountRouteMap(
  container: HTMLElement,
  pickup: MapPlace,
  destination: MapPlace,
  getAvoid: () => Avoid,
): Promise<{ destroy: () => void; fit: () => void; summary: RouteSummary | null }> {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (!key || !securityJsCode) {
    return { destroy: () => {}, fit: () => {}, summary: null };
  }

  window._AMapSecurityConfig = { securityJsCode };
  const AMap = (await load({
    key,
    version: "2.0",
    plugins: ["AMap.Driving"],
  })) as AMapApi;
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  container.appendChild(host);
  const start: [number, number] = [pickup.longitude, pickup.latitude];
  const end: [number, number] = [destination.longitude, destination.latitude];
  const map = new AMap.Map(host, { zoom: 13, center: start });

  const route = await new Promise<AMapDrivingRoute | null>((resolve) => {
    new AMap.Driving({ policy: 0 }).search(start, end, (status, result) => {
      resolve(status === "complete" && typeof result !== "string" ? result.routes?.[0] ?? null : null);
    });
  });
  const summary = route ? { distance: route.distance, duration: route.time } : null;
  const path = route ? route.steps.flatMap((step) => step.path) : [];

  const overlays: AMapOverlay[] = [
    dot(AMap, start, ROUTE_COLOR),
    dot(AMap, end, "#d0121a"),
    bubble(AMap, start, `<div style="${BUBBLE_TITLE}">${escapeHtml(pickup.name)}</div>`),
    bubble(
      AMap,
      end,
      `<div style="${BUBBLE_TITLE}">${escapeHtml(destination.name)}</div>${
        summary
          ? `<div style="margin-top:2px;color:#3c4149;font-size:11px;white-space:nowrap">预计 <span style="color:#d0121a">${arrivalTime(summary.duration)}</span> 到达</div>`
          : ""
      }`,
    ),
  ];
  if (summary && path.length) {
    overlays.unshift(
      new AMap.Polyline({
        path,
        strokeColor: ROUTE_COLOR,
        strokeWeight: 8,
        strokeOpacity: 1,
        isOutline: true,
        outlineColor: "#ffffff",
        borderWeight: 2,
        lineJoin: "round",
        lineCap: "round",
        showDir: true,
        zIndex: 50,
      }),
    );
    const middle = halfwayAlong(path);
    overlays.push(
      new AMap.Marker({
        position: middle,
        anchor: "top-center",
        offset: new AMap.Pixel(0, 10),
        zIndex: 120,
        content: `<div style="padding:4px 8px;border-radius:6px;background:rgba(43,45,53,0.88);color:#ffffff;font-size:12px;line-height:1.4;white-space:nowrap">平台推荐<span style="margin:0 6px;opacity:0.5">|</span>${formatDistance(summary.distance)} ${formatDuration(summary.duration)}</div>`,
      }),
    );
  }
  map.add(overlays);

  const fit = () => map.setFitView(overlays, false, getAvoid(), 17);
  fit();

  return {
    destroy: () => {
      map.destroy();
      host.remove();
    },
    fit,
    summary,
  };
}

const BUBBLE_TITLE =
  "max-width:150px;overflow:hidden;color:#1a1a1a;font-size:13px;font-weight:600;line-height:1.35;white-space:nowrap;text-overflow:ellipsis";

function dot(AMap: AMapApi, position: [number, number], color: string): AMapOverlay {
  return new AMap.Marker({
    position,
    anchor: "center",
    zIndex: 110,
    content: `<div style="width:14px;height:14px;border:3px solid #ffffff;border-radius:50%;background:${color};box-sizing:border-box;box-shadow:0 1px 4px rgba(26,26,26,0.35)"></div>`,
  });
}

function bubble(AMap: AMapApi, position: [number, number], html: string): AMapOverlay {
  return new AMap.Marker({
    position,
    anchor: "bottom-center",
    offset: new AMap.Pixel(0, -12),
    zIndex: 130,
    content: `<div style="padding:6px 10px;border-radius:10px;background:#ffffff;box-shadow:0 2px 8px rgba(26,26,26,0.18)">${html}</div>`,
  });
}

function halfwayAlong(path: AMapLngLat[]): AMapLngLat {
  const lengths = path.slice(1).map((point, index) =>
    Math.hypot(point.getLng() - path[index].getLng(), point.getLat() - path[index].getLat()),
  );
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let index = 0; index < lengths.length; index += 1) {
    remaining -= lengths[index];
    if (remaining <= 0) return path[index + 1];
  }
  return path[path.length - 1];
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)}公里`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}分钟`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}小时${rest ? `${rest}分钟` : ""}`;
}

function arrivalTime(seconds: number): string {
  const arrival = new Date(Date.now() + seconds * 1000);
  return `${String(arrival.getHours()).padStart(2, "0")}:${String(arrival.getMinutes()).padStart(2, "0")}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

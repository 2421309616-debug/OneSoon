import { load } from "@amap/amap-jsapi-loader";

const FENGDU: [number, number] = [107.7309, 29.8631];
const PIN = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 43V18" stroke="#128a48" stroke-width="2" stroke-linecap="round"/>
    <circle cx="14" cy="12" r="9" fill="#1aae5a" stroke="#ffffff" stroke-width="2"/>
  </svg>`,
)}`;

export type MapPlace = {
  name: string;
  longitude: number;
  latitude: number;
};

type AMapPixel = { getY?: () => number; y?: number };
type AMapMarker = {
  setPosition: (position: [number, number]) => void;
  setLabel: (label: { content: string; direction: string }) => void;
};
type AMapMap = {
  destroy: () => void;
  add: (marker: AMapMarker) => void;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void;
  lngLatToContainer: (position: [number, number]) => AMapPixel;
  panBy: (x: number, y: number) => void;
};
type AMapApi = {
  Map: new (element: HTMLElement, options: { zoom: number; center: [number, number] }) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Icon: new (options: { size: unknown; imageSize: unknown; image: string }) => unknown;
  Size: new (width: number, height: number) => unknown;
};

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

export async function mountPassengerMap(container: HTMLElement): Promise<{
  destroy: () => void;
  showDestination: (place: MapPlace, screenY: number) => void;
}> {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (!key || !securityJsCode) {
    return { destroy: () => {}, showDestination: () => {} };
  }

  window._AMapSecurityConfig = { securityJsCode };
  const AMap = (await load({
    key,
    version: "2.0",
  })) as AMapApi;
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  container.appendChild(host);
  const map = new AMap.Map(host, {
    zoom: 13,
    center: FENGDU,
  });
  let marker: AMapMarker | undefined;

  return {
    destroy: () => {
      map.destroy();
      host.remove();
    },
    showDestination: (place, screenY) => {
      const position: [number, number] = [place.longitude, place.latitude];
      const label = { content: escapeHtml(place.name), direction: "bottom" };
      if (!marker) {
        marker = new AMap.Marker({
          position,
          anchor: "bottom-center",
          zIndex: 120,
          icon: new AMap.Icon({
            size: new AMap.Size(28, 44),
            imageSize: new AMap.Size(28, 44),
            image: PIN,
          }),
          label,
        });
        map.add(marker);
      } else {
        marker.setPosition(position);
        marker.setLabel(label);
      }
      map.setZoomAndCenter(16, position, true);
      const pixel = map.lngLatToContainer(position);
      const y = typeof pixel.getY === "function" ? pixel.getY() : pixel.y ?? 0;
      const shift = screenY - y;
      if (Math.abs(shift) > 1) map.panBy(0, shift);
    },
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

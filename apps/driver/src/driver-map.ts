import { load } from "@amap/amap-jsapi-loader";

const FENGDU: [number, number] = [107.7309, 29.8631];

const START_PIN = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
    <circle cx="13" cy="13" r="9" fill="#1aae5a" stroke="#ffffff" stroke-width="3"/>
  </svg>`,
)}`;

const END_PIN = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 39V17" stroke="#D0121A" stroke-width="2" stroke-linecap="round"/>
    <circle cx="14" cy="11" r="9" fill="#D0121A" stroke="#ffffff" stroke-width="2"/>
  </svg>`,
)}`;

export type MapPoint = {
  name: string;
  longitude: number;
  latitude: number;
};

type AMapMarker = {
  setPosition: (position: [number, number]) => void;
  setMap: (map: unknown) => void;
};

type AMapPolyline = {
  setPath: (path: [number, number][]) => void;
  setMap: (map: unknown) => void;
};

type AMapMap = {
  destroy: () => void;
  add: (items: unknown[]) => void;
  setFitView: (overlays?: unknown[]) => void;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void;
};

type AMapApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Polyline: new (options: Record<string, unknown>) => AMapPolyline;
  Icon: new (options: { size: unknown; imageSize: unknown; image: string }) => unknown;
  Size: new (width: number, height: number) => unknown;
};

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

export type DriverMap = {
  destroy: () => void;
  showRoute: (from: MapPoint, to: MapPoint) => void;
  clearRoute: () => void;
};

const emptyMap: DriverMap = {
  destroy: () => {},
  showRoute: () => {},
  clearRoute: () => {},
};

export async function mountDriverMap(container: HTMLElement): Promise<DriverMap> {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (!key || !securityJsCode) {
    return emptyMap;
  }

  window._AMapSecurityConfig = { securityJsCode };
  const AMap = (await load({ key, version: "2.0" })) as AMapApi;

  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  container.appendChild(host);

  const map = new AMap.Map(host, {
    zoom: 13,
    center: FENGDU,
    mapStyle: "amap://styles/normal",
  });

  let startMarker: AMapMarker | undefined;
  let endMarker: AMapMarker | undefined;
  let line: AMapPolyline | undefined;

  function toLngLat(point: MapPoint): [number, number] {
    return [point.longitude, point.latitude];
  }

  return {
    destroy: () => {
      map.destroy();
      host.remove();
    },
    clearRoute: () => {
      startMarker?.setMap(null);
      endMarker?.setMap(null);
      line?.setMap(null);
      startMarker = undefined;
      endMarker = undefined;
      line = undefined;
    },
    showRoute: (from, to) => {
      const start = toLngLat(from);
      const end = toLngLat(to);

      if (!startMarker) {
        startMarker = new AMap.Marker({
          position: start,
          anchor: "center",
          zIndex: 110,
          icon: new AMap.Icon({
            size: new AMap.Size(26, 26),
            imageSize: new AMap.Size(26, 26),
            image: START_PIN,
          }),
        });
        map.add([startMarker]);
      } else {
        startMarker.setPosition(start);
        startMarker.setMap(map);
      }

      if (!endMarker) {
        endMarker = new AMap.Marker({
          position: end,
          anchor: "bottom-center",
          zIndex: 120,
          icon: new AMap.Icon({
            size: new AMap.Size(28, 40),
            imageSize: new AMap.Size(28, 40),
            image: END_PIN,
          }),
        });
        map.add([endMarker]);
      } else {
        endMarker.setPosition(end);
        endMarker.setMap(map);
      }

      if (!line) {
        line = new AMap.Polyline({
          path: [start, end],
          strokeColor: "#D0121A",
          strokeWeight: 5,
          strokeOpacity: 0.85,
          strokeStyle: "dashed",
          lineJoin: "round",
          lineCap: "round",
          zIndex: 90,
        });
        map.add([line]);
      } else {
        line.setPath([start, end]);
        line.setMap(map);
      }

      map.setFitView([startMarker, endMarker]);
    },
  };
}

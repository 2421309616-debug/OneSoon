import { load } from "@amap/amap-jsapi-loader";

const FENGDU: [number, number] = [107.7309, 29.8631];

export type MapPlace = {
  name: string;
  longitude: number;
  latitude: number;
};

const SPOT_TYPES = "150700|150500|991000|120300|141200|090100|060100|100100";
const SPOT_RADIUS = 150;
const SPOT_LIMIT = 5;
const SNAP_DISTANCE = 50;

type AMapPixel = { getX?: () => number; getY?: () => number; x?: number; y?: number };
type AMapMarker = {
  on: (event: string, handler: () => void) => void;
};
type AMapPoi = { name: string; distance?: number; location?: AMapLngLat };
type AMapPlaceSearch = {
  searchNearBy: (
    keyword: string,
    center: AMapLngLat,
    radius: number,
    callback: (status: string, result: { poiList?: { pois?: AMapPoi[] } } | string) => void,
  ) => void;
};
type PickupSpot = { name: string; position: [number, number]; distance: number };
type AMapLngLat = { getLng: () => number; getLat: () => number };
type AMapAddress = {
  formattedAddress?: string;
  addressComponent?: { province?: string; city?: string | string[]; district?: string };
};
type AMapGeolocationResult = AMapAddress & { position: AMapLngLat };
type AMapGeolocation = {
  getCurrentPosition: (
    callback: (status: "complete" | "error", result: AMapGeolocationResult) => void,
  ) => void;
};
type AMapGeocoder = {
  getAddress: (
    position: AMapLngLat,
    callback: (status: string, result: { regeocode?: AMapAddress }) => void,
  ) => void;
};
type AMapMap = {
  destroy: () => void;
  add: (marker: AMapMarker) => void;
  remove: (markers: AMapMarker[]) => void;
  addControl: (control: AMapGeolocation) => void;
  on: (event: string, handler: () => void) => void;
  containerToLngLat: (pixel: unknown) => AMapLngLat;
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void;
  lngLatToContainer: (position: [number, number]) => AMapPixel;
  panBy: (x: number, y: number) => void;
};
type AMapApi = {
  Map: new (element: HTMLElement, options: { zoom: number; center: [number, number] }) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Pixel: new (x: number, y: number) => unknown;
  Geolocation: new (options: Record<string, unknown>) => AMapGeolocation;
  Geocoder: new (options: Record<string, unknown>) => AMapGeocoder;
  PlaceSearch: new (options: Record<string, unknown>) => AMapPlaceSearch;
};

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

export async function mountPassengerMap(container: HTMLElement): Promise<{
  destroy: () => void;
  locate: (screenY: number) => void;
  watchPickup: (
    getScreenY: () => number,
    onLift: () => void,
    onPick: (place: MapPlace) => void,
  ) => void;
}> {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (!key || !securityJsCode) {
    return {
      destroy: () => {},
      locate: () => {},
      watchPickup: () => {},
    };
  }

  window._AMapSecurityConfig = { securityJsCode };
  const AMap = (await load({
    key,
    version: "2.0",
    plugins: ["AMap.Geolocation", "AMap.Geocoder", "AMap.PlaceSearch"],
  })) as AMapApi;
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.height = "100%";
  container.appendChild(host);
  const map = new AMap.Map(host, {
    zoom: 13,
    center: FENGDU,
  });
  const geocoder = new AMap.Geocoder({});
  const placeSearch = new AMap.PlaceSearch({ type: SPOT_TYPES, pageSize: SPOT_LIMIT, pageIndex: 1 });
  let spotMarkers: AMapMarker[] = [];
  let pickTicket = 0;
  let pickupScreenY = () => 0;
  let onPickup: (place: MapPlace) => void = () => {};

  const pixelOf = (position: [number, number]) => {
    const pixel = map.lngLatToContainer(position);
    return {
      x: typeof pixel.getX === "function" ? pixel.getX() : pixel.x ?? 0,
      y: typeof pixel.getY === "function" ? pixel.getY() : pixel.y ?? 0,
    };
  };

  const centerAt = (position: [number, number], screenY: number) => {
    map.setZoomAndCenter(16, position, true);
    const shift = screenY - pixelOf(position).y;
    if (Math.abs(shift) > 1) map.panBy(0, shift);
  };

  const clearSpots = () => {
    if (spotMarkers.length) map.remove(spotMarkers);
    spotMarkers = [];
  };

  const snapTo = (spot: PickupSpot, screenY: number) => {
    const pixel = pixelOf(spot.position);
    map.panBy(host.clientWidth / 2 - pixel.x, screenY - pixel.y);
    onPickup({ name: spot.name, longitude: spot.position[0], latitude: spot.position[1] });
  };

  const showSpots = (spots: PickupSpot[]) => {
    clearSpots();
    spotMarkers = spots.map((spot) => {
      const spotMarker = new AMap.Marker({
        position: spot.position,
        anchor: "middle-left",
        offset: new AMap.Pixel(-6, 0),
        zIndex: 110,
        content: spotHtml(spot.name),
      });
      spotMarker.on("click", () => snapTo(spot, pickupScreenY()));
      map.add(spotMarker);
      return spotMarker;
    });
  };

  const addressAt = (position: AMapLngLat) =>
    new Promise<string>((resolve) => {
      geocoder.getAddress(position, (status, result) => {
        resolve(status === "complete" && result.regeocode ? shortAddress(result.regeocode) : "");
      });
    });

  const spotsNear = (position: AMapLngLat) =>
    new Promise<PickupSpot[]>((resolve) => {
      placeSearch.searchNearBy("", position, SPOT_RADIUS, (status, result) => {
        const pois = status === "complete" && typeof result !== "string" ? result.poiList?.pois ?? [] : [];
        const spots = pois.flatMap((poi) =>
          poi.location
            ? [{
                name: poi.name,
                position: [poi.location.getLng(), poi.location.getLat()] as [number, number],
                distance: poi.distance ?? Infinity,
              }]
            : [],
        );
        resolve(spots.sort((a, b) => a.distance - b.distance).slice(0, SPOT_LIMIT));
      });
    });

  const pickAt = async (screenY: number) => {
    const current = ++pickTicket;
    const position = map.containerToLngLat(new AMap.Pixel(host.clientWidth / 2, screenY));
    const [address, spots] = await Promise.all([addressAt(position), spotsNear(position)]);
    if (current !== pickTicket) return;
    showSpots(spots);
    const nearest = spots[0];
    if (nearest && nearest.distance <= SNAP_DISTANCE) {
      snapTo(nearest, screenY);
      return;
    }
    onPickup({ name: address || "地图选点", longitude: position.getLng(), latitude: position.getLat() });
  };

  return {
    destroy: () => {
      map.destroy();
      host.remove();
    },
    locate: (screenY) => {
      const geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        needAddress: true,
        showButton: false,
        showMarker: true,
        showCircle: true,
        panToLocation: false,
        zoomToAccuracy: false,
      });
      map.addControl(geolocation);
      geolocation.getCurrentPosition((status, result) => {
        if (status !== "complete") return;
        centerAt([result.position.getLng(), result.position.getLat()], screenY);
        void pickAt(screenY);
      });
    },
    watchPickup: (getScreenY, onLift, onPick) => {
      pickupScreenY = getScreenY;
      onPickup = onPick;
      let dragged = false;
      map.on("dragstart", () => {
        dragged = true;
        pickTicket += 1;
        onLift();
      });
      map.on("moveend", () => {
        if (!dragged) return;
        dragged = false;
        void pickAt(getScreenY());
      });
    },
  };
}

function shortAddress(result: AMapAddress): string {
  const full = result.formattedAddress ?? "";
  const parts = result.addressComponent;
  const city = Array.isArray(parts?.city) || parts?.city === parts?.province ? "" : parts?.city ?? "";
  const prefix = `${parts?.province ?? ""}${city}${parts?.district ?? ""}`;
  const short = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full;
  return short || full;
}

function spotHtml(name: string): string {
  return `<div style="display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap">
    <span style="width:12px;height:12px;border:2px solid #8a8f98;border-radius:50%;background:#ffffff;box-sizing:border-box;box-shadow:0 1px 3px rgba(26,26,26,0.25)"></span>
    <span style="color:#3c4149;font-size:12px;font-weight:500;line-height:1.2;text-shadow:0 0 2px #ffffff,0 0 4px #ffffff">${escapeHtml(name)}</span>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

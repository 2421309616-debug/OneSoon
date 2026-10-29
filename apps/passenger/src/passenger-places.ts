import { load } from "@amap/amap-jsapi-loader";

const FENGDU = "丰都县";

export type PlaceTip = {
  placeId: string;
  name: string;
  address: string;
  longitude: number | null;
  latitude: number | null;
};

type AutoComplete = {
  search: (
    keyword: string,
    callback: (status: string, result: { tips?: unknown }) => void,
  ) => void;
};

type AMapApi = {
  AutoComplete: new (options: { city: string; datatype: string }) => AutoComplete;
};

let autocomplete: Promise<AutoComplete> | null = null;

function amap(): Promise<AutoComplete> {
  if (!autocomplete) {
    autocomplete = openAutoComplete().catch((error: unknown) => {
      autocomplete = null;
      throw error;
    });
  }
  return autocomplete;
}

async function openAutoComplete(): Promise<AutoComplete> {
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  if (!key || !securityJsCode) {
    throw new Error("缺少高德地图钥匙");
  }

  window._AMapSecurityConfig = { securityJsCode };
  const AMap = (await load({
    key,
    version: "2.0",
    plugins: ["AMap.AutoComplete"],
  })) as AMapApi;
  return new AMap.AutoComplete({
    city: FENGDU,
    datatype: "poi",
  });
}

export async function searchPlaceTips(keyword: string): Promise<PlaceTip[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const complete = await amap();
  const tips = await new Promise<unknown>((resolve, reject) => {
    complete.search(trimmed, (status, result) => {
      if (status === "complete" || status === "no_data") {
        resolve(result.tips ?? []);
        return;
      }
      reject(new Error("地点查询失败"));
    });
  });
  const rows = Array.isArray(tips) ? tips : [];
  return rows.flatMap((tip) => {
    const place = readTip(tip);
    return place ? [place] : [];
  });
}

function readTip(value: unknown): PlaceTip | null {
  if (!value || typeof value !== "object") return null;
  const tip = value as Record<string, unknown>;
  const name = text(tip.name);
  if (!name) return null;
  const district = text(tip.district);
  const address = text(tip.address);
  const point = readPoint(tip.location);
  return {
    placeId: text(tip.id),
    name,
    address: district && address && !address.startsWith(district) ? `${district}${address}` : address || district,
    longitude: point?.longitude ?? null,
    latitude: point?.latitude ?? null,
  };
}

function readPoint(location: unknown): { longitude: number; latitude: number } | null {
  if (typeof location === "string") {
    const [longitude, latitude] = location.split(",").map(Number);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return { longitude, latitude };
    }
    return null;
  }
  if (!location || typeof location !== "object") return null;
  const value = location as {
    lng?: number;
    lat?: number;
    getLng?: () => number;
    getLat?: () => number;
  };
  const longitude = typeof value.getLng === "function" ? value.getLng() : value.lng;
  const latitude = typeof value.getLat === "function" ? value.getLat() : value.lat;
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { longitude, latitude };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

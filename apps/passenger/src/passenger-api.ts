import type { PassengerSession } from "./passenger-session";

const API_ROOT = "http://127.0.0.1:3000";

type ErrorBody = {
  message?: string | string[];
};

export type PlaceSearch = {
  placeId: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  searchCount: number;
};

async function requestJson<T>(
  path: string,
  method: "GET" | "POST",
  data?: Record<string, unknown>,
): Promise<T> {
  let response: UniApp.RequestSuccessCallbackResult;
  try {
    response = await uni.request({
      url: `${API_ROOT}${path}`,
      method,
      data,
      header: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("连不上后端。请在 apps/api 运行 npm run start");
  }

  const status = response.statusCode ?? 0;
  if (status >= 200 && status < 300) {
    return response.data as T;
  }

  const body = response.data as ErrorBody;
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  throw new Error(message || "请求失败");
}

export async function postJson<T>(path: string, data: Record<string, string>): Promise<T> {
  return requestJson<T>(path, "POST", data);
}

export function requestVerificationCode(phone: string) {
  return postJson<{ accepted: boolean }>("/passengers/verification-codes", { phone });
}

export function enterWithCode(phone: string, code: string) {
  return postJson<PassengerSession>("/passengers/sessions", { phone, code });
}

export function listPlaceSearches(passengerId: string) {
  return requestJson<{ places: PlaceSearch[] }>(
    `/passengers/${passengerId}/place-searches`,
    "GET",
  );
}

export function recordPlaceSearch(
  passengerId: string,
  place: {
    placeId: string;
    name: string;
    address: string;
    longitude: number;
    latitude: number;
  },
) {
  return requestJson<PlaceSearch>(`/passengers/${passengerId}/place-searches`, "POST", place);
}

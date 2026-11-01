import type { DriverSession } from "./driver-session";
import type { PlacePoint, TripOrder } from "./mock-orders";

const API_ROOT = "http://127.0.0.1:3000";

type ErrorBody = {
  message?: string | string[];
};

export type DriverStatus = "online" | "offline";

export type OrderStatus =
  | "pool"
  | "toPickup"
  | "waiting"
  | "inTrip"
  | "settling"
  | "completed"
  | "cancelled";

export type ApiPlace = {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
};

export type ApiOrder = {
  id: string;
  status: OrderStatus;
  passengerName: string;
  passengerPhone: string;
  passengerRating: number | null;
  from: ApiPlace;
  to: ApiPlace;
  pickupKm: number;
  pickupMinutes: number;
  tripKm: number;
  tripMinutes: number;
  fare: number;
  note: string;
  acceptedAt: string | null;
  completedAt: string | null;
};

export type ApiDriver = {
  id: string;
  phone: string;
  name: string;
  plate: string;
  carModel: string;
  rating: number;
  status: DriverStatus;
};

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

async function requestJson<T>(
  path: string,
  method: HttpMethod,
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

/** 后端返回的司机信息转成前端 session 结构 */
export function toDriverSession(driver: ApiDriver): DriverSession {
  return {
    id: driver.id,
    phone: driver.phone,
    name: driver.name,
    plate: driver.plate,
    carModel: driver.carModel,
    rating: driver.rating,
  };
}

function toPlacePoint(place: ApiPlace): PlacePoint {
  return {
    name: place.name,
    address: place.address,
    lngLat: [place.longitude, place.latitude],
  };
}

/** 后端订单转成 UI 用的 TripOrder */
export function toTripOrder(order: ApiOrder): TripOrder {
  return {
    id: order.id,
    passengerName: order.passengerName,
    passengerPhone: order.passengerPhone,
    passengerRating: order.passengerRating ?? 4.9,
    from: toPlacePoint(order.from),
    to: toPlacePoint(order.to),
    pickupKm: order.pickupKm,
    pickupMinutes: order.pickupMinutes,
    tripKm: order.tripKm,
    tripMinutes: order.tripMinutes,
    fare: order.fare,
    note: order.note,
  };
}

export function requestVerificationCode(phone: string) {
  return requestJson<{ accepted: boolean }>("/drivers/verification-codes", "POST", {
    phone,
  });
}

export function enterWithCode(phone: string, code: string) {
  return requestJson<ApiDriver>("/drivers/sessions", "POST", { phone, code });
}

export function getDriver(id: string) {
  return requestJson<ApiDriver>(`/drivers/${id}`, "GET");
}

export function setDriverStatus(id: string, status: DriverStatus) {
  return requestJson<ApiDriver>(`/drivers/${id}/status`, "PUT", { status });
}

export function listPoolOrders() {
  return requestJson<{ orders: ApiOrder[] }>("/orders/pool", "GET");
}

export function listDriverOrders(id: string) {
  return requestJson<{ active: ApiOrder[]; completed: ApiOrder[] }>(
    `/drivers/${id}/orders`,
    "GET",
  );
}

export function fetchDriverStats(id: string) {
  return requestJson<{ orders: number; income: number }>(
    `/drivers/${id}/stats`,
    "GET",
  );
}

export function acceptOrder(driverId: string, orderId: string) {
  return requestJson<ApiOrder>(
    `/drivers/${driverId}/orders/${orderId}/accept`,
    "POST",
  );
}

export function advanceOrder(driverId: string, orderId: string) {
  return requestJson<ApiOrder>(
    `/drivers/${driverId}/orders/${orderId}/advance`,
    "POST",
  );
}

export function cancelOrder(driverId: string, orderId: string) {
  return requestJson<{ released: boolean }>(
    `/drivers/${driverId}/orders/${orderId}`,
    "DELETE",
  );
}

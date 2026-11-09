/**
 * Driver H5 API boundary.
 * Set VITE_DRIVER_API_BASE_URL to enable requests. With no URL, the UI stays in demo mode.
 * Proposed backend routes:
 * POST   /drivers/verification-codes
 * POST   /drivers/sessions
 * GET    /drivers/me/dashboard
 * GET    /drivers/me/earnings?date=today|week|month
 * GET    /drivers/me/orders/offers
 * PUT    /drivers/me/availability
 * GET    /drivers/me/orders/offers/current
 * POST   /drivers/me/orders/:orderId/accept
 * POST   /drivers/me/orders/:orderId/decline
 * POST   /drivers/me/trips/:tripId/events
 * POST   /drivers/me/trips/:tripId/payment-requests
 * GET    /drivers/me/trips/:tripId/navigation?target=pickup|destination
 * POST   /drivers/me/location
 * GET    /drivers/me/trips?date=today
 * GET    /drivers/me/trips?status=completed
 * POST   /drivers/me/safety/alerts
 * GET    /drivers/me/orders/:orderId/passenger-contact
 * POST   /drivers/me/orders/:orderId/calls
 * POST   /drivers/me/orders/:orderId/messages
 */

export type DriverDashboard = {
  displayName: string;
  serviceScore: number;
  todayOrders: number;
  todayIncome: number;
  online: boolean;
};

export type DriverSession = {
  id: string;
  displayName: string;
  phone: string;
  profileComplete: boolean;
  accessToken?: string;
};

export type DriverTripSummary = {
  id: string;
  time: string;
  pickup: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  fare: number;
  status: "completed" | "cancelled";
};

export type DriverEarningsSummary = {
  dateLabel: string;
  total: number;
  completedOrders: number;
  onlineMinutes: number;
  bonus: number;
  trips: DriverTripSummary[];
};

export type DispatchOrder = {
  id: string;
  status: "waiting" | "accepted" | "cancelled";
  passengerName: string;
  pickup: { name: string; longitude: number; latitude: number };
  destination: { name: string; longitude: number; latitude: number };
  distanceMeters: number;
  durationSeconds: number;
  fareCents: number;
  createdAt: string;
  driver: { name: string | null; vehicleModel: string | null; plate: string | null } | null;
};

export type OrderOffer = {
  id: string;
  passengerName: string;
  pickup: string;
  destination: string;
  pickupDistanceKm: number;
  tripDistanceKm: number;
  estimatedMinutes: number;
  estimatedFare: number;
};

export type TripEvent = "arrived" | "started" | "completed" | "cancelled";

export type NavigationTarget = "pickup" | "destination";

export type DriverCoordinate = {
  latitude: number;
  longitude: number;
};

export type DriverNavigationRoute = {
  distanceKm: number;
  durationMinutes: number;
  /** Ordered coordinates for drawing the route with the selected map SDK. */
  polyline: DriverCoordinate[];
};

export type PassengerContact = {
  name: string;
  maskedPhone: string;
};

export type PassengerCallResult = {
  accepted: boolean;
  demo?: boolean;
};

export type PassengerMessageResult = {
  sent: boolean;
  demo?: boolean;
};

export type TripPaymentRequestResult = {
  accepted: boolean;
  demo?: boolean;
};

export const demoOffers: OrderOffer[] = [
  { id: "demo-order-2048", passengerName: "林女士", pickup: "丰都县人民医院（门诊部）", destination: "丰都高铁站", pickupDistanceKm: 1.2, tripDistanceKm: 8.6, estimatedMinutes: 22, estimatedFare: 36.8 },
  { id: "demo-order-2049", passengerName: "陈先生", pickup: "宏声文化广场", destination: "龙河新城", pickupDistanceKm: 0.8, tripDistanceKm: 5.4, estimatedMinutes: 16, estimatedFare: 24.5 },
  { id: "demo-order-2050", passengerName: "周女士", pickup: "丰都汽车站", destination: "名山景区游客中心", pickupDistanceKm: 2.1, tripDistanceKm: 11.2, estimatedMinutes: 28, estimatedFare: 42.0 },
];

export const demoTrips: DriverTripSummary[] = [
  { id: "trip-1042", time: "09:42", pickup: "龙河新城", destination: "丰都汽车站", distanceKm: 6.2, durationMinutes: 18, fare: 24, status: "completed" },
  { id: "trip-1041", time: "08:15", pickup: "宏声文化广场", destination: "丰都县人民医院", distanceKm: 4.8, durationMinutes: 15, fare: 18.5, status: "completed" },
  { id: "trip-1040", time: "07:26", pickup: "丰都高铁站", destination: "平都大道", distanceKm: 7.1, durationMinutes: 21, fare: 29.8, status: "completed" },
];

export const demoEarnings: DriverEarningsSummary = {
  dateLabel: "今日",
  total: 657,
  completedOrders: 23,
  onlineMinutes: 386,
  bonus: 48,
  trips: demoTrips,
};

const apiBase = (import.meta.env.VITE_DRIVER_API_BASE_URL ?? "").replace(/\/$/, "");

function request<T>(path: string, method: "GET" | "POST" | "PUT", data?: Record<string, unknown>): Promise<T | null> {
  if (!apiBase) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const storedSession = uni.getStorageSync("onesoon-driver") as DriverSession | "";
    const accessToken = storedSession && typeof storedSession === "object" ? storedSession.accessToken : undefined;
    uni.request({
      url: `${apiBase}${path}`,
      method,
      data,
      header: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      success: ({ statusCode, data: body }) => {
        if (statusCode >= 200 && statusCode < 300) resolve(body as T);
        else reject(new Error(`Driver API returned ${statusCode}`));
      },
      fail: reject,
    });
  });
}

const API_ROOT = "http://127.0.0.1:3000";

export type DriverProfile = {
  id: string;
  phone: string;
  name: string | null;
  vehicleModel: string | null;
  plate: string | null;
  photoUrl: string | null;
  vehicleImageUrl: string | null;
  personalComplete: boolean;
  vehicleComplete: boolean;
  documentsComplete: boolean;
  idOnFile: boolean;
};

export type VehicleOption = {
  id: number;
  brand: string;
  model: string;
  modelYear: number;
  colorName: string;
  view: string;
  imageUrl: string;
};

export function apiAsset(path: string): string {
  return `${API_ROOT}${path}`;
}

function postAuth<T>(path: string, data?: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_ROOT}${path}`,
      method,
      data,
      header: { "Content-Type": "application/json" },
      success: ({ statusCode, data: body }) => {
        if ((statusCode ?? 0) >= 200 && (statusCode ?? 0) < 300) {
          resolve(body as T);
          return;
        }
        const message = (body as { message?: string | string[] } | null)?.message;
        reject(new Error((Array.isArray(message) ? message[0] : message) || "请求失败"));
      },
      fail: () => reject(new Error("连不上后端。请在 apps/api 运行 npm run start:dev")),
    });
  });
}

export const driverApi = {
  requestVerificationCode: (phone: string) =>
    postAuth<{ accepted: boolean }>("/drivers/verification-codes", { phone }),
  login: (phone: string, code: string) =>
    postAuth<DriverSession>("/drivers/sessions", { phone, code }),
  listWaitingOrders: (driverId: string) =>
    postAuth<{ orders: DispatchOrder[] }>(`/drivers/${driverId}/orders/waiting`, undefined, "GET"),
  currentDispatchOrder: (driverId: string) =>
    postAuth<{ order: DispatchOrder | null }>(`/drivers/${driverId}/orders/current`, undefined, "GET"),
  acceptDispatchOrder: (driverId: string, orderId: string) =>
    postAuth<DispatchOrder>(`/drivers/${driverId}/orders/${orderId}/accept`),
  completeProfile: (
    driverId: string,
    profile: {
      name: string;
      idNumber: string;
      vehicleModel: string;
      plate: string;
      photo: string;
      driverLicense: string;
      vehicleLicense: string;
    },
  ) => postAuth<DriverSession>(`/drivers/${driverId}/profile`, profile),
  savePersonal: (driverId: string, profile: Record<string, string>) =>
    postAuth<DriverSession>(`/drivers/${driverId}/profile/personal`, profile),
  saveVehicle: (driverId: string, profile: Record<string, string>) =>
    postAuth<DriverSession>(`/drivers/${driverId}/profile/vehicle`, profile),
  saveDocuments: (driverId: string, profile: Record<string, string>) =>
    postAuth<DriverSession>(`/drivers/${driverId}/profile/documents`, profile),
  getProfile: (driverId: string) => postAuth<DriverProfile>(`/drivers/${driverId}`, undefined, "GET"),
  setVehicleType: (driverId: string, vehicleModel: string) =>
    postAuth<{ accepted: boolean }>(`/drivers/${driverId}/vehicle-type`, { vehicleModel }),
  listVehicleOptions: () => postAuth<VehicleOption[]>("/vehicle-options", undefined, "GET"),
  getEarnings: (period: "today" | "week" | "month" = "today") =>
    request<DriverEarningsSummary>(`/drivers/me/earnings?date=${period}`, "GET"),
  getTrips: () => request<DriverTripSummary[]>("/drivers/me/trips?date=today", "GET"),
  getCompletedTrips: () => request<DriverTripSummary[]>("/drivers/me/trips?status=completed", "GET"),
  getOrderOffers: () => request<OrderOffer[]>("/drivers/me/orders/offers", "GET"),
  getDashboard: () => request<DriverDashboard>("/drivers/me/dashboard", "GET"),
  setAvailability: (online: boolean) =>
    request<void>("/drivers/me/availability", "PUT", { online }),
  getCurrentOffer: () => request<OrderOffer>("/drivers/me/orders/offers/current", "GET"),
  acceptOffer: (orderId: string) =>
    request<void>(`/drivers/me/orders/${encodeURIComponent(orderId)}/accept`, "POST"),
  declineOffer: (orderId: string) =>
    request<void>(`/drivers/me/orders/${encodeURIComponent(orderId)}/decline`, "POST"),
  updateTrip: (tripId: string, event: TripEvent) =>
    request<void>(`/drivers/me/trips/${encodeURIComponent(tripId)}/events`, "POST", { event }),
  requestTripPayment: (tripId: string, amount: number) =>
    (apiBase
      ? request<TripPaymentRequestResult>(`/drivers/me/trips/${encodeURIComponent(tripId)}/payment-requests`, "POST", { amount })
      : Promise.resolve<TripPaymentRequestResult | null>({ accepted: true, demo: true }))
      .then((result) => result ?? { accepted: true, demo: !apiBase }),
  getNavigationRoute: (tripId: string, target: NavigationTarget) =>
    request<DriverNavigationRoute>(
      `/drivers/me/trips/${encodeURIComponent(tripId)}/navigation?target=${target}`,
      "GET",
    ),
  reportLocation: (location: DriverCoordinate, heading?: number, speed?: number) =>
    request<void>("/drivers/me/location", "POST", { ...location, heading, speed }),
  getTodayTrips: () => request<unknown[]>("/drivers/me/trips?date=today", "GET"),
  sendSafetyAlert: (location?: { latitude: number; longitude: number }) =>
    request<void>("/drivers/me/safety/alerts", "POST", { location }),
  getPassengerContact: (orderId: string) =>
    request<PassengerContact>(`/drivers/me/orders/${encodeURIComponent(orderId)}/passenger-contact`, "GET")
      .then((contact) => contact ?? {
        name: demoOffers.find((offer) => offer.id === orderId)?.passengerName ?? "乘客",
        maskedPhone: "138****5208",
      }),
  requestPassengerCall: (orderId: string) =>
    request<PassengerCallResult>(`/drivers/me/orders/${encodeURIComponent(orderId)}/calls`, "POST")
      .then((result) => result ?? { accepted: true, demo: true }),
  sendPassengerMessage: (orderId: string, content: string) =>
    request<PassengerMessageResult>(`/drivers/me/orders/${encodeURIComponent(orderId)}/messages`, "POST", { content })
      .then((result) => result ?? { sent: true, demo: true }),
};

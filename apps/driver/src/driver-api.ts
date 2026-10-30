/**
 * Driver H5 API boundary.
 * Set VITE_DRIVER_API_BASE_URL to enable requests. With no URL, the UI stays in demo mode.
 * Proposed backend routes:
 * GET    /drivers/me/dashboard
 * PUT    /drivers/me/availability
 * GET    /drivers/me/orders/offers/current
 * POST   /drivers/me/orders/:orderId/accept
 * POST   /drivers/me/orders/:orderId/decline
 * POST   /drivers/me/trips/:tripId/events
 * GET    /drivers/me/trips/:tripId/navigation?target=pickup|destination
 * POST   /drivers/me/location
 * GET    /drivers/me/trips?date=today
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

const apiBase = (import.meta.env.VITE_DRIVER_API_BASE_URL ?? "").replace(/\/$/, "");

function request<T>(path: string, method: "GET" | "POST" | "PUT", data?: unknown): Promise<T | null> {
  if (!apiBase) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${apiBase}${path}`,
      method,
      data,
      success: ({ statusCode, data: body }) => {
        if (statusCode >= 200 && statusCode < 300) resolve(body as T);
        else reject(new Error(`Driver API returned ${statusCode}`));
      },
      fail: reject,
    });
  });
}

export const driverApi = {
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
      .then((contact) => contact ?? { name: "林女士", maskedPhone: "138****5208" }),
  requestPassengerCall: (orderId: string) =>
    request<PassengerCallResult>(`/drivers/me/orders/${encodeURIComponent(orderId)}/calls`, "POST")
      .then((result) => result ?? { accepted: true, demo: true }),
  sendPassengerMessage: (orderId: string, content: string) =>
    request<PassengerMessageResult>(`/drivers/me/orders/${encodeURIComponent(orderId)}/messages`, "POST", { content })
      .then((result) => result ?? { sent: true, demo: true }),
};

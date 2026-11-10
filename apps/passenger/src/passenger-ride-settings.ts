import type { RidePreferences } from "./passenger-api";

const RIDE_OPTIONS_KEY = "onesoon-ride-options";
const RIDE_SETTINGS_KEY = "onesoon-ride-settings";

export type RideOptions = {
  scheduledAt: string | null;
  riderName: string;
  riderPhone: string;
};

export type RideSettings = RidePreferences;

const emptyOptions = (): RideOptions => ({ scheduledAt: null, riderName: "", riderPhone: "" });
const defaultSettings = (): RideSettings => ({ quietRide: false, smokeFree: false, trunkNeeded: false, note: "" });

export function readRideOptions(): RideOptions {
  return readValue<RideOptions>(RIDE_OPTIONS_KEY, emptyOptions());
}

export function saveRideOptions(value: RideOptions) {
  uni.setStorageSync(RIDE_OPTIONS_KEY, value);
}

export function clearRideOptions() {
  uni.removeStorageSync(RIDE_OPTIONS_KEY);
}

export function readRideSettings(): RideSettings {
  return { ...defaultSettings(), ...readValue<Partial<RideSettings>>(RIDE_SETTINGS_KEY, {}) };
}

export function saveRideSettings(value: RideSettings) {
  uni.setStorageSync(RIDE_SETTINGS_KEY, value);
}

function readValue<T>(key: string, fallback: T): T {
  const value = uni.getStorageSync(key) as T | "";
  return value && typeof value === "object" ? value : fallback;
}

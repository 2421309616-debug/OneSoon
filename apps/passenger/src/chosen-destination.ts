const STORAGE_KEY = "onesoon-chosen-destination";
const PICKUP_KEY = "onesoon-chosen-pickup";

export type ChosenDestination = {
  name: string;
  longitude: number;
  latitude: number;
};

export type ChosenPickup = ChosenDestination;

export function saveChosenDestination(place: ChosenDestination) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(place));
}

export function clearChosenDestination() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function readChosenDestination(): ChosenDestination | null {
  return readPlace(STORAGE_KEY);
}

export function saveChosenPickup(place: ChosenPickup) {
  sessionStorage.setItem(PICKUP_KEY, JSON.stringify(place));
}

export function clearChosenPickup() {
  sessionStorage.removeItem(PICKUP_KEY);
}

export function readChosenPickup(): ChosenPickup | null {
  return readPlace(PICKUP_KEY);
}

function readPlace(key: string): ChosenDestination | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChosenDestination>;
    if (typeof value.name !== "string" || value.name.trim() === "") return null;
    if (typeof value.longitude !== "number" || typeof value.latitude !== "number") return null;
    if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude)) return null;
    return {
      name: value.name,
      longitude: value.longitude,
      latitude: value.latitude,
    };
  } catch {
    return null;
  }
}

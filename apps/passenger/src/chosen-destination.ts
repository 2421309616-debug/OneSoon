const STORAGE_KEY = "onesoon-chosen-destination";

export type ChosenDestination = {
  name: string;
  longitude: number;
  latitude: number;
};

export function saveChosenDestination(place: ChosenDestination) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(place));
}

export function readChosenDestination(): ChosenDestination | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
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

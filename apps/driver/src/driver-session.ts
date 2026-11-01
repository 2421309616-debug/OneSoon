const STORAGE_KEY = "onesoon-driver";

export type DriverSession = {
  id: string;
  phone: string;
  name: string;
  plate: string;
  carModel: string;
  rating: number;
};

export function readDriver(): DriverSession | null {
  try {
    const value = uni.getStorageSync(STORAGE_KEY) as DriverSession | "";
    if (!value || typeof value !== "object" || !value.id || !value.phone) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function saveDriver(session: DriverSession) {
  uni.setStorageSync(STORAGE_KEY, session);
}

export function clearDriver() {
  uni.removeStorageSync(STORAGE_KEY);
}

export function requireDriver(): DriverSession | null {
  const driver = readDriver();
  if (!driver) {
    uni.reLaunch({ url: "/pages/login/login" });
    return null;
  }
  return driver;
}

const STORAGE_KEY = "onesoon-driver";

let entered = false;

export function markDriverEntered() {
  entered = true;
}

export type DriverSession = {
  id: string;
  phone: string;
  displayName: string;
  profileComplete: boolean;
};

export function readDriver(): DriverSession | null {
  const value = uni.getStorageSync(STORAGE_KEY) as DriverSession | "";
  if (!value || typeof value !== "object" || !value.id || !value.phone) {
    return null;
  }
  return { ...value, profileComplete: value.profileComplete === true };
}

export function saveDriver(driver: DriverSession) {
  uni.setStorageSync(STORAGE_KEY, driver);
}

export function requireDriver(): DriverSession | null {
  const driver = readDriver();
  if (!driver || !entered) {
    uni.reLaunch({ url: "/pages/login/login" });
    return null;
  }
  return driver;
}

const STORAGE_KEY = "onesoon-driver";
const SKIP_KEY = "onesoon-driver-certification-skipped";

export function skipCertification(driverId: string) {
  uni.setStorageSync(SKIP_KEY, driverId);
}

export function clearCertificationSkip(driverId: string) {
  if (uni.getStorageSync(SKIP_KEY) === driverId) uni.removeStorageSync(SKIP_KEY);
}

export function isCertificationSkipped(driverId: string) {
  return uni.getStorageSync(SKIP_KEY) === driverId;
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
  if (!driver) {
    uni.reLaunch({ url: "/pages/login/login" });
    return null;
  }
  return driver;
}

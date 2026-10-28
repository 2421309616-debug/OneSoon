const STORAGE_KEY = "onesoon-passenger";

export type PassengerSession = {
  id: string;
  phone: string;
  nickname: string;
};

export function readPassenger(): PassengerSession | null {
  const value = uni.getStorageSync(STORAGE_KEY) as PassengerSession | "";
  if (!value || typeof value !== "object" || !value.id || !value.phone) {
    return null;
  }
  return value;
}

export function savePassenger(passenger: PassengerSession) {
  uni.setStorageSync(STORAGE_KEY, passenger);
}

export function requirePassenger(): PassengerSession | null {
  const passenger = readPassenger();
  if (!passenger) {
    uni.reLaunch({ url: "/pages/login/login" });
    return null;
  }
  return passenger;
}

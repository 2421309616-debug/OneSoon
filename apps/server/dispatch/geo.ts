import type { LngLat } from "./types.js";

const EARTH_RADIUS_METERS = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * 两点之间的球面距离（米）。
 *
 * 用 haversine 而不是「经纬度各乘个系数」：后者在纬度变化时误差会累积，
 * 县城范围虽然小，但没理由留一个已知的误差。
 */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;

  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * 预估到达时间（分钟）。
 *
 * 直线距离 × 道路曲折系数 ÷ 区间均速。没有路况数据时这是能给出的最诚实的估算 ——
 * 将来接入真实导航，只换这个函数，分档阈值不用动。
 */
export function etaMinutes(
  from: LngLat,
  to: LngLat,
  detourFactor: number,
  averageSpeedKmh: number,
): number {
  const straightKm = distanceMeters(from, to) / 1000;
  const roadKm = straightKm * detourFactor;
  return (roadKm / averageSpeedKmh) * 60;
}

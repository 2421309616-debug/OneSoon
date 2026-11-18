import { distanceMeters } from "../geo.js";
import type { DispatchOrder, DispatchTuning, DriverCandidate } from "../types.js";

/** 一个司机被排除的原因，用于运营日志 */
export type ExclusionReason =
  | "already-offered"
  | "too-many-orders"
  | "stale-location"
  | "out-of-range";

export interface FilteredOut {
  driver: DriverCandidate;
  reason: ExclusionReason;
}

export interface FilterResult {
  qualified: DriverCandidate[];
  excluded: FilteredOut[];
}

/**
 * 第一层 · 资格过滤。
 *
 * 只回答「能不能」，不打分。只要有一条硬条件不满足就直接排除：
 * 1. 这一单没推过该司机
 * 2. 手上订单未超上限
 * 3. 位置新鲜（超过 TTL 的位置是旧的，算出来的距离没有意义）
 * 4. 直线距离没超过粗筛上限（默认 10 公里）
 *
 * 第 4 条是「粗筛」不是「分档」：它只排除明显不可能的司机（跨镇、跨区），
 * 真正的远近由第二层按 ETA 分档决定。将来接高德 API 时，这一层能挡掉大部分调用。
 *
 * 顺序有讲究：先做便宜的判断（集合查找、计数），再做贵的（距离计算）。
 */
export function filterCandidates(
  candidates: readonly DriverCandidate[],
  order: DispatchOrder,
  tuning: DispatchTuning,
  now: number,
): FilterResult {
  const offered = new Set(order.offeredDriverIds);
  const qualified: DriverCandidate[] = [];
  const excluded: FilteredOut[] = [];

  for (const driver of candidates) {
    if (offered.has(driver.id)) {
      excluded.push({ driver, reason: "already-offered" });
      continue;
    }

    if (driver.activeOrderCount >= tuning.maxActiveOrders) {
      excluded.push({ driver, reason: "too-many-orders" });
      continue;
    }

    if (now - driver.locationUpdatedAt > tuning.locationTtlMs) {
      excluded.push({ driver, reason: "stale-location" });
      continue;
    }

    if (distanceMeters(driver.location, order.pickup) > tuning.maxDistanceMeters) {
      excluded.push({ driver, reason: "out-of-range" });
      continue;
    }

    qualified.push(driver);
  }

  return { qualified, excluded };
}

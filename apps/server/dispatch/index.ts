import { bucketByEta } from "./funnel/bucket.js";
import { filterCandidates } from "./funnel/filter.js";
import { rankInBucket } from "./funnel/rank.js";
import type { Bucket, DispatchInput, DispatchResult, DispatchTuning } from "./types.js";
import { DEFAULT_TUNING } from "./types.js";

export * from "./types.js";
export { distanceMeters, etaMinutes } from "./geo.js";
export { filterCandidates } from "./funnel/filter.js";
export type { ExclusionReason, FilteredOut, FilterResult } from "./funnel/filter.js";
export { bucketByEta } from "./funnel/bucket.js";
export type { BucketedDriver, BucketResult } from "./funnel/bucket.js";
export { rankInBucket } from "./funnel/rank.js";

const BUCKET_ORDER: readonly Bucket[] = ["A", "B", "C", "D"];

/**
 * 跑一次派单尝试，返回一个司机（或没有）。
 *
 * 三层漏斗依次回答三个问题，前一层没有通过就到不了下一层：
 * 1. 资格过滤 —— 能不能
 * 2. 就近分档 —— 谁更近
 * 3. 同档排序 —— 一样近时选谁
 *
 * **一次只推一个**：一次调用只返回一位司机。
 * 换人节奏由调用方控制（满 30 秒推下一位，推送 60 秒过期），
 * 到点后这个司机已经进了 `offeredDriverIds`，自然轮到下一个。
 *
 * 注意：换人周期（30 秒）比推送有效期（60 秒）短，所以**调用方手上有重叠**
 * ——同一单可能同时挂在两位司机手上。谁先接谁得，靠 `OrdersService.accept()`
 * 的事务 + 行锁兜住，不是算法这边的责任。
 *
 * 纯函数：不读数据库、不发请求、不看时间（`now` 和 `etaMinutes` 都由调用方传入）。
 */
export function dispatch(
  input: DispatchInput,
  tuning: DispatchTuning = DEFAULT_TUNING,
): DispatchResult {
  const { order, candidates, etaMinutes, now } = input;

  // 第一层 · 资格过滤
  const { qualified } = filterCandidates(candidates, order, tuning, now);

  if (qualified.length === 0) {
    // 区分「本来就没司机」和「都推过了」—— 运营看日志时这是两件完全不同的事。
    // 先看位置过期：全城司机都失联时，报「都推过了」会误导排查方向。
    const allStale =
      candidates.length > 0 &&
      candidates.every((driver) => now - driver.locationUpdatedAt > tuning.locationTtlMs);

    if (allStale) {
      return { ok: false, reason: "stale-location", qualifiedCount: 0 };
    }

    const allOffered =
      candidates.length > 0 &&
      candidates.every((driver) => order.offeredDriverIds.includes(driver.id));

    return {
      ok: false,
      reason: allOffered ? "all-excluded" : "no-candidate",
      qualifiedCount: 0,
    };
  }

  // 第二层 · 就近分档
  const { buckets, topBucket } = bucketByEta(qualified, etaMinutes, tuning);

  if (!topBucket) {
    return { ok: false, reason: "no-candidate", qualifiedCount: qualified.length };
  }

  // 第三层 · 同档排序
  // 从最靠前的档开始；本档为空才看下一档 —— 不会为了凑人数跳过已有候选。
  for (const bucket of BUCKET_ORDER) {
    const inBucket = buckets[bucket];
    if (inBucket.length === 0) continue;

    const picked = rankInBucket(inBucket, tuning.sameBucketToleranceMinutes);
    if (picked) {
      return { ok: true, picked, bucket, qualifiedCount: qualified.length };
    }
  }

  return { ok: false, reason: "no-candidate", qualifiedCount: qualified.length };
}

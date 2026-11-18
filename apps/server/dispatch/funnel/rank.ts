import type { BucketedDriver } from "./bucket.js";
import type { DriverCandidate } from "../types.js";

/**
 * 第三层 · 同档排序。
 *
 * 从最靠前的档里选一个司机。选法分两步：
 *
 * 1. **先看接驾时间**：找最快的那个，和它差 < `toleranceMinutes` 的算「一样快」。
 *    差 30 秒对乘客没区别，差 2 分钟能感觉到 —— 1 分钟是两者之间的分界。
 * 2. **一样快时看服务分**：服务分降序。这是滴滴的原话「若距离相同，则会派给口碑值分数更高的司机」。
 * 3. **服务分也相同时看今日接单数**：升序。今天跑得少的优先，保证公平。
 *
 * 为什么不是加权随机：滴滴的口碑值是 tiebreak，不是权重。随机抽会出现
 * 「3 公里外的 5.0 分司机压过 200 米的 4.8 分司机」，乘客等更久。
 *
 * @param bucket 同一档位内的司机，已按 ETA 升序
 * @param toleranceMinutes 同档容忍度（分钟）
 * @returns 选中的司机；该档为空时返回 null
 */
export function rankInBucket(
  bucket: readonly BucketedDriver[],
  toleranceMinutes: number,
): DriverCandidate | null {
  if (bucket.length === 0) return null;

  // 1. 找最快的那个
  const fastest = bucket[0]?.etaMinutes ?? 0;

  // 2. 同档：和最快差 < 容忍度
  const same = bucket.filter((item) => item.etaMinutes - fastest < toleranceMinutes);
  if (same.length === 0) return bucket[0]?.driver ?? null;

  // 3. 服务分降序 → 今日接单数升序
  //    用 sort 而不是 reduce 取最小：人数少（同档通常 1~3 个），可读性优先
  const sorted = [...same].sort((a, b) => {
    if (b.driver.serviceScore !== a.driver.serviceScore) {
      return b.driver.serviceScore - a.driver.serviceScore;
    }
    return a.driver.todayOrderCount - b.driver.todayOrderCount;
  });

  return sorted[0]?.driver ?? null;
}

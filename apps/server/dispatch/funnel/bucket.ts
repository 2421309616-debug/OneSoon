import type { Bucket, DispatchTuning, DriverCandidate } from "../types.js";

export interface BucketedDriver {
  driver: DriverCandidate;
  /** 预估到达时间（分钟） */
  etaMinutes: number;
  bucket: Bucket;
}

export interface BucketResult {
  /** 按 ETA 升序排好 */
  all: BucketedDriver[];
  /** 按档位分组，每组内部按 ETA 升序 */
  buckets: Record<Bucket, BucketedDriver[]>;
  /** 最靠前的非空档，一个都没有时为 null */
  topBucket: Bucket | null;
}

const BUCKET_ORDER: readonly Bucket[] = ["A", "B", "C", "D"];

/**
 * 第二层 · 就近分档。
 *
 * 按 ETA 分档，越快到的一档越优先，前一档没人了才看下一档。
 *
 * ETA 从 `etaMinutes` 表里读，不在这里算 —— 算法保持纯函数，
 * 将来换成高德真实路面距离，只换调用方。
 *
 * 之所以用 ETA 而不是直线距离：距离本身没有意义，换算成「乘客要等多久」才有意义。
 * 之所以用绝对阈值而不是「本波内的相对排名」：乘客关心的是「多久能到」，
 * 同样快的人不该因为落在哪一波就成了两种待遇。
 */
export function bucketByEta(
  qualified: readonly DriverCandidate[],
  etaMinutes: ReadonlyMap<string, number>,
  tuning: DispatchTuning,
): BucketResult {
  const all: BucketedDriver[] = qualified.map((driver) => {
    // 调用方漏算某个司机时按「最远」处理，而不是抛错 —— 派单不能因为一个司机挂掉
    const eta = etaMinutes.get(driver.id) ?? Number.POSITIVE_INFINITY;
    return { driver, etaMinutes: eta, bucket: toBucket(eta, tuning) };
  });

  all.sort((a, b) => a.etaMinutes - b.etaMinutes);

  const buckets: Record<Bucket, BucketedDriver[]> = { A: [], B: [], C: [], D: [] };
  for (const item of all) {
    buckets[item.bucket].push(item);
  }

  const topBucket = BUCKET_ORDER.find((bucket) => buckets[bucket].length > 0) ?? null;

  return { all, buckets, topBucket };
}

function toBucket(eta: number, tuning: DispatchTuning): Bucket {
  const { a, b, c } = tuning.bucketThresholdsMinutes;
  if (eta <= a) return "A";
  if (eta <= b) return "B";
  if (eta <= c) return "C";
  return "D";
}

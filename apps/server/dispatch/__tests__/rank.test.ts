import { describe, expect, it } from "vitest";
import type { BucketedDriver } from "../funnel/bucket.js";
import { rankInBucket } from "../funnel/rank.js";
import type { DriverCandidate } from "../types.js";

function driver(
  id: string,
  serviceScore: number,
  todayOrderCount = 0,
): DriverCandidate {
  return {
    id,
    location: [107.731056, 29.863785],
    locationUpdatedAt: 0,
    serviceScore,
    activeOrderCount: 0,
    todayOrderCount,
  };
}

function item(
  id: string,
  etaMinutes: number,
  serviceScore: number,
  todayOrderCount = 0,
): BucketedDriver {
  return {
    driver: driver(id, serviceScore, todayOrderCount),
    etaMinutes,
    bucket: "A",
  };
}

describe("rankInBucket · 第三层同档排序", () => {
  it("空档 → null", () => {
    expect(rankInBucket([], 1)).toBeNull();
  });

  it("只有一个司机 → 直接返回", () => {
    const picked = rankInBucket([item("D1", 2, 4.8)], 1);
    expect(picked?.id).toBe("D1");
  });

  it("两个司机差 < 1 分钟 → 服务分高的胜出", () => {
    // 1.0 和 1.5 差 0.5 < 1 → 同档，4.9 压过 4.8
    const picked = rankInBucket([item("D1", 1.0, 4.8), item("D2", 1.5, 4.9)], 1);
    expect(picked?.id).toBe("D2");
  });

  it("两个司机差 ≥ 1 分钟 → 快的胜出（服务分低也赢）", () => {
    // 1.0 和 2.0 差 1.0，不 < 1 → 不同档，1.0 直接出线
    const picked = rankInBucket([item("D1", 1.0, 4.0), item("D2", 2.0, 5.0)], 1);
    expect(picked?.id).toBe("D1");
  });

  it("服务分也相同 → 今日接单数少的优先", () => {
    const picked = rankInBucket(
      [item("D1", 1.0, 4.8, 5), item("D2", 1.5, 4.8, 2)],
      1,
    );
    expect(picked?.id).toBe("D2");
  });

  it("三人：最快 + 两个同档 → 在三人里比服务分", () => {
    // 1.0 / 1.5 / 1.9 都和 1.0 差 < 1 → 同档
    const picked = rankInBucket(
      [item("D1", 1.0, 4.5), item("D2", 1.5, 4.9), item("D3", 1.9, 4.7)],
      1,
    );
    expect(picked?.id).toBe("D2");
  });

  it("三人：只有前两人同档 → 第三人不参与比较", () => {
    // 1.0 / 1.5 差 0.5 同档；2.9 差 1.9 出局
    const picked = rankInBucket(
      [item("D1", 1.0, 4.5), item("D2", 1.5, 4.9), item("D3", 2.9, 5.0)],
      1,
    );
    expect(picked?.id).toBe("D2");
  });

  it("容忍度可调 —— 调成 0.4 后 1.0 和 1.5 不再同档", () => {
    const picked = rankInBucket([item("D1", 1.0, 4.0), item("D2", 1.5, 5.0)], 0.4);
    expect(picked?.id).toBe("D1");
  });

  it("容忍度调大 —— 1.0 和 1.9 也能同档", () => {
    const picked = rankInBucket([item("D1", 1.0, 4.0), item("D2", 1.9, 5.0)], 1.5);
    expect(picked?.id).toBe("D2");
  });

  it("不修改入参", () => {
    const bucket = [item("D1", 1.0, 4.8), item("D2", 1.5, 4.9)];
    const snapshot = bucket.map((d) => d.driver.id);

    rankInBucket(bucket, 1);

    expect(bucket.map((d) => d.driver.id)).toEqual(snapshot);
  });
});

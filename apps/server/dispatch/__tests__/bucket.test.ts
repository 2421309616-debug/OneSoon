import { describe, expect, it } from "vitest";
import { bucketByEta } from "../funnel/bucket.js";
import type { DriverCandidate } from "../types.js";
import { DEFAULT_TUNING } from "../types.js";

function driver(id: string): DriverCandidate {
  return {
    id,
    location: [107.731056, 29.863785],
    locationUpdatedAt: 0,
    serviceScore: 4.8,
    activeOrderCount: 0,
    todayOrderCount: 0,
  };
}

function etaMap(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries));
}

describe("bucketByEta · 第二层就近分档", () => {
  it("按 ETA 分档：A≤3 / B≤6 / C≤12 / D>12", () => {
    const drivers = [driver("D1"), driver("D2"), driver("D3"), driver("D4")];
    const { buckets } = bucketByEta(
      drivers,
      etaMap({ D1: 2.9, D2: 5.9, D3: 11.9, D4: 12.1 }),
      DEFAULT_TUNING,
    );

    expect(buckets.A.map((d) => d.driver.id)).toEqual(["D1"]);
    expect(buckets.B.map((d) => d.driver.id)).toEqual(["D2"]);
    expect(buckets.C.map((d) => d.driver.id)).toEqual(["D3"]);
    expect(buckets.D.map((d) => d.driver.id)).toEqual(["D4"]);
  });

  it("边界包含：3 / 6 / 12 分钟分别落在 A / B / C", () => {
    const drivers = [driver("D1"), driver("D2"), driver("D3")];
    const { buckets } = bucketByEta(drivers, etaMap({ D1: 3, D2: 6, D3: 12 }), DEFAULT_TUNING);

    expect(buckets.A.map((d) => d.driver.id)).toEqual(["D1"]);
    expect(buckets.B.map((d) => d.driver.id)).toEqual(["D2"]);
    expect(buckets.C.map((d) => d.driver.id)).toEqual(["D3"]);
  });

  it("all 按 ETA 升序", () => {
    const drivers = [driver("D1"), driver("D2"), driver("D3")];
    const { all } = bucketByEta(drivers, etaMap({ D1: 8, D2: 2, D3: 5 }), DEFAULT_TUNING);

    expect(all.map((d) => d.driver.id)).toEqual(["D2", "D3", "D1"]);
  });

  it("组内仍按 ETA 升序", () => {
    const drivers = [driver("D1"), driver("D2"), driver("D3")];
    const { buckets } = bucketByEta(drivers, etaMap({ D1: 2.5, D2: 1.0, D3: 2.0 }), DEFAULT_TUNING);

    expect(buckets.A.map((d) => d.driver.id)).toEqual(["D2", "D3", "D1"]);
  });

  it("topBucket 取最靠前的非空档", () => {
    const drivers = [driver("D1"), driver("D2")];
    const { topBucket } = bucketByEta(drivers, etaMap({ D1: 8, D2: 5 }), DEFAULT_TUNING);

    expect(topBucket).toBe("B");
  });

  it("A 档为空时 topBucket 跳到 B", () => {
    const drivers = [driver("D1")];
    const { topBucket } = bucketByEta(drivers, etaMap({ D1: 4 }), DEFAULT_TUNING);

    expect(topBucket).toBe("B");
  });

  it("空候选 → topBucket 为 null", () => {
    const { all, topBucket } = bucketByEta([], new Map(), DEFAULT_TUNING);

    expect(all).toHaveLength(0);
    expect(topBucket).toBeNull();
  });

  it("ETA 表里没有的司机按最远处理（进 D 档）", () => {
    const { buckets } = bucketByEta([driver("D1")], new Map(), DEFAULT_TUNING);

    expect(buckets.D.map((d) => d.driver.id)).toEqual(["D1"]);
  });

  it("阈值可调 —— 改小后原本 A 档的进 B 档", () => {
    const strict = {
      ...DEFAULT_TUNING,
      bucketThresholdsMinutes: { a: 1, b: 2, c: 3 },
    };
    const { buckets } = bucketByEta([driver("D1")], etaMap({ D1: 2.5 }), strict);

    expect(buckets.A).toHaveLength(0);
    expect(buckets.B).toHaveLength(0);
    expect(buckets.C.map((d) => d.driver.id)).toEqual(["D1"]);
  });
});

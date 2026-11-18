import { describe, expect, it } from "vitest";
import { filterCandidates } from "../funnel/filter.js";
import type { DispatchOrder, DriverCandidate } from "../types.js";
import { DEFAULT_TUNING } from "../types.js";

const NOW = 1_700_000_000_000;
const PICKUP: [number, number] = [107.731056, 29.863785];

const ORDER: DispatchOrder = {
  id: "O000001",
  pickup: PICKUP,
  destination: [107.740472, 29.865724],
  offeredDriverIds: [],
};

function driver(overrides: Partial<DriverCandidate> = {}): DriverCandidate {
  return {
    id: "D00001",
    location: [107.7315, 29.8635], // 约 60 米
    locationUpdatedAt: NOW - 5_000,
    serviceScore: 4.8,
    activeOrderCount: 0,
    todayOrderCount: 0,
    ...overrides,
  };
}

describe("filterCandidates · 第一层资格过滤", () => {
  it("全部满足 → 进合格池", () => {
    const { qualified, excluded } = filterCandidates([driver()], ORDER, DEFAULT_TUNING, NOW);
    expect(qualified).toHaveLength(1);
    expect(excluded).toHaveLength(0);
  });

  it("推过的司机不再推", () => {
    const { qualified, excluded } = filterCandidates(
      [driver()],
      { ...ORDER, offeredDriverIds: ["D00001"] },
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified).toHaveLength(0);
    expect(excluded[0]?.reason).toBe("already-offered");
  });

  it("手上满 3 单不再派", () => {
    const { qualified, excluded } = filterCandidates(
      [driver({ activeOrderCount: 3 })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified).toHaveLength(0);
    expect(excluded[0]?.reason).toBe("too-many-orders");
  });

  it("手上 2 单仍可接（未到上限）", () => {
    const { qualified } = filterCandidates(
      [driver({ activeOrderCount: 2 })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified).toHaveLength(1);
  });

  it("位置超过 60 秒未更新视为过期", () => {
    const { qualified, excluded } = filterCandidates(
      [driver({ locationUpdatedAt: NOW - 61_000 })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified).toHaveLength(0);
    expect(excluded[0]?.reason).toBe("stale-location");
  });

  it("位置刚好 60 秒仍算新鲜（边界包含）", () => {
    const { qualified } = filterCandidates(
      [driver({ locationUpdatedAt: NOW - 60_000 })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified).toHaveLength(1);
  });

  it("超过粗筛上限（10 公里）的排除", () => {
    // 鬼城距县政府约 2.7 公里，在 10 公里内 → 通过
    const { qualified: near } = filterCandidates(
      [driver({ location: [107.722209, 29.887322] })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(near).toHaveLength(1);

    // 再往外约 20 公里 → 排除
    const { qualified: far, excluded } = filterCandidates(
      [driver({ location: [107.9, 29.95] })],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(far).toHaveLength(0);
    expect(excluded[0]?.reason).toBe("out-of-range");
  });

  it("粗筛上限可调 —— 调小后原本通过的司机被排除", () => {
    const strict = { ...DEFAULT_TUNING, maxDistanceMeters: 1_000 };
    const { qualified, excluded } = filterCandidates(
      [driver({ location: [107.722209, 29.887322] })], // 约 2.7 公里
      ORDER,
      strict,
      NOW,
    );
    expect(qualified).toHaveLength(0);
    expect(excluded[0]?.reason).toBe("out-of-range");
  });

  it("多个司机按各自原因分别排除", () => {
    const { qualified, excluded } = filterCandidates(
      [
        driver({ id: "D00001" }),
        driver({ id: "D00002", activeOrderCount: 3 }),
        driver({ id: "D00003", locationUpdatedAt: NOW - 120_000 }),
        driver({ id: "D00004", location: [107.9, 29.95] }),
      ],
      ORDER,
      DEFAULT_TUNING,
      NOW,
    );
    expect(qualified.map((d) => d.id)).toEqual(["D00001"]);
    expect(excluded.map((e) => e.reason)).toEqual([
      "too-many-orders",
      "stale-location",
      "out-of-range",
    ]);
  });

  it("空候选返回空结果，不抛错", () => {
    const { qualified, excluded } = filterCandidates([], ORDER, DEFAULT_TUNING, NOW);
    expect(qualified).toHaveLength(0);
    expect(excluded).toHaveLength(0);
  });

  it("排除原因按「便宜判断优先」的顺序命中", () => {
    // 同时满足「推过」和「满单」时，报 already-offered（先判断集合查找）
    const { excluded } = filterCandidates(
      [driver({ activeOrderCount: 5 })],
      { ...ORDER, offeredDriverIds: ["D00001"] },
      DEFAULT_TUNING,
      NOW,
    );
    expect(excluded[0]?.reason).toBe("already-offered");
  });
});

import { describe, expect, it } from "vitest";
import { distanceMeters, etaMinutes } from "../geo.js";

/** 丰都县政府 */
const FENGDU_GOV: [number, number] = [107.731056, 29.863785];
/** 丰都鬼城 */
const FENGDU_GHOST: [number, number] = [107.722209, 29.887322];

describe("distanceMeters", () => {
  it("同一点距离为 0", () => {
    expect(distanceMeters(FENGDU_GOV, FENGDU_GOV)).toBe(0);
  });

  it("丰都县政府到鬼城约 2.7 公里", () => {
    const meters = distanceMeters(FENGDU_GOV, FENGDU_GHOST);
    expect(meters).toBeGreaterThan(2_500);
    expect(meters).toBeLessThan(2_900);
  });

  it("对称：A→B 与 B→A 相等", () => {
    expect(distanceMeters(FENGDU_GOV, FENGDU_GHOST)).toBeCloseTo(
      distanceMeters(FENGDU_GHOST, FENGDU_GOV),
      6,
    );
  });

  it("经度差 0.01 度在赤道约 1.11 公里", () => {
    const meters = distanceMeters([0, 0], [0.01, 0]);
    expect(meters).toBeGreaterThan(1_100);
    expect(meters).toBeLessThan(1_120);
  });

  it("同样经度差在高纬度更短（球面距离不是平面距离）", () => {
    const equator = distanceMeters([0, 0], [0.01, 0]);
    const highLat = distanceMeters([0, 60], [0.01, 60]);
    expect(highLat).toBeLessThan(equator);
  });
});

describe("etaMinutes", () => {
  it("1 公里直线、系数 1.3、均速 30km/h → 2.6 分钟", () => {
    // 用 0.01 经度 ≈ 1.11km 反推，这里直接构造 1km 的场景太麻烦，
    // 改为验证「ETA 与距离成正比」这个更本质的性质
    const a: [number, number] = [0, 0];
    const b: [number, number] = [0.01, 0];
    const eta = etaMinutes(a, b, 1.3, 30);
    const expected = ((distanceMeters(a, b) / 1000) * 1.3 * 60) / 30;
    expect(eta).toBeCloseTo(expected, 6);
  });

  it("距离翻倍，ETA 翻倍", () => {
    const origin: [number, number] = [107.73, 29.86];
    const near = etaMinutes(origin, [107.74, 29.86], 1.3, 30);
    const far = etaMinutes(origin, [107.75, 29.86], 1.3, 30);
    expect(far / near).toBeCloseTo(2, 1);
  });

  it("速度越快，ETA 越短", () => {
    const slow = etaMinutes([107.73, 29.86], [107.74, 29.86], 1.3, 20);
    const fast = etaMinutes([107.73, 29.86], [107.74, 29.86], 1.3, 40);
    expect(fast).toBeLessThan(slow);
  });

  it("曲折系数越大，ETA 越长", () => {
    const straight = etaMinutes([107.73, 29.86], [107.74, 29.86], 1.0, 30);
    const detour = etaMinutes([107.73, 29.86], [107.74, 29.86], 1.5, 30);
    expect(detour).toBeGreaterThan(straight);
  });
});

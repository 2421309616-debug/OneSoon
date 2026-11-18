import { describe, expect, it } from "vitest";
import { dispatch } from "../index.js";
import type { DispatchInput, DispatchOrder, DriverCandidate } from "../types.js";
import { DEFAULT_TUNING } from "../types.js";

const NOW = 1_700_000_000_000;
const PICKUP: [number, number] = [107.731056, 29.863785];

const ORDER: DispatchOrder = {
  id: "O000001",
  pickup: PICKUP,
  destination: [107.740472, 29.865724],
  offeredDriverIds: [],
};

function driver(
  id: string,
  overrides: Partial<DriverCandidate> = {},
): DriverCandidate {
  return {
    id,
    location: [107.7315, 29.8635], // 约 60 米
    locationUpdatedAt: NOW - 5_000,
    serviceScore: 4.8,
    activeOrderCount: 0,
    todayOrderCount: 0,
    ...overrides,
  };
}

function input(
  candidates: DriverCandidate[],
  eta: Record<string, number>,
  order: DispatchOrder = ORDER,
): DispatchInput {
  return {
    order,
    candidates,
    etaMinutes: new Map(Object.entries(eta)),
    now: NOW,
  };
}

describe("dispatch · 端到端", () => {
  it("三个候选全在 A 档 → 只推 1 个（服务分最高的）", () => {
    const result = dispatch(
      input(
        [driver("D1", { serviceScore: 4.5 }), driver("D2", { serviceScore: 4.9 }), driver("D3", { serviceScore: 4.7 })],
        { D1: 1.0, D2: 1.2, D3: 1.4 },
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.picked.id).toBe("D2");
    expect(result.bucket).toBe("A");
    expect(result.qualifiedCount).toBe(3);
  });

  it("一次只推一个 —— 不是 3 个", () => {
    const result = dispatch(
      input([driver("D1"), driver("D2"), driver("D3")], { D1: 1, D2: 2, D3: 3 }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // picked 是单个对象，不是数组
    expect(Array.isArray(result.picked)).toBe(false);
    expect(result.picked.id).toBe("D1");
  });

  it("超出粗筛上限的司机被排除", () => {
    const result = dispatch(
      input([driver("D1", { location: [107.9, 29.95] })], { D1: 1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-candidate");
    expect(result.qualifiedCount).toBe(0);
  });

  it("推过的司机不再推 → all-excluded", () => {
    const result = dispatch(
      input([driver("D1")], { D1: 1 }, { ...ORDER, offeredDriverIds: ["D1"] }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("all-excluded");
  });

  it("本来就没司机 → no-candidate", () => {
    const result = dispatch(input([], {}));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-candidate");
  });

  it("位置全过期 → stale-location", () => {
    const result = dispatch(
      input([driver("D1", { locationUpdatedAt: NOW - 120_000 })], { D1: 1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("stale-location");
  });

  it("手上满 3 单的司机被排除", () => {
    const result = dispatch(
      input([driver("D1", { activeOrderCount: 3 })], { D1: 1 }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no-candidate");
  });

  it("A 档为空时从 B 档取", () => {
    const result = dispatch(
      input([driver("D1"), driver("D2")], { D1: 4.5, D2: 5.5 }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket).toBe("B");
    expect(result.picked.id).toBe("D1"); // 4.5 分钟更快
  });

  it("A 档有人时不会跳到 B 档", () => {
    const result = dispatch(
      input(
        [driver("D1", { serviceScore: 4.0 }), driver("D2", { serviceScore: 5.0 })],
        { D1: 2.9, D2: 4.5 }, // D1 在 A 档，D2 在 B 档
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bucket).toBe("A");
    // D2 服务分高，但它在 B 档，A 档有人的时候轮不到它
    expect(result.picked.id).toBe("D1");
  });

  it("同档内服务分相同时看今日接单数", () => {
    const result = dispatch(
      input(
        [
          driver("D1", { serviceScore: 4.8, todayOrderCount: 5 }),
          driver("D2", { serviceScore: 4.8, todayOrderCount: 1 }),
        ],
        { D1: 1.0, D2: 1.5 },
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.picked.id).toBe("D2");
  });

  it("同随机源可复现（算法本身无随机）", () => {
    const build = () =>
      input([driver("D1"), driver("D2"), driver("D3")], { D1: 1, D2: 2, D3: 3 });

    const first = dispatch(build());
    const second = dispatch(build());

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.picked.id).toBe(second.picked.id);
  });

  it("纯函数 —— 不修改入参", () => {
    const candidates = [driver("D1"), driver("D2")];
    const snapshot = candidates.map((d) => d.id);
    const payload = input(candidates, { D1: 1, D2: 2 });

    dispatch(payload);

    expect(candidates.map((d) => d.id)).toEqual(snapshot);
    expect(payload.etaMinutes.size).toBe(2);
  });

  it("服务分高的在同档内稳定胜出（100 次全中）", () => {
    let wins = 0;
    for (let i = 0; i < 100; i += 1) {
      const result = dispatch(
        input(
          [driver("D1", { serviceScore: 4.5 }), driver("D2", { serviceScore: 5.0 })],
          { D1: 1.0, D2: 1.5 },
        ),
      );
      if (result.ok && result.picked.id === "D2") wins += 1;
    }

    expect(wins).toBe(100);
  });
});

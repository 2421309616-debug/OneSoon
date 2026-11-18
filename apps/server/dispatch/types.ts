/**
 * 派单算法库的输入输出类型。
 *
 * 这一层只描述「算法需要什么」和「算法给出什么」，不关心数据从哪来、结果怎么存。
 * 调用方（apps/api 的调度器）负责把数据库里的行转成这里的结构。
 */

/** 经纬度，顺序固定为 [经度, 纬度]（与高德地图一致） */
export type LngLat = [longitude: number, latitude: number];

/** 一个可参与派单的司机 */
export interface DriverCandidate {
  /** 司机 id，对应 driver.id */
  id: string;
  /** 当前坐标 */
  location: LngLat;
  /**
   * 位置更新时间戳（毫秒）。
   * 超过 `locationTtlMs` 未更新的司机不参与派单 —— 位置是旧的，算出来的距离没有意义。
   */
  locationUpdatedAt: number;
  /** 服务分，4.0 ~ 5.0。距离相同（差 < 1 分钟）时它决定谁优先 */
  serviceScore: number;
  /** 手上已有的订单数，达到上限不再派 */
  activeOrderCount: number;
  /**
   * 今日已完成订单数。
   * 服务分也相同时，今天跑得少的优先 —— 这是「公平」的兜底。
   * 从 trip_order 现算，不存字段。
   */
  todayOrderCount: number;
}

/** 待派单的订单（算法只关心起终点和已推过谁） */
export interface DispatchOrder {
  id: string;
  pickup: LngLat;
  destination: LngLat;
  /** 已经给这个订单推送过的司机 id，本单不再推第二次 */
  offeredDriverIds: readonly string[];
}

/** 分档结果 */
export type Bucket = "A" | "B" | "C" | "D";

/** 一次派单尝试的输入 */
export interface DispatchInput {
  order: DispatchOrder;
  candidates: readonly DriverCandidate[];
  /**
   * 每个候选到上车点的预估接驾时间（分钟），key 是 driverId。
   *
   * 由调用方算好传进来，而不是算法内部算 —— 这样将来换成高德真实路面距离，
   * 只换调用方，算法一行不用改。
   */
  etaMinutes: ReadonlyMap<string, number>;
  /** 当前时间戳（毫秒）。传进来而不是内部取 `Date.now()`，单测才能确定 */
  now: number;
}

/** 派单失败的原因 */
export type DispatchFailureReason =
  /** 一个合格司机都没有 */
  | "no-candidate"
  /** 有司机，但这一单都推过了 */
  | "all-excluded"
  /** 所有候选的位置都过期了 */
  | "stale-location";

/** 派单结果 */
export type DispatchResult =
  | {
      ok: true;
      /** 选中的司机。一次只推一个 —— 一个订单同一时刻只在一个司机手上 */
      picked: DriverCandidate;
      /** 命中的档位 */
      bucket: Bucket;
      /** 合格司机数（用于运营日志） */
      qualifiedCount: number;
    }
  | {
      ok: false;
      reason: DispatchFailureReason;
      qualifiedCount: number;
    };

/** 算法可调参数。集中放这里，方便调参和单测覆盖 */
export interface DispatchTuning {
  /** 位置超过这个时长视为过期（毫秒），默认 60 秒 */
  locationTtlMs: number;
  /** 每个司机同时最多持有的订单数，默认 3 */
  maxActiveOrders: number;
  /**
   * 粗筛上限（米），默认 10 公里。
   *
   * 超过这个距离的司机直接排除，连 ETA 都不算 —— 将来接高德 API 时，
   * 这一层能把调用量从 200 次/轮压到 30 次/轮。
   */
  maxDistanceMeters: number;
  /**
   * 同档容忍度（分钟），默认 1。
   *
   * 接驾时间和最快的那个差 < 1 分钟，算「一样快」，此时才比服务分。
   * 差 30 秒对乘客没区别，差 2 分钟能感觉到 —— 1 分钟是两者之间的分界。
   */
  sameBucketToleranceMinutes: number;
  /** 城市道路曲折系数，默认 1.3 */
  detourFactor: number;
  /** 区间均速（km/h），默认 30 */
  averageSpeedKmh: number;
  /** 分档阈值（分钟），默认 A≤3 / B≤6 / C≤12 */
  bucketThresholdsMinutes: {
    a: number;
    b: number;
    c: number;
  };
}

export const DEFAULT_TUNING: DispatchTuning = {
  locationTtlMs: 60_000,
  maxActiveOrders: 3,
  maxDistanceMeters: 10_000,
  sameBucketToleranceMinutes: 1,
  detourFactor: 1.3,
  averageSpeedKmh: 30,
  bucketThresholdsMinutes: {
    a: 3,
    b: 6,
    c: 12,
  },
};

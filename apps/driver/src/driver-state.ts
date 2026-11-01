import { reactive } from "vue";
import type { TripOrder } from "./mock-orders";
import type { DriverSession } from "./driver-session";
import {
  acceptOrder as apiAcceptOrder,
  advanceOrder as apiAdvanceOrder,
  cancelOrder as apiCancelOrder,
  getDriver,
  listDriverOrders,
  listPoolOrders,
  setDriverStatus,
  toDriverSession,
  toTripOrder,
  type ApiOrder,
  type OrderStatus,
} from "./driver-api";

/** 司机自身的状态，不表达行程进度 */
export type DriverPhase = "offline" | "listening" | "offering";

export const PHASE_LABEL: Record<DriverPhase, string> = {
  offline: "未出车",
  listening: "听单中",
  offering: "新订单",
};

/** 订单在行程页里的推进阶段 */
export type TripStage = "toPickup" | "waiting" | "inTrip" | "settling";

export const TRIP_STAGE_ORDER: TripStage[] = ["toPickup", "waiting", "inTrip", "settling"];

export const TRIP_STAGE_LABEL: Record<TripStage, string> = {
  toPickup: "前往乘客上车点",
  waiting: "等待乘客上车",
  inTrip: "前往目的地",
  settling: "行程结算",
};

/** 四步进度条上的短文案 */
export const TRIP_STAGE_SHORT: Record<TripStage, string> = {
  toPickup: "接驾",
  waiting: "等候",
  inTrip: "行程",
  settling: "结算",
};

export const TRIP_STAGE_ACTION: Record<TripStage, string> = {
  toPickup: "我已到达乘客上车点",
  waiting: "乘客已上车，开始行程",
  inTrip: "到达目的地",
  settling: "确认收款",
};

/** 在手订单：已接、未完成，阶段存在订单自己身上 */
export type ActiveOrder = TripOrder & {
  stage: TripStage;
  /** 接单时间戳，列表按它倒序 */
  acceptedAt: number;
};

/** 听单池里的订单；后端没有失效时间，expiresIn 固定为 0 表示「待接单」 */
export type PoolOrder = TripOrder & {
  expiresIn: number;
};

/** 已完成的订单（带完成时间） */
export type CompletedOrder = TripOrder & {
  finishedAt: string;
};

/** 同一时刻最多持有几单，与后端 MAX_ACTIVE_ORDERS 保持一致 */
export const MAX_ACTIVE_ORDERS = 3;

const STATS_KEY = "onesoon-driver-stats";

type StatsSnapshot = {
  date: string;
  onlineSeconds: number;
};

function todayKey() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function nowClock() {
  const now = new Date();
  const h = `${now.getHours()}`.padStart(2, "0");
  const m = `${now.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

function readOnlineSeconds(): number {
  try {
    const raw = uni.getStorageSync(STATS_KEY) as StatsSnapshot | "";
    if (!raw || typeof raw !== "object" || raw.date !== todayKey()) {
      return 0;
    }
    return Number(raw.onlineSeconds) || 0;
  } catch {
    return 0;
  }
}

function writeOnlineSeconds(seconds: number) {
  try {
    uni.setStorageSync(STATS_KEY, {
      date: todayKey(),
      onlineSeconds: seconds,
    } satisfies StatsSnapshot);
  } catch {
    // 本地存储不可用时忽略，内存态仍然有效
  }
}

function toStage(status: OrderStatus): TripStage {
  if (status === "waiting" || status === "inTrip" || status === "settling") {
    return status;
  }
  return "toPickup";
}

function toClock(iso: string | null): string {
  if (!iso) {
    return nowClock();
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return nowClock();
  }
  const h = `${date.getHours()}`.padStart(2, "0");
  const m = `${date.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

function toActiveOrder(order: ApiOrder): ActiveOrder {
  return {
    ...toTripOrder(order),
    stage: toStage(order.status),
    acceptedAt: order.acceptedAt ? new Date(order.acceptedAt).getTime() : Date.now(),
  };
}

function toCompletedOrder(order: ApiOrder): CompletedOrder {
  return {
    ...toTripOrder(order),
    finishedAt: toClock(order.completedAt),
  };
}

export const driverState = reactive({
  driver: null as DriverSession | null,
  phase: "offline" as DriverPhase,
  /** 仅 offering 时有值：正在看详情的那一单推单 */
  order: null as TripOrder | null,
  /** 保留字段，后端订单没有抢单倒计时 */
  offerSeconds: 0,
  /** 听单列表（还没接的单），来自后端订单池 */
  pool: [] as PoolOrder[],
  /** 在手订单（已接、未完成），每单自带阶段 */
  orders: [] as ActiveOrder[],
  /** 已完成的订单，来自后端 */
  completed: [] as CompletedOrder[],
  stats: {
    orders: 0,
    income: 0,
    onlineSeconds: readOnlineSeconds(),
  },
  /** 最近一次请求的错误，页面可以提示用户 */
  lastError: "",
});

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

let statsTimer: ReturnType<typeof setInterval> | null = null;
let poolTimer: ReturnType<typeof setInterval> | null = null;

/** 换算今日完单与收入：两者都由订单明细推导，保证数字永远一致 */
function syncStatsFromCompleted() {
  driverState.stats.orders = driverState.completed.length;
  driverState.stats.income = driverState.completed.reduce((sum, item) => sum + item.fare, 0);
}

/** 从后端拉听单池 */
export async function refreshPool() {
  try {
    const { orders } = await listPoolOrders();
    // 手上已有的单不再出现在待接列表里
    const taken = new Set(driverState.orders.map((item) => item.id));
    driverState.pool = orders
      .filter((order) => !taken.has(order.id))
      .map((order) => ({ ...toTripOrder(order), expiresIn: 0 }));
    driverState.lastError = "";
  } catch (error) {
    driverState.lastError = describeError(error, "听单列表加载失败");
  }
}

/** 从后端拉在手订单与已完成订单 */
export async function refreshOrders() {
  if (!driverState.driver) {
    return;
  }
  try {
    const { active, completed } = await listDriverOrders(driverState.driver.id);
    driverState.orders = active.map(toActiveOrder);
    driverState.completed = completed.map(toCompletedOrder);
    syncStatsFromCompleted();
    driverState.lastError = "";
  } catch (error) {
    driverState.lastError = describeError(error, "订单加载失败");
  }
}

function ensureTimers() {
  if (!statsTimer) {
    statsTimer = setInterval(() => {
      if (driverState.phase === "offline") {
        return;
      }
      driverState.stats.onlineSeconds += 1;
      if (driverState.stats.onlineSeconds % 15 === 0) {
        writeOnlineSeconds(driverState.stats.onlineSeconds);
      }
    }, 1000);
  }
  if (!poolTimer) {
    poolTimer = setInterval(() => {
      if (driverState.phase !== "listening" && driverState.phase !== "offering") {
        return;
      }
      void refreshPool();
    }, 5000);
  }
}

export async function bindDriver(session: DriverSession) {
  driverState.driver = session;
  ensureTimers();
  // 刷新页面后本地不知道司机是否还在出车，以后端状态为准
  try {
    const fresh = await getDriver(session.id);
    driverState.driver = toDriverSession(fresh);
    driverState.phase = fresh.status === "online" ? "listening" : "offline";
  } catch (error) {
    driverState.lastError = describeError(error, "司机状态加载失败");
  }
  await refreshOrders();
  if (driverState.phase !== "offline") {
    await refreshPool();
  }
}

/** 出车：后端置为 online，然后开始听单 */
export async function goOnline(): Promise<boolean> {
  if (driverState.phase !== "offline" || !driverState.driver) {
    return false;
  }
  try {
    await setDriverStatus(driverState.driver.id, "online");
  } catch (error) {
    driverState.lastError = describeError(error, "出车失败，请检查后端是否已启动");
    return false;
  }
  driverState.phase = "listening";
  ensureTimers();
  await refreshPool();
  return true;
}

/** 收车：手上有单时不允许，必须先把它们跑完 */
export async function goOffline(): Promise<boolean> {
  if (hasActiveTrip() || !driverState.driver) {
    return false;
  }
  try {
    await setDriverStatus(driverState.driver.id, "offline");
  } catch (error) {
    driverState.lastError = describeError(error, "收车失败");
    return false;
  }
  driverState.phase = "offline";
  driverState.order = null;
  driverState.offerSeconds = 0;
  driverState.pool = [];
  return true;
}

/** 点开听单列表里的某一单，进入详情 */
export function openOrder(order: TripOrder): boolean {
  if (driverState.phase !== "listening") {
    return false;
  }
  if (driverState.orders.length >= MAX_ACTIVE_ORDERS) {
    return false;
  }
  driverState.order = order;
  driverState.phase = "offering";
  // 后端不设失效时间，这一单会一直留在列表里等司机决定
  driverState.offerSeconds = 0;
  return true;
}

/** 关闭推单详情：订单仍留在听单列表里 */
export function cancelOffer() {
  if (driverState.phase !== "offering") {
    return;
  }
  driverState.order = null;
  driverState.offerSeconds = 0;
  driverState.phase = "listening";
}

/**
 * 接下这一单：后端接单成功后放进在手订单，司机继续留在听单页。
 * 这一单开始走自己的「前往上车点」阶段，不影响其它单。
 */
export async function acceptOffer(): Promise<ActiveOrder | null> {
  if (driverState.phase !== "offering" || !driverState.order || !driverState.driver) {
    return null;
  }
  if (driverState.orders.length >= MAX_ACTIVE_ORDERS) {
    return null;
  }
  const order = driverState.order;
  try {
    const updated = await apiAcceptOrder(driverState.driver.id, order.id);
    const active = toActiveOrder(updated);
    driverState.orders.unshift(active);
    driverState.pool = driverState.pool.filter((item) => item.id !== order.id);
    driverState.order = null;
    driverState.offerSeconds = 0;
    driverState.phase = "listening";
    driverState.lastError = "";
    return active;
  } catch (error) {
    driverState.lastError = describeError(error, "接单失败，可能已被其他司机接走");
    return null;
  }
}

/** 推进某一单的阶段；结算时后端把它标记为已完成，前端刷新明细 */
export async function advanceOrderStage(id: string): Promise<boolean> {
  if (!driverState.driver) {
    return false;
  }
  try {
    const updated = await apiAdvanceOrder(driverState.driver.id, id);
    if (updated.status === "completed") {
      driverState.orders = driverState.orders.filter((item) => item.id !== id);
      await refreshOrders();
      await refreshPool();
      return true;
    }
    const active = findActiveOrder(id);
    if (active) {
      active.stage = toStage(updated.status);
    }
    driverState.lastError = "";
    return true;
  } catch (error) {
    driverState.lastError = describeError(error, "行程推进失败");
    return false;
  }
}

/** 按 id 找在手订单 */
export function findActiveOrder(id: string) {
  return driverState.orders.find((item) => item.id === id);
}

/** 取消某一单：从在手订单里移除，不影响其它单 */
export async function cancelActiveOrder(id: string): Promise<boolean> {
  if (!driverState.driver) {
    return false;
  }
  try {
    await apiCancelOrder(driverState.driver.id, id);
    driverState.orders = driverState.orders.filter((item) => item.id !== id);
    // 后端把它放回了订单池，立刻刷新一次，司机能马上在列表里看到它
    await refreshPool();
    return true;
  } catch (error) {
    driverState.lastError = describeError(error, "取消订单失败");
    return false;
  }
}

export function todayOnlineText() {
  const minutes = Math.floor(driverState.stats.onlineSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}.${Math.floor(m / 6)}`;
}

export function todayIncomeText() {
  return driverState.stats.income.toFixed(2);
}

/** 手上是否有没跑完的单 */
export function hasActiveTrip() {
  return driverState.orders.length > 0;
}

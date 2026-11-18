<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { driverApi, type DispatchOrder } from "@/driver-api";
import { requireDriver } from "@/driver-session";

/** 和派单算法里的 maxActiveOrders 保持一致 */
const MAX_HELD = 3;
const REFRESH_MS = 5_000;

/** 手上已经接着的单（派单策略允许多单并行，最多 3 单） */
const held = ref<DispatchOrder[]>([]);
/** 后台推给我的、还没响应的单（同一订单同一时刻只会出现在一个司机这里） */
const offers = ref<DispatchOrder[]>([]);
const loading = ref(false);
const acceptingId = ref("");
const givingUpId = ref("");
const error = ref("");
let timer: ReturnType<typeof setInterval> | null = null;

function kilometers(meters: number) {
  return (meters / 1000).toFixed(1);
}

function minutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function yuan(cents: number) {
  return (cents / 100).toFixed(0);
}

function scheduledLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

async function loadOrders() {
  const driver = requireDriver();
  if (!driver) return;
  loading.value = true;
  error.value = "";
  try {
    const [active, waiting] = await Promise.all([
      driverApi.listActiveOrders(driver.id),
      driverApi.listWaitingOrders(driver.id),
    ]);
    held.value = active.orders;
    offers.value = waiting.orders;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "订单加载失败";
  } finally {
    loading.value = false;
  }
}

async function accept(offer: DispatchOrder) {
  const driver = requireDriver();
  if (!driver || acceptingId.value) return;
  if (held.value.length >= MAX_HELD) {
    uni.showToast({ title: `最多同时持有 ${MAX_HELD} 单`, icon: "none" });
    return;
  }
  acceptingId.value = offer.id;
  try {
    await driverApi.acceptDispatchOrder(driver.id, offer.id);
    uni.showToast({ title: "接单成功", icon: "none" });
    await loadOrders();
  } catch (cause) {
    uni.showToast({ title: cause instanceof Error ? cause.message : "接单失败", icon: "none" });
    await loadOrders();
  } finally {
    acceptingId.value = "";
  }
}

async function giveUp(order: DispatchOrder) {
  const driver = requireDriver();
  if (!driver || givingUpId.value) return;
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: "放弃这一单",
      content: "订单会回到池子里，重新派给其他司机。乘客还在等你，确定放弃吗？",
      confirmText: "放弃",
      confirmColor: "#d0121a",
      success: ({ confirm }) => resolve(confirm),
      fail: () => resolve(false),
    });
  });
  if (!confirmed) return;
  givingUpId.value = order.id;
  try {
    await driverApi.cancelDispatchOrder(driver.id, order.id);
    uni.showToast({ title: "已放回订单池", icon: "none" });
    await loadOrders();
  } catch (cause) {
    uni.showToast({ title: cause instanceof Error ? cause.message : "操作失败", icon: "none" });
  } finally {
    givingUpId.value = "";
  }
}

function backOnline() { uni.redirectTo({ url: "/pages/online/online" }); }

onMounted(() => {
  void loadOrders();
  timer = setInterval(() => { void loadOrders(); }, REFRESH_MS);
});
onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null; }
});
</script>

<template>
  <view class="driver-page driver-page--scroll">
    <DriverPageHeader title="派单大厅"><template #right><button class="refresh-button" @tap="loadOrders">刷新</button></template></DriverPageHeader>
    <scroll-view class="dispatch-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="dispatch-intro">
          <text class="driver-eyebrow">{{ held.length ? `进行中 ${held.length} 单` : "等待接单" }}</text>
          <text class="driver-title">{{ held.length ? "手上的订单" : "挑选合适的行程" }}</text>
          <text class="driver-muted">{{ held.length ? `最多同时持有 ${MAX_HELD} 单，满了就收不到新推送` : "接单前请确认路线和预估车费" }}</text>
        </view>

        <view v-if="loading && !held.length && !offers.length" class="driver-card driver-empty">正在获取订单…</view>
        <view v-else-if="error" class="driver-card driver-empty">{{ error }}</view>

        <template v-else>
          <!-- 手上的单 -->
          <view v-for="order in held" :key="order.id" class="driver-card offer-card">
            <view class="driver-between">
              <view><text class="driver-tag">已接单</text><text class="offer-id">订单 {{ order.id }}</text></view>
              <view class="offer-fare"><text>预估</text><strong>¥{{ yuan(order.fareCents) }}</strong></view>
            </view>
            <view class="route-item"><view class="route-dot route-dot--pickup">上</view><view class="route-copy"><text class="route-label">上车点</text><text class="route-address">{{ order.pickup.name }}</text></view></view>
            <view class="route-connector" />
            <view class="route-item"><view class="route-dot route-dot--destination">终</view><view class="route-copy"><text class="route-label">目的地 · {{ kilometers(order.distanceMeters) }} km / {{ minutes(order.durationSeconds) }} 分钟</text><text class="route-address">{{ order.destination.name }}</text></view></view>
            <view class="driver-divider" />
            <view class="offer-meta"><text>乘客 {{ order.passengerName }}</text><text v-if="order.scheduledAt">预约 {{ scheduledLabel(order.scheduledAt) }}</text></view>
            <view v-if="order.preferences && (order.preferences.quietRide || order.preferences.smokeFree || order.preferences.trunkNeeded || order.preferences.note)" class="preference-tags">
              <text v-if="order.preferences.quietRide">安静出行</text><text v-if="order.preferences.smokeFree">无烟车辆</text><text v-if="order.preferences.trunkNeeded">需要后备箱</text><text v-if="order.preferences.note">备注：{{ order.preferences.note }}</text>
            </view>
            <view class="offer-actions">
              <button class="driver-secondary" :disabled="givingUpId === order.id" @tap="giveUp(order)">{{ givingUpId === order.id ? "处理中" : "放弃这一单" }}</button>
            </view>
          </view>

          <!-- 推给我的 -->
          <view v-if="held.length" class="dispatch-section">
            <text class="dispatch-section-title">推送给你的订单</text>
            <text class="dispatch-section-note">这些单只推给了少数几位司机，30 秒内不接就会转给下一位；同一单可能别人也收到了，先点先得</text>
          </view>
          <view v-for="offer in offers" :key="offer.id" class="driver-card offer-card">
            <view class="driver-between">
              <view><text class="driver-tag">等待接单</text><text class="offer-id">订单 {{ offer.id }}</text></view>
              <view class="offer-fare"><text>预估</text><strong>¥{{ yuan(offer.fareCents) }}</strong></view>
            </view>
            <view class="route-item"><view class="route-dot route-dot--pickup">上</view><view class="route-copy"><text class="route-label">上车点</text><text class="route-address">{{ offer.pickup.name }}</text></view></view>
            <view class="route-connector" />
            <view class="route-item"><view class="route-dot route-dot--destination">终</view><view class="route-copy"><text class="route-label">目的地 · {{ kilometers(offer.distanceMeters) }} km / {{ minutes(offer.durationSeconds) }} 分钟</text><text class="route-address">{{ offer.destination.name }}</text></view></view>
            <view class="driver-divider" />
            <view class="offer-meta"><text>乘客 {{ offer.passengerName }}</text><text v-if="offer.scheduledAt">预约 {{ scheduledLabel(offer.scheduledAt) }}</text></view>
            <view v-if="offer.preferences && (offer.preferences.quietRide || offer.preferences.smokeFree || offer.preferences.trunkNeeded || offer.preferences.note)" class="preference-tags">
              <text v-if="offer.preferences.quietRide">安静出行</text><text v-if="offer.preferences.smokeFree">无烟车辆</text><text v-if="offer.preferences.trunkNeeded">需要后备箱</text><text v-if="offer.preferences.note">备注：{{ offer.preferences.note }}</text>
            </view>
            <view class="offer-actions">
              <button class="driver-primary" :disabled="acceptingId === offer.id || held.length >= MAX_HELD" @tap="accept(offer)">
                {{ held.length >= MAX_HELD ? `手上已有 ${MAX_HELD} 单` : acceptingId === offer.id ? "接单中" : "接单" }}
              </button>
            </view>
          </view>
          <view v-if="!loading && !offers.length" class="driver-card driver-empty">
            {{ held.length ? "暂时没有新的推送" : "暂时没有等待接单的订单" }}
          </view>
        </template>
      </view>
    </scroll-view>
    <view class="dispatch-bottom"><button class="driver-secondary" @tap="backOnline">返回听单页</button></view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.dispatch-scroll { flex: 1; min-height: 0; }
.dispatch-intro { padding: 2px 2px 14px; }
.offer-card { padding: 15px; }
.preference-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; color: #737987; font-size: 11px; }
.offer-id { display: block; margin-top: 6px; color: #737987; font-size: 11px; }
.offer-fare { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; color: #737987; font-size: 10px; }
.offer-fare strong { color: #c5222d; font-size: 21px; }
.route-item { display: flex; align-items: center; gap: 10px; padding-top: 15px; }
.route-dot { display: grid; place-items: center; flex: none; width: 27px; height: 27px; border-radius: 50%; color: #fff; font-size: 10px; font-weight: 750; }
.route-dot--pickup { background: #d0121a; }
.route-dot--destination { background: #5b6472; }
.route-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.route-label { color: #737987; font-size: 10px; }
.route-address { color: #252630; font-size: 13px; font-weight: 650; line-height: 1.4; }
.route-connector { height: 15px; margin: -2px 0 -2px 13px; border-left: 1px dashed #c7cbd3; }
.offer-meta { color: #737987; font-size: 11px; }
.offer-actions { display: flex; gap: 9px; margin-top: 14px; }
.offer-actions > * { flex: 1; }
.dispatch-section { display: flex; flex-direction: column; gap: 3px; padding: 18px 2px 10px; }
.dispatch-section-title { color: #252630; font-size: 14px; font-weight: 750; }
.dispatch-section-note { color: #737987; font-size: 11px; line-height: 1.4; }
.dispatch-bottom { display: flex; align-items: center; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); background: #292a34; box-sizing: border-box; }
.dispatch-bottom .driver-secondary { width: 100%; height: 56px; min-height: 56px; }
.dispatch-bottom .driver-secondary { border-color: #565965; background: #3c3d47; color: #f1f2f4; }
.refresh-button { margin: 0; padding: 6px 0 6px 10px; border: 0; background: transparent; color: #d0121a; font-size: 13px; }
.refresh-button::after { border: 0; }
</style>

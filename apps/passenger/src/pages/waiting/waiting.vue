<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onUnmounted, ref } from "vue";
import { onReady } from "@dcloudio/uni-app";
import { cancelOrder, fetchCurrentOrder, type TripOrder } from "@/passenger-api";
import { requirePassenger } from "@/passenger-session";
import { mountRouteMap } from "@/route-map";

const order = ref<TripOrder | null>(null);
const loadError = ref("");
const now = ref(Date.now());
const cancelling = ref(false);
const proxy = getCurrentInstance()?.proxy;
let disposed = false;
let destroyMap: (() => void) | undefined;
const timer = window.setInterval(() => {
  now.value = Date.now();
}, 1000);

const waited = computed(() => {
  if (!order.value) return "00:00";
  const seconds = Math.max(0, Math.floor((now.value - Date.parse(order.value.createdAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
const fare = computed(() => (order.value ? (order.value.fareCents / 100).toFixed(0) : "--"));

onReady(async () => {
  const passenger = requirePassenger();
  if (!passenger) return;
  try {
    const { order: current } = await fetchCurrentOrder(passenger.id);
    if (disposed) return;
    if (!current) {
      uni.reLaunch({ url: "/pages/home/home" });
      return;
    }
    order.value = current;
    await nextTick();
    mountMap(current);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "订单加载失败";
  }
});

onUnmounted(() => {
  disposed = true;
  window.clearInterval(timer);
  destroyMap?.();
});

function mountMap(current: TripOrder) {
  const root = proxy?.$el;
  if (!(root instanceof HTMLElement)) return;
  const mapSlot = root.querySelector<HTMLElement>(".map-slot");
  const panel = root.querySelector<HTMLElement>(".panel");
  if (!mapSlot) return;
  mountRouteMap(mapSlot, current.pickup, current.destination, () => [70, (panel?.offsetHeight ?? 0) + 24, 90, 90])
    .then((map) => {
      if (disposed) {
        map.destroy();
        return;
      }
      destroyMap = map.destroy;
    })
    .catch(() => {});
}

function confirmCancel() {
  const passenger = requirePassenger();
  const current = order.value;
  if (!passenger || !current || cancelling.value) return;
  uni.showModal({
    title: "取消订单",
    content: "确定要取消这次叫车吗？",
    confirmText: "取消订单",
    confirmColor: "#D0121A",
    cancelText: "再等等",
    success: async ({ confirm }) => {
      if (!confirm) return;
      cancelling.value = true;
      try {
        await cancelOrder(passenger.id, current.id);
        uni.reLaunch({ url: "/pages/home/home" });
      } catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : "取消失败", icon: "none" });
        cancelling.value = false;
      }
    },
  });
}
</script>

<template>
  <view class="screen app-page app-page--viewport">
    <view class="map-slot" aria-label="路线地图"></view>

    <view class="panel">
      <view v-if="loadError" class="notice">
        <text>{{ loadError }}</text>
      </view>
      <template v-else-if="order">
        <view class="status">
          <view class="status-text">
            <text class="status-title">等待司机接单</text>
            <text class="status-sub">已等待 {{ waited }}</text>
          </view>
          <view class="status-fare">
            <text class="status-fare-label">预估</text>
            <text class="status-fare-price">¥{{ fare }}</text>
          </view>
        </view>

        <view class="trip">
          <view class="trip-row">
            <view class="trip-dot trip-dot--start"></view>
            <text class="trip-name">{{ order.pickup.name }}</text>
          </view>
          <view class="trip-row">
            <view class="trip-dot trip-dot--end"></view>
            <text class="trip-name">{{ order.destination.name }}</text>
          </view>
        </view>

        <button class="cancel" :disabled="cancelling" @tap="confirmCancel">
          {{ cancelling ? "取消中" : "取消订单" }}
        </button>
      </template>
      <view v-else class="notice">
        <text>正在加载订单</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.screen {
  overflow: hidden;
  background: #e8eaed;
}

.map-slot {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: #e8eaed;
}

.map-slot :deep(.amap-logo) {
  top: calc(12px + var(--app-safe-top)) !important;
  right: 8px !important;
  bottom: auto !important;
  left: auto !important;
}

.map-slot :deep(.amap-copyright) {
  top: calc(34px + var(--app-safe-top)) !important;
  right: 8px !important;
  bottom: auto !important;
  left: auto !important;
  text-align: right;
}

.panel {
  position: absolute;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 16px 16px calc(12px + var(--app-safe-bottom));
  border-radius: 16px 16px 0 0;
  background: #ffffff;
  box-shadow: 0 -4px 16px rgba(26, 26, 26, 0.08);
}

.notice {
  padding: 16px;
  border-radius: 12px;
  background: #f2f3f5;
  color: #3c4149;
  font-size: var(--app-font-body);
  text-align: center;
}

.status {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.status-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-title {
  color: #1a1a1a;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}

.status-sub {
  color: #5c6370;
  font-size: var(--app-font-small);
  font-variant-numeric: tabular-nums;
}

.status-fare {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: #1a1a1a;
}

.status-fare-label {
  font-size: 13px;
}

.status-fare-price {
  color: #d0121a;
  font-size: 24px;
  font-weight: 700;
}

.trip {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f2f3f5;
}

.trip-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.trip-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.trip-dot--start {
  background: #1aae5a;
}

.trip-dot--end {
  background: #d0121a;
}

.trip-name {
  min-width: 0;
  overflow: hidden;
  color: #1a1a1a;
  font-size: var(--app-font-body);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cancel {
  height: 48px;
  margin: 14px 0 0;
  border: 1px solid #d9dce1;
  border-radius: 24px;
  background: #ffffff;
  color: #1a1a1a;
  font-size: 16px;
  line-height: 46px;
}

.cancel::after {
  border: 0;
}

.cancel[disabled] {
  background: #ffffff;
  color: #5c6370;
}
</style>

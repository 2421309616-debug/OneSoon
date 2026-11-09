<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onUnmounted, ref } from "vue";
import { onReady } from "@dcloudio/uni-app";
import { apiAsset, cancelOrder, fetchCurrentOrder, type TripOrder } from "@/passenger-api";
import { requirePassenger } from "@/passenger-session";
import { mountRouteMap } from "@/route-map";

const order = ref<TripOrder | null>(null);
const loadError = ref("");
const now = ref(Date.now());
const cancelling = ref(false);
const proxy = getCurrentInstance()?.proxy;
let disposed = false;
let destroyMap: (() => void) | undefined;
let fitRoute = () => {};
const timer = window.setInterval(() => {
  now.value = Date.now();
}, 1000);
const poll = window.setInterval(() => {
  void refresh();
}, 2000);

const plateParts = computed(() => {
  const plate = order.value?.driver?.plate?.replace(/[\s·]/g, "").toUpperCase() ?? "";
  const matched = /^([\u4e00-\u9fa5])([A-Z])([A-Z0-9]{5,6})$/.exec(plate);
  if (!matched) return null;
  return { head: `${matched[1]}${matched[2]}`, tail: matched[3], energy: matched[3].length === 6 };
});

const waited = computed(() => {
  if (!order.value) return "00:00";
  const seconds = Math.max(0, Math.floor((now.value - Date.parse(order.value.createdAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});
const fare = computed(() => (order.value ? (order.value.fareCents / 100).toFixed(0) : "--"));

onReady(() => {
  void refresh();
});

onUnmounted(() => {
  disposed = true;
  window.clearInterval(timer);
  window.clearInterval(poll);
  destroyMap?.();
});

async function refresh() {
  const passenger = requirePassenger();
  if (!passenger || disposed) return;
  try {
    const { order: current } = await fetchCurrentOrder(passenger.id);
    if (disposed) return;
    if (!current) {
      uni.reLaunch({ url: "/pages/home/home" });
      return;
    }
    const first = !order.value;
    order.value = current;
    loadError.value = "";
    await nextTick();
    if (first) mountMap(current);
    else fitRoute();
  } catch (error) {
    if (!order.value) loadError.value = error instanceof Error ? error.message : "订单加载失败";
  }
}

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
      fitRoute = map.fit;
      map.fit();
    })
    .catch(() => {});
}

function goBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
    return;
  }
  uni.reLaunch({ url: "/pages/home/home" });
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

    <button v-if="order?.status === 'accepted'" class="back" aria-label="返回上一级" @tap="goBack">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5 8 12l7 7" />
      </svg>
    </button>

    <view class="panel">
      <view v-if="loadError" class="notice">
        <text>{{ loadError }}</text>
      </view>
      <template v-else-if="order">
        <view class="status">
          <view class="status-text">
            <text class="status-title">{{ order.status === "accepted" ? "司机已接单" : "等待司机接单" }}</text>
            <text v-if="order.status !== 'accepted'" class="status-sub">已等待 {{ waited }}</text>
          </view>
          <view class="status-fare">
            <text class="status-fare-label">预估</text>
            <text class="status-fare-price">¥{{ fare }}</text>
          </view>
        </view>

        <view v-if="order.status === 'accepted' && order.driver" class="driver">
          <view class="driver-person">
            <view class="driver-avatar">
              <image v-if="order.driver.photoUrl" class="driver-avatar-image" :src="apiAsset(order.driver.photoUrl)" mode="aspectFill" alt="司机头像" />
              <image v-else class="driver-avatar-fallback" src="/static/icons/person.svg" mode="aspectFit" alt="" />
            </view>
            <view class="driver-copy">
              <text class="driver-name">{{ order.driver.name || "未填写姓名" }}</text>
              <text class="driver-model">{{ order.driver.vehicleModel || "未填写车型" }}</text>
            </view>
          </view>
          <view class="driver-vehicle">
            <image v-if="order.driver.vehicleImageUrl" class="driver-car" :src="apiAsset(order.driver.vehicleImageUrl)" mode="aspectFit" alt="车型照片" />
            <view class="plate" :class="{ 'plate--energy': plateParts?.energy }">
              <template v-if="plateParts">
                <text class="plate-text">{{ plateParts.head }}</text>
                <view class="plate-dot" />
                <text class="plate-text">{{ plateParts.tail }}</text>
              </template>
              <text v-else class="plate-text">{{ order.driver.plate || "未填写车牌" }}</text>
            </view>
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

.back {
  position: absolute;
  z-index: 6;
  top: calc(12px + var(--app-safe-top));
  left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ffffff;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(26, 26, 26, 0.16);
  line-height: 1;
}

.back::after {
  border: 0;
}

.back svg {
  width: 22px;
  height: 22px;
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

.driver {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.driver-person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.driver-avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 50%;
  background: #eef0f3;
  box-shadow: 0 0 0 2px #ffffff, 0 1px 4px rgba(26, 26, 26, 0.16);
}

.driver-avatar-image {
  width: 48px;
  height: 48px;
}

.driver-avatar-fallback {
  width: 26px;
  height: 26px;
}

.driver-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.driver-name {
  overflow: hidden;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.driver-model {
  color: #8a9099;
  font-size: 12px;
  line-height: 1.3;
}

.driver-vehicle {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  width: 136px;
}

.driver-car {
  width: 136px;
  height: 72px;
  margin-bottom: -10px;
}

.plate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-sizing: border-box;
  min-width: 124px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #1a56c4;
  border-radius: 4px;
  background: linear-gradient(180deg, #4c97ff 0%, #1f6fe5 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
  color: #ffffff;
}

.plate--energy {
  border-color: #128a45;
  background: linear-gradient(180deg, #e7ffe9 0%, #3dce73 55%, #18b857 100%);
  color: #102616;
}

.plate-text {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
}

.plate-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
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

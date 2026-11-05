<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onUnmounted, ref } from "vue";
import { onReady } from "@dcloudio/uni-app";
import { readChosenDestination, readChosenPickup } from "@/chosen-destination";
import { placeOrder } from "@/passenger-api";
import { requirePassenger } from "@/passenger-session";
import { mountRouteMap, type RouteSummary } from "@/route-map";

const FARE = 10;

const pickup = readChosenPickup();
const destination = readChosenDestination();
const summary = ref<RouteSummary | null>(null);
const routeFailed = ref(false);
const ordering = ref(false);
const proxy = getCurrentInstance()?.proxy;
let disposed = false;
let destroyMap: (() => void) | undefined;
let fitRoute = () => {};

const fare = computed(() => (summary.value ? String(FARE) : "--"));
const routes = [
  { id: "recommend", name: "平台推荐" },
  { id: "second", name: "路线二" },
  { id: "fast", name: "更快·附加费多" },
];

onReady(() => {
  if (!requirePassenger() || !pickup || !destination) return;
  nextTick(() => {
    const root = proxy?.$el;
    if (!(root instanceof HTMLElement)) return;
    const mapSlot = root.querySelector<HTMLElement>(".map-slot");
    const panel = root.querySelector<HTMLElement>(".panel");
    if (!mapSlot) return;
    mountRouteMap(mapSlot, pickup, destination, () => [110, (panel?.offsetHeight ?? 0) + 32, 90, 90])
      .then((map) => {
        if (disposed) {
          map.destroy();
          return;
        }
        destroyMap = map.destroy;
        fitRoute = map.fit;
        summary.value = map.summary;
        routeFailed.value = !map.summary;
      })
      .catch(() => {
        routeFailed.value = true;
      });
  });
});

onUnmounted(() => {
  disposed = true;
  destroyMap?.();
});

async function order() {
  const passenger = requirePassenger();
  const route = summary.value;
  if (!passenger || !pickup || !destination || ordering.value) return;
  if (!route) {
    uni.showToast({ title: routeFailed.value ? "路线规划失败，无法下单" : "路线规划中，请稍候", icon: "none" });
    return;
  }
  ordering.value = true;
  try {
    await placeOrder(passenger.id, {
      pickup,
      destination,
      distanceMeters: Math.max(1, Math.round(route.distance)),
      durationSeconds: Math.max(1, Math.round(route.duration)),
    });
    uni.reLaunch({ url: "/pages/waiting/waiting" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
    ordering.value = false;
  }
}

function goBack() {
  uni.navigateBack({
    fail() {
      uni.reLaunch({ url: "/pages/home/home" });
    },
  });
}

function comingSoon() {
  uni.showToast({ title: "功能开发中", icon: "none" });
}
</script>

<template>
  <view class="screen app-page app-page--viewport">
    <view class="map-slot" aria-label="路线地图"></view>

    <button class="back" aria-label="返回" @tap="goBack">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5 8 12l7 7" />
      </svg>
    </button>

    <view class="dock">
      <view class="tools">
        <button class="tool tool--round" aria-label="安全中心" @tap="comingSoon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
            <path d="m9 12 2 2 4-4" stroke-linecap="round" />
          </svg>
        </button>
        <view class="tool-column">
          <button class="tool" aria-label="显示全程" @tap="fitRoute()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
          <button class="tool" @tap="comingSoon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="11" r="7" />
              <path d="M12 8v6M9 11h6" />
            </svg>
            <text class="tool-label">途经点</text>
          </button>
          <button class="tool" @tap="comingSoon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m7 12 5-5 5 5M7 18l5-5 5 5" />
            </svg>
            <text class="tool-label">收起</text>
          </button>
        </view>
      </view>

      <view class="panel">
        <view v-if="!pickup || !destination" class="notice">
          <text>{{ pickup ? "请先选择目的地" : "请先返回首页选择上车点" }}</text>
        </view>
        <view v-else class="routes">
          <view class="routes-head">
            <svg class="routes-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20V5M6 11l6-6 6 6" />
            </svg>
            <text class="routes-title">路线选择</text>
            <text v-if="routeFailed" class="routes-error">路线规划失败</text>
          </view>
          <view class="route-tabs">
            <view
              v-for="(route, index) in routes"
              :key="route.id"
              class="route-tab"
              :class="{ 'is-active': index === 0 }"
              role="button"
              @tap="index === 0 ? undefined : comingSoon()"
            >
              <text class="route-name">{{ route.name }}</text>
              <svg class="route-star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">
                <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
              </svg>
            </view>
          </view>
        </view>

        <view class="extras">
          <view class="extra" role="button" @tap="comingSoon">
            <text>帮人叫车</text>
            <text class="extra-arrow">›</text>
          </view>
          <view class="extra" role="button" @tap="comingSoon">
            <text>偏好设置</text>
            <text class="extra-arrow">›</text>
          </view>
        </view>

        <view class="order-bar">
          <view class="reserve" role="button" @tap="comingSoon">
            <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 15v-3l2.2-5A2 2 0 0 1 7 6h8a2 2 0 0 1 1.8 1L19 12" />
              <path d="M3 15h9M5 15v2M3 12h11" />
              <circle cx="20" cy="16" r="5" />
              <path d="M20 13.5V16l1.6 1.2" />
            </svg>
            <text class="reserve-label">预约</text>
          </view>
          <view class="order-pill">
            <view class="estimate">
              <text class="estimate-label">预估</text>
              <text class="estimate-price">¥{{ fare }}</text>
            </view>
            <button class="order-button" :disabled="ordering" @tap="order">{{ ordering ? "下单中" : "立即打车" }}</button>
          </view>
        </view>
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

button {
  margin: 0;
  padding: 0;
  border: 0;
  line-height: 1;
}

button::after {
  border: 0;
}

svg {
  display: block;
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
  border-radius: 50%;
  background: #ffffff;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(26, 26, 26, 0.16);
}

.back svg {
  width: 22px;
  height: 22px;
}

.dock {
  position: absolute;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  pointer-events: none;
}

.tools {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 12px 12px;
}

.tool-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 44px;
  min-height: 44px;
  padding: 6px 0;
  border-radius: 10px;
  background: #ffffff;
  color: #1a1a1a;
  box-shadow: 0 2px 8px rgba(26, 26, 26, 0.14);
  pointer-events: auto;
}

.tool--round {
  border-radius: 50%;
  color: #3c4149;
}

.tool svg {
  width: 22px;
  height: 22px;
}

.tool-label {
  font-size: 10px;
  line-height: 1.2;
}

.panel {
  border-radius: 16px 16px 0 0;
  background: #ffffff;
  box-shadow: 0 -4px 16px rgba(26, 26, 26, 0.08);
  pointer-events: auto;
}

.notice {
  margin: 12px 12px 0;
  padding: 16px;
  border-radius: 12px;
  background: #f2f3f5;
  color: #3c4149;
  font-size: var(--app-font-body);
  text-align: center;
}

.routes {
  margin: 12px 12px 0;
  padding-top: 12px;
  border-radius: 12px;
  background: #f2f3f5;
}

.routes-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px 10px;
}

.routes-icon {
  width: 18px;
  height: 18px;
  color: #1a1a1a;
}

.routes-title {
  color: #1a1a1a;
  font-size: var(--app-font-body);
  font-weight: 700;
  line-height: 1.3;
}

.routes-error {
  margin-left: auto;
  color: #d0121a;
  font-size: var(--app-font-small);
}

.route-tabs {
  display: flex;
}

.route-tab {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
  min-height: 48px;
  padding: 0 10px;
  border-radius: 12px 12px 0 0;
  color: #3c4149;
  cursor: pointer;
}

.route-tab.is-active {
  background: #ffffff;
  color: #d0121a;
  font-weight: 700;
}

.route-name {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.route-star {
  flex: none;
  width: 16px;
  height: 16px;
  color: #5c6370;
}

.extras {
  display: flex;
  border-top: 1px solid #ece7e7;
}

.extra {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  color: #3c4149;
  font-size: 14px;
  cursor: pointer;
}

.extra-arrow {
  color: #5c6370;
  font-size: 16px;
}

.order-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px calc(10px + var(--app-safe-bottom));
}

.reserve {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 44px;
  color: #1a1a1a;
  cursor: pointer;
}

.reserve svg {
  width: 30px;
  height: 26px;
}

.reserve-label {
  font-size: var(--app-font-small);
}

.order-pill {
  display: flex;
  flex: 1;
  height: 52px;
  overflow: hidden;
  border-radius: 26px;
  background: #2b2d35;
}

.estimate {
  display: flex;
  flex: 1;
  align-items: baseline;
  align-self: center;
  gap: 4px;
  min-width: 0;
  padding-left: 18px;
  color: #ffffff;
}

.estimate-label {
  font-size: 13px;
}

.estimate-price {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.order-button {
  flex: none;
  width: 44%;
  height: 52px;
  border-radius: 26px;
  background: #d0121a;
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  line-height: 52px;
}

.order-button[disabled] {
  background: #d0121a;
  color: #ffffff;
  opacity: 0.7;
}
</style>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onUnmounted, ref } from "vue";
import { onReady, onShow } from "@dcloudio/uni-app";
import { readChosenDestination, readChosenPickup, saveChosenDestination, saveChosenPickup, type ChosenPickup } from "@/chosen-destination";
import { placeOrder } from "@/passenger-api";
import { clearRideOptions, readRideOptions, readRideSettings } from "@/passenger-ride-settings";
import { mountPassengerMap } from "@/passenger-map";
import { requirePassenger } from "@/passenger-session";
import { fengduPlaces } from "@/fengdu-places";
import { searchPlaceTips, type PlaceTip } from "@/passenger-places";
import { mountRouteMap, type RouteSummary } from "@/route-map";

const FARE = 10;

const pickup = ref<ChosenPickup | null>(readChosenPickup());
const destination = ref(readChosenDestination());
const summary = ref<RouteSummary | null>(null);
const routeFailed = ref(false);
const editingPlaces = ref(!pickup.value || !destination.value);
const pickupQuery = ref(pickup.value?.name ?? "");
const destinationQuery = ref(destination.value?.name ?? "");
const pickupSuggestions = ref<PlaceTip[]>([]);
const destinationSuggestions = ref<PlaceTip[]>([]);
const ordering = ref(false);
const rideOptions = ref(readRideOptions());
const proxy = getCurrentInstance()?.proxy;
let disposed = false;
let destroyMap: (() => void) | undefined;
let fitRoute = () => {};
let mapSlot: HTMLElement | null = null;
let mapVersion = 0;
let pickupSearchTimer = 0;
let destinationSearchTimer = 0;
let pickupSearchTicket = 0;
let destinationSearchTicket = 0;

const fare = computed(() => (summary.value ? String(FARE) : "--"));
const scheduledLabel = computed(() => rideOptions.value.scheduledAt
  ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(rideOptions.value.scheduledAt))
  : "");
const routes = [
  { id: "recommend", name: "平台推荐" },
  { id: "second", name: "路线二" },
  { id: "fast", name: "更快·附加费多" },
];

onReady(() => {
  if (!requirePassenger()) return;
  nextTick(() => {
    const root = proxy?.$el;
    if (!(root instanceof HTMLElement)) return;
    mapSlot = root.querySelector<HTMLElement>(".map-slot");
    if (!mapSlot) return;
    if (editingPlaces.value) mountLocationMap();
    else mountBookingRoute();
  });
});

onShow(() => {
  rideOptions.value = readRideOptions();
});

onUnmounted(() => {
  disposed = true;
  destroyMap?.();
  window.clearTimeout(pickupSearchTimer);
  window.clearTimeout(destinationSearchTimer);
});

async function order() {
  const passenger = requirePassenger();
  const route = summary.value;
  if (!passenger || !pickup.value || !destination.value || ordering.value) return;
  if (!route) {
    uni.showToast({ title: routeFailed.value ? "路线规划失败，无法下单" : "路线规划中，请稍候", icon: "none" });
    return;
  }
  ordering.value = true;
  try {
    await placeOrder(passenger.id, {
      pickup: pickup.value,
      destination: destination.value,
      distanceMeters: Math.max(1, Math.round(route.distance)),
      durationSeconds: Math.max(1, Math.round(route.duration)),
      scheduledAt: rideOptions.value.scheduledAt,
      riderName: rideOptions.value.riderName || null,
      riderPhone: rideOptions.value.riderPhone || null,
      preferences: readRideSettings(),
    });
    const isReservation = !!rideOptions.value.scheduledAt;
    clearRideOptions();
    uni.reLaunch({ url: isReservation ? "/pages/upcoming/upcoming" : "/pages/waiting/waiting" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "下单失败", icon: "none" });
    ordering.value = false;
  }
}

function mountLocationMap() {
  if (!mapSlot || disposed) return;
  summary.value = null;
  routeFailed.value = false;
  if (!import.meta.env.VITE_AMAP_KEY || !import.meta.env.VITE_AMAP_SECURITY_CODE) {
    routeFailed.value = true;
    return;
  }
  const version = ++mapVersion;
  mountPassengerMap(mapSlot).then((map) => {
    if (disposed || version !== mapVersion) {
      map.destroy();
      return;
    }
    destroyMap = map.destroy;
    map.locate(Math.round(window.innerHeight * 0.4), () => {
      if (version === mapVersion) routeFailed.value = true;
    });
  }).catch(() => {
    if (version === mapVersion) routeFailed.value = true;
  });
}

function mountBookingRoute() {
  const chosenPickup = pickup.value;
  const chosenDestination = destination.value;
  if (!mapSlot || !chosenPickup || !chosenDestination || disposed) return;
  editingPlaces.value = false;
  const version = ++mapVersion;
  const root = proxy?.$el;
  const panel = root instanceof HTMLElement ? root.querySelector<HTMLElement>(".panel") : null;
  mountRouteMap(mapSlot, chosenPickup, chosenDestination, () => [110, (panel?.offsetHeight ?? 0) + 32, 90, 90])
    .then((map) => {
      if (disposed || version !== mapVersion) {
        map.destroy();
        return;
      }
      destroyMap = map.destroy;
      fitRoute = map.fit;
      summary.value = map.summary;
      routeFailed.value = !map.summary;
    })
    .catch(() => {
      if (version === mapVersion) routeFailed.value = true;
    });
}

function changePlaces() {
  destroyMap?.();
  destroyMap = undefined;
  editingPlaces.value = true;
  mountLocationMap();
}

function updatePickupQuery() {
  pickup.value = null;
  searchPlaces("pickup", pickupQuery.value);
}

function updateDestinationQuery() {
  destination.value = null;
  searchPlaces("destination", destinationQuery.value);
}

function searchPlaces(kind: "pickup" | "destination", value: string) {
  const keyword = value.trim();
  const suggestions = kind === "pickup" ? pickupSuggestions : destinationSuggestions;
  const timer = kind === "pickup" ? pickupSearchTimer : destinationSearchTimer;
  const ticket = kind === "pickup" ? ++pickupSearchTicket : ++destinationSearchTicket;
  window.clearTimeout(timer);
  if (!keyword) {
    suggestions.value = [];
    return;
  }
  suggestions.value = fengduPlaces.filter((place) => `${place.name} ${place.address}`.includes(keyword)).slice(0, 5);
  const nextTimer = window.setTimeout(() => {
    searchPlaceTips(keyword)
      .then((found) => {
        if (ticket !== (kind === "pickup" ? pickupSearchTicket : destinationSearchTicket)) return;
        const merged = [...suggestions.value, ...found];
        suggestions.value = merged.filter((place, index, all) =>
          place.longitude !== null && place.latitude !== null
          && all.findIndex((other) => other.longitude === place.longitude && other.latitude === place.latitude) === index,
        ).slice(0, 6);
      })
      .catch(() => undefined);
  }, 250);
  if (kind === "pickup") pickupSearchTimer = nextTimer;
  else destinationSearchTimer = nextTimer;
}

function choosePlace(kind: "pickup" | "destination", place: PlaceTip) {
  if (place.longitude === null || place.latitude === null) return;
  const selected = { name: place.name, longitude: place.longitude, latitude: place.latitude };
  if (kind === "pickup") {
    pickup.value = selected;
    pickupQuery.value = place.name;
    pickupSuggestions.value = [];
    window.clearTimeout(pickupSearchTimer);
    pickupSearchTicket += 1;
    saveChosenPickup(selected);
  } else {
    destination.value = selected;
    destinationQuery.value = place.name;
    destinationSuggestions.value = [];
    window.clearTimeout(destinationSearchTimer);
    destinationSearchTicket += 1;
    saveChosenDestination(selected);
  }
}

function confirmPlaces() {
  if (!pickup.value || !destination.value) {
    uni.showToast({ title: "请选择上车点和目的地", icon: "none" });
    return;
  }
  saveChosenPickup(pickup.value);
  saveChosenDestination(destination.value);
  destroyMap?.();
  destroyMap = undefined;
  mountBookingRoute();
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

function editRideOptions(mode: "appointment" | "someone") {
  uni.navigateTo({ url: `/pages/ride-options/ride-options?mode=${mode}&returnTo=booking` });
}

function showRideOptions() {
  const tags: string[] = [];
  if (rideOptions.value.scheduledAt) tags.push(`预约时间：${scheduledLabel.value}`);
  if (rideOptions.value.riderName) tags.push(`乘车人：${rideOptions.value.riderName}`);
  if (!tags.length) return;
  uni.showToast({ title: tags.join("，"), icon: "none", duration: 2200 });
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
        <view v-if="editingPlaces" class="place-form">
          <view class="place-form-head">
            <text class="place-form-title">填写行程地点</text>
            <text>搜索并选择上车点和目的地</text>
          </view>
          <view class="place-field">
            <text class="place-field-label"><text class="place-dot place-dot--pickup"></text>上车点</text>
            <input v-model="pickupQuery" class="place-input" type="text" placeholder="搜索上车地点" placeholder-class="place-placeholder" @input="updatePickupQuery" />
            <view v-if="pickupSuggestions.length" class="place-suggestions">
              <view v-for="place in pickupSuggestions" :key="`pickup-${place.placeId}-${place.name}`" class="place-suggestion" role="button" @tap="choosePlace('pickup', place)">
                <text class="place-suggestion-name">{{ place.name }}</text>
                <text v-if="place.address" class="place-suggestion-address">{{ place.address }}</text>
              </view>
            </view>
          </view>
          <view class="place-field">
            <text class="place-field-label"><text class="place-dot place-dot--destination"></text>目的地</text>
            <input v-model="destinationQuery" class="place-input" type="text" placeholder="搜索目的地" placeholder-class="place-placeholder" @input="updateDestinationQuery" />
            <view v-if="destinationSuggestions.length" class="place-suggestions">
              <view v-for="place in destinationSuggestions" :key="`destination-${place.placeId}-${place.name}`" class="place-suggestion" role="button" @tap="choosePlace('destination', place)">
                <text class="place-suggestion-name">{{ place.name }}</text>
                <text v-if="place.address" class="place-suggestion-address">{{ place.address }}</text>
              </view>
            </view>
          </view>
          <text v-if="routeFailed" class="place-error">地图暂不可用，仍可搜索并选择常用地点</text>
          <button class="place-confirm" @tap="confirmPlaces">确认地点</button>
        </view>
        <view v-else-if="pickup && destination" class="routes">
          <view class="routes-head">
            <svg class="routes-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 20V5M6 11l6-6 6 6" />
            </svg>
            <text class="routes-title">路线选择</text>
            <text v-if="routeFailed" class="routes-error">路线规划失败</text>
          </view>
          <view class="pickup-summary">
            <text class="pickup-summary-name">上车点：{{ pickup.name }}</text>
            <text class="pickup-summary-name">目的地：{{ destination.name }}</text>
            <text class="pickup-summary-edit" role="button" @tap="changePlaces">修改</text>
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

        <view v-if="scheduledLabel || rideOptions.riderName" class="ride-context" role="button" @tap="showRideOptions">
          <text v-if="scheduledLabel">预约 {{ scheduledLabel }}</text>
          <text v-if="rideOptions.riderName">乘车人 {{ rideOptions.riderName }}</text>
        </view>

        <view class="extras">
          <view class="extra" role="button" @tap="editRideOptions('someone')">
            <text>帮人叫车</text>
            <text class="extra-arrow">›</text>
          </view>
          <view class="extra" role="button" @tap="comingSoon">
            <text>偏好设置</text>
            <text class="extra-arrow">›</text>
          </view>
        </view>

        <view v-if="!editingPlaces" class="order-bar">
          <view class="reserve" role="button" @tap="editRideOptions('appointment')">
            <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 15v-3l2.2-5A2 2 0 0 1 7 6h8a2 2 0 0 1 1.8 1L19 12" />
              <path d="M3 15h9M5 15v2M3 12h11" />
              <circle cx="20" cy="16" r="5" />
              <path d="M20 13.5V16l1.6 1.2" />
            </svg>
            <text class="reserve-label">{{ rideOptions.scheduledAt ? "改预约" : "预约" }}</text>
          </view>
          <view class="order-pill">
            <view class="estimate">
              <text class="estimate-label">预估</text>
              <text class="estimate-price">¥{{ fare }}</text>
            </view>
            <button class="order-button" :disabled="ordering" @tap="order">{{ ordering ? "提交中" : rideOptions.scheduledAt ? "预约叫车" : "立即打车" }}</button>
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
  max-height: 72vh;
  overflow-y: auto;
  border-radius: 16px 16px 0 0;
  background: #ffffff;
  box-shadow: 0 -4px 16px rgba(26, 26, 26, 0.08);
  pointer-events: auto;
}

.place-form {
  margin: 12px 12px 0;
  padding: 16px;
  border-radius: 12px;
  background: #f2f3f5;
}

.place-form-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #687385;
  font-size: 12px;
}

.place-form-title {
  color: #252630;
  font-size: 16px;
  font-weight: 700;
}

.place-field { position: relative; margin-top: 14px; }

.place-field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
  color: #3c4149;
  font-size: 13px;
  font-weight: 600;
}

.place-dot { width: 8px; height: 8px; border-radius: 50%; }
.place-dot--pickup { background: #2db878; }
.place-dot--destination { background: #d0121a; }

.place-input {
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border: 1px solid #dfe2e7;
  border-radius: 10px;
  background: #ffffff;
  color: #252630;
  font-size: 14px;
}

.place-placeholder { color: #9aa1ad; }

.place-suggestions {
  position: relative;
  z-index: 4;
  max-height: 150px;
  margin-top: 4px;
  overflow-y: auto;
  border: 1px solid #e7e9ed;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(30, 35, 45, .08);
}

.place-suggestion { display: flex; flex-direction: column; gap: 2px; padding: 9px 11px; border-top: 1px solid #f0f1f3; }
.place-suggestion:first-child { border-top: 0; }
.place-suggestion-name { color: #252630; font-size: 13px; font-weight: 600; }
.place-suggestion-address { color: #8a9099; font-size: 11px; }
.place-error { display: block; margin-top: 10px; color: #d0121a; font-size: 12px; }

.place-confirm {
  width: 100%;
  height: 46px;
  margin-top: 14px;
  border: 0;
  border-radius: 23px;
  background: #d0121a;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  line-height: 46px;
}

.place-confirm::after { border: 0; }

.notice {
  margin: 12px 12px 0;
  padding: 16px;
  border-radius: 12px;
  background: #f2f3f5;
  color: #3c4149;
  font-size: var(--app-font-body);
  text-align: center;
}

.pickup-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  position: relative;
  padding: 0 48px 10px 14px;
  color: #687385;
  font-size: 12px;
}

.pickup-summary-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pickup-summary-edit {
  position: absolute;
  top: 0;
  right: 14px;
  color: #d0121a;
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

.ride-context {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 8px 14px;
  border-top: 1px solid #ece7e7;
  color: #c5222d;
  font-size: 12px;
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

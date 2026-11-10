<script setup lang="ts">
import { onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { driverApi, type DispatchOrder } from "@/driver-api";
import { requireDriver } from "@/driver-session";

const offers = ref<DispatchOrder[]>([]);
const held = ref<DispatchOrder | null>(null);
const loading = ref(false);
const acceptingId = ref("");
const error = ref("");

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

async function loadOffers() {
  const driver = requireDriver();
  if (!driver) return;
  loading.value = true;
  error.value = "";
  try {
    const current = await driverApi.currentDispatchOrder(driver.id);
    held.value = current.order;
    offers.value = current.order ? [] : (await driverApi.listWaitingOrders(driver.id)).orders;
  } catch (cause) {
    held.value = null;
    offers.value = [];
    error.value = cause instanceof Error ? cause.message : "订单加载失败";
  } finally {
    loading.value = false;
  }
}

async function accept(offer: DispatchOrder) {
  const driver = requireDriver();
  if (!driver || acceptingId.value) return;
  acceptingId.value = offer.id;
  try {
    held.value = await driverApi.acceptDispatchOrder(driver.id, offer.id);
    offers.value = [];
    error.value = "";
  } catch (cause) {
    uni.showToast({ title: cause instanceof Error ? cause.message : "接单失败", icon: "none" });
    await loadOffers();
  } finally {
    acceptingId.value = "";
  }
}

function decline(offer: DispatchOrder) {
  offers.value = offers.value.filter((item) => item.id !== offer.id);
  uni.showToast({ title: "已跳过此单", icon: "none" });
}

function backOnline() { uni.redirectTo({ url: "/pages/online/online" }); }
onMounted(loadOffers);
</script>

<template>
  <view class="driver-page driver-page--scroll">
    <DriverPageHeader title="派单大厅"><template #right><button class="refresh-button" @tap="loadOffers">刷新</button></template></DriverPageHeader>
    <scroll-view class="dispatch-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="dispatch-intro">
          <text class="driver-eyebrow">{{ held ? "当前订单" : "等待接单" }}</text>
          <text class="driver-title">{{ held ? "你已接下一笔订单" : "挑选合适的行程" }}</text>
          <text class="driver-muted">{{ held ? "上车点和目的地如下" : "接单前请确认路线和预估车费" }}</text>
        </view>
        <view v-if="loading && !held && !offers.length" class="driver-card driver-empty">正在获取订单…</view>
        <view v-else-if="error" class="driver-card driver-empty">{{ error }}</view>
        <view v-else-if="held" class="driver-card offer-card">
          <view class="driver-between">
            <view><text class="driver-tag">已接单</text><text class="offer-id">订单 {{ held.id }}</text></view>
            <view class="offer-fare"><text>预估</text><strong>¥{{ yuan(held.fareCents) }}</strong></view>
          </view>
          <view class="route-item"><view class="route-dot route-dot--pickup">上</view><view class="route-copy"><text class="route-label">上车点</text><text class="route-address">{{ held.pickup.name }}</text></view></view>
          <view class="route-connector" />
          <view class="route-item"><view class="route-dot route-dot--destination">终</view><view class="route-copy"><text class="route-label">目的地 · {{ kilometers(held.distanceMeters) }} km / {{ minutes(held.durationSeconds) }} 分钟</text><text class="route-address">{{ held.destination.name }}</text></view></view>
          <view class="driver-divider" />
          <view class="offer-meta"><text>乘客 {{ held.passengerName }}</text><text v-if="held.scheduledAt">预约 {{ scheduledLabel(held.scheduledAt) }}</text></view>
          <view v-if="held.preferences && (held.preferences.quietRide || held.preferences.smokeFree || held.preferences.trunkNeeded || held.preferences.note)" class="preference-tags">
            <text v-if="held.preferences.quietRide">安静出行</text><text v-if="held.preferences.smokeFree">无烟车辆</text><text v-if="held.preferences.trunkNeeded">需要后备箱</text><text v-if="held.preferences.note">备注：{{ held.preferences.note }}</text>
          </view>
        </view>
        <template v-else>
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
              <button class="driver-secondary" @tap="decline(offer)">暂不接</button>
              <button class="driver-primary" :disabled="acceptingId === offer.id" @tap="accept(offer)">{{ acceptingId === offer.id ? "接单中" : "接单" }}</button>
            </view>
          </view>
          <view v-if="!loading && !offers.length" class="driver-card driver-empty">暂时没有等待接单的订单</view>
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
.dispatch-bottom { display: flex; align-items: center; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); background: #292a34; box-sizing: border-box; }
.dispatch-bottom .driver-secondary { width: 100%; height: 56px; min-height: 56px; }
.dispatch-bottom .driver-secondary { border-color: #565965; background: #3c3d47; color: #f1f2f4; }
.refresh-button { margin: 0; padding: 6px 0 6px 10px; border: 0; background: transparent; color: #d0121a; font-size: 13px; }
.refresh-button::after { border: 0; }
</style>

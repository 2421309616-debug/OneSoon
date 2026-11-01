<script setup lang="ts">
import { onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoOffers, driverApi, type OrderOffer } from "@/driver-api";

const offers = ref<OrderOffer[]>([]);
const loading = ref(false);

async function loadOffers() {
  loading.value = true;
  try {
    offers.value = (await driverApi.getOrderOffers()) ?? demoOffers;
  } catch {
    offers.value = demoOffers;
    uni.showToast({ title: "后端暂不可用，显示演示订单", icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function accept(offer: OrderOffer) {
  try {
    await driverApi.acceptOffer(offer.id);
  } catch {
    uni.showToast({ title: "后端暂不可用，按演示流程继续", icon: "none" });
  }
  uni.navigateTo({ url: `/pages/trip/trip?orderId=${encodeURIComponent(offer.id)}&phase=pickup` });
}

async function decline(offer: OrderOffer) {
  try { await driverApi.declineOffer(offer.id); } catch { /* 演示模式下本地移除订单 */ }
  offers.value = offers.value.filter((item) => item.id !== offer.id);
  uni.showToast({ title: "已暂不接此单", icon: "none" });
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
          <text class="driver-eyebrow">附近订单</text>
          <text class="driver-title">挑选合适的行程</text>
          <text class="driver-muted">接单前请确认距离、路线和预计收入</text>
        </view>
        <view v-if="loading && !offers.length" class="driver-card driver-empty">正在获取附近订单…</view>
        <view v-for="offer in offers" :key="offer.id" class="driver-card offer-card">
          <view class="driver-between">
            <view><text class="driver-tag">即时订单</text><text class="offer-id">订单 {{ offer.id }}</text></view>
            <view class="offer-fare"><text>预估收入</text><strong>¥{{ offer.estimatedFare.toFixed(2) }}</strong></view>
          </view>
          <view class="route-item"><view class="route-dot route-dot--pickup">上</view><view class="route-copy"><text class="route-label">接乘客 · {{ offer.pickupDistanceKm }} km</text><text class="route-address">{{ offer.pickup }}</text></view></view>
          <view class="route-connector" />
          <view class="route-item"><view class="route-dot route-dot--destination">终</view><view class="route-copy"><text class="route-label">目的地 · {{ offer.tripDistanceKm }} km / {{ offer.estimatedMinutes }} 分钟</text><text class="route-address">{{ offer.destination }}</text></view></view>
          <view class="driver-divider" />
          <view class="driver-between offer-meta"><text>乘客 {{ offer.passengerName }} · ★ 4.9</text><text>约 {{ offer.estimatedMinutes }} 分钟</text></view>
          <view class="offer-actions"><button class="driver-secondary" @tap="decline(offer)">暂不接</button><button class="driver-primary" @tap="accept(offer)">接单并出发</button></view>
        </view>
        <view v-if="!loading && !offers.length" class="driver-card driver-empty">暂时没有新订单，刷新看看</view>
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

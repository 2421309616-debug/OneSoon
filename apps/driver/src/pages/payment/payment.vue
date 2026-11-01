<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoOffers, driverApi, type OrderOffer } from "@/driver-api";

const order = ref<OrderOffer>(demoOffers[0]);
const paymentRequested = ref(false);
const busy = ref(false);

onLoad((options) => {
  const orderId = String(options?.orderId ?? demoOffers[0].id);
  const demoOrder = demoOffers.find((item) => item.id === orderId);
  const read = (key: string, fallback: string) => {
    const value = options?.[key];
    if (value === undefined || value === null) return fallback;
    try { return decodeURIComponent(String(value)); } catch { return String(value); }
  };
  order.value = {
    id: orderId,
    passengerName: read("passengerName", demoOrder?.passengerName ?? "乘客"),
    pickup: read("pickup", demoOrder?.pickup ?? "上车点"),
    destination: read("destination", demoOrder?.destination ?? "目的地"),
    pickupDistanceKm: demoOrder?.pickupDistanceKm ?? 0,
    tripDistanceKm: Number(options?.distanceKm ?? demoOrder?.tripDistanceKm ?? 0),
    estimatedMinutes: Number(options?.durationMinutes ?? demoOrder?.estimatedMinutes ?? 0),
    estimatedFare: Number(options?.amount ?? demoOrder?.estimatedFare ?? 0),
  };
});

async function requestPayment() {
  if (busy.value) return;
  if (paymentRequested.value) {
    uni.setStorageSync("onesoon-driver-online", true);
    try { await driverApi.setAvailability(true); } catch { /* 本地演示状态继续 */ }
    uni.redirectTo({ url: "/pages/online/online" });
    return;
  }

  busy.value = true;
  try {
    const result = await driverApi.requestTripPayment(order.value.id, order.value.estimatedFare);
    if (!result?.accepted) {
      uni.showToast({ title: "收款请求未发起，请重试", icon: "none" });
      return;
    }
    paymentRequested.value = true;
    uni.showToast({ title: result.demo ? "演示模式：收款请求已发起" : "收款请求已发起", icon: "none" });
  } catch {
    uni.showToast({ title: "收款请求失败，请稍后重试", icon: "none" });
  } finally {
    busy.value = false;
  }
}

async function finishOffline() {
  try { await driverApi.setAvailability(false); } catch { /* 本地演示状态继续 */ }
  uni.setStorageSync("onesoon-driver-online", false);
  uni.redirectTo({ url: "/pages/home/home" });
}

</script>

<template>
  <view class="driver-page driver-page--scroll payment-page">
    <DriverPageHeader title="行程收款" back-to="/pages/online/online" />
    <scroll-view class="payment-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="payment-status">
          <view class="payment-check">✓</view>
          <text class="payment-status-title">行程已结束</text>
          <text class="payment-status-note">请向乘客发起本次行程收款</text>
        </view>
        <view class="driver-card payment-amount-card">
          <text class="payment-label">本次行程金额</text>
          <view class="payment-amount"><text class="payment-currency">¥</text><text>{{ order.estimatedFare.toFixed(2) }}</text></view>
          <text class="payment-amount-note">以实际订单结算金额为准</text>
        </view>
        <view class="driver-card payment-detail-card">
          <text class="driver-section-title">订单信息</text>
          <view class="payment-route"><view class="payment-route-mark"><text class="payment-dot payment-dot--pickup" /><view class="payment-route-line" /><text class="payment-dot payment-dot--destination" /></view><view class="payment-addresses"><view><text class="payment-detail-label">上车点</text><text class="payment-address">{{ order.pickup }}</text></view><view><text class="payment-detail-label">目的地</text><text class="payment-address">{{ order.destination }}</text></view></view></view>
          <view class="payment-meta"><text>乘客：{{ order.passengerName }}</text><text>{{ order.tripDistanceKm }} km · {{ order.estimatedMinutes }} 分钟</text></view>
          <text class="payment-order-id">订单编号：{{ order.id }}</text>
        </view>
      </view>
    </scroll-view>
    <view class="driver-fixed-action payment-footer">
      <button v-if="paymentRequested" class="driver-secondary payment-offline-button" @tap="finishOffline"><image src="/static/icons/close.svg" mode="aspectFit" /><text>收车</text></button>
      <button class="driver-primary payment-button" :disabled="busy" @tap="requestPayment">{{ busy ? "正在发起…" : paymentRequested ? "返回听单中心" : "发起收款" }}</button>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.payment-scroll { flex: 1; min-height: 0; }
.payment-status { display: flex; flex-direction: column; align-items: center; padding: 23px 12px 19px; text-align: center; }
.payment-check { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: #e8f5ee; color: #25815b; font-size: 24px; font-weight: 700; }
.payment-status-title { margin-top: 10px; color: #252630; font-size: 18px; font-weight: 700; }
.payment-status-note { margin-top: 5px; color: #737987; font-size: 12px; }
.payment-amount-card { padding: 19px 16px; text-align: center; }
.payment-label { color: #737987; font-size: 12px; }
.payment-amount { display: flex; align-items: baseline; justify-content: center; margin-top: 5px; color: #252630; font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; }
.payment-currency { margin-right: 2px; font-size: 20px; }
.payment-amount-note { display: block; margin-top: 5px; color: #8a909b; font-size: 10px; }
.payment-detail-card { padding: 16px; }
.payment-route { display: flex; gap: 10px; margin-top: 14px; padding: 13px; border-radius: 12px; background: #f6f7f9; }
.payment-route-mark { display: flex; flex: none; flex-direction: column; align-items: center; justify-content: space-between; padding: 3px 0; }
.payment-dot { display: block; width: 9px; height: 9px; border-radius: 50%; }
.payment-dot--pickup { background: #c94a52; }
.payment-dot--destination { background: #3c84c5; }
.payment-route-line { flex: 1; width: 1px; min-height: 18px; background: #d9dce2; }
.payment-addresses { display: flex; flex: 1; flex-direction: column; gap: 14px; min-width: 0; }
.payment-addresses > view { display: flex; flex-direction: column; gap: 3px; }
.payment-detail-label { color: #737987; font-size: 10px; }
.payment-address { color: #252630; font-size: 12px; font-weight: 650; line-height: 1.4; }
.payment-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 13px; color: #626977; font-size: 11px; }
.payment-order-id { display: block; margin-top: 10px; padding-top: 9px; border-top: 1px solid #eceef1; color: #8a909b; font-size: 10px; }
.payment-footer { display: flex; align-items: center; gap: 10px; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); border-top: 0; box-sizing: border-box; }
.payment-button { flex: 1; height: 56px; min-height: 56px; border-radius: 12px; font-size: 16px; }
.payment-offline-button { display: flex; flex: 0 0 56px; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 56px; height: 56px; min-height: 56px; padding: 0 4px; border: 0; border-radius: 12px; background: #4a4b5d; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; }
.payment-offline-button::after { border: 0; }
.payment-offline-button image { display: block; width: 18px; height: 18px; filter: brightness(0) invert(1); }
.payment-offline-button text { font-size: 10px; font-weight: 700; line-height: 1; }
</style>

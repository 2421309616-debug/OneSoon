<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoOffers, demoTrips, driverApi, type DriverNavigationRoute, type OrderOffer, type PassengerContact } from "@/driver-api";

type TripPhase = "pickup" | "waiting" | "in-trip" | "completed";
const phase = ref<TripPhase>("pickup");
const order = ref<OrderOffer>(demoOffers[0]);
const route = ref<DriverNavigationRoute | null>(null);
const contact = ref<PassengerContact | null>(null);
const contactVisible = ref(false);
const cancelVisible = ref(false);
const orderDetailVisible = ref(false);
const phaseLabel = computed(() => ({ pickup: "前往上车点", waiting: "已到达上车点", "in-trip": "行程进行中", completed: "行程已完成" }[phase.value]));
const guidance = computed(() => ({ pickup: "沿当前道路前往上车点", waiting: "请联系乘客并等待上车", "in-trip": "沿导航路线前往目的地", completed: "本次行程已结束" }[phase.value]));
const actionLabel = computed(() => ({ pickup: "到达上车点", waiting: "接到乘客，开始行程", "in-trip": "到达目的地，结束行程", completed: "返回听单中心" }[phase.value]));

onLoad((options) => {
  const id = String(options?.orderId ?? demoOffers[0].id);
  const found = demoOffers.find((item) => item.id === id);
  const completed = demoTrips.find((item) => item.id === id);
  if (found) order.value = found;
  else if (completed) {
    order.value = { id: completed.id, passengerName: "乘客", pickup: completed.pickup, destination: completed.destination, pickupDistanceKm: 0, tripDistanceKm: completed.distanceKm, estimatedMinutes: completed.durationMinutes, estimatedFare: completed.fare };
    phase.value = "completed";
  }
  const requestedPhase = String(options?.phase ?? "pickup");
  if (["pickup", "waiting", "in-trip", "completed"].includes(requestedPhase)) phase.value = requestedPhase as TripPhase;
});

async function loadRoute() {
  if (phase.value !== "pickup" && phase.value !== "in-trip") { route.value = null; return; }
  try { route.value = await driverApi.getNavigationRoute(order.value.id, phase.value === "pickup" ? "pickup" : "destination"); }
  catch { route.value = null; }
}

onMounted(loadRoute);

async function advance() {
  if (phase.value === "completed") {
    try { await driverApi.setAvailability(true); } catch { uni.showToast({ title: "演示模式：继续听单", icon: "none" }); }
    uni.setStorageSync("onesoon-driver-online", true);
    uni.redirectTo({ url: "/pages/online/online" });
    return;
  }
  const event = phase.value === "pickup" ? "arrived" : phase.value === "waiting" ? "started" : "completed";
  try { await driverApi.updateTrip(order.value.id, event); } catch { uni.showToast({ title: "演示模式：行程状态已更新", icon: "none" }); }
  if (phase.value === "in-trip") {
    const params = new URLSearchParams({
      orderId: order.value.id,
      passengerName: order.value.passengerName,
      pickup: order.value.pickup,
      destination: order.value.destination,
      amount: String(order.value.estimatedFare),
      distanceKm: String(order.value.tripDistanceKm),
      durationMinutes: String(order.value.estimatedMinutes),
    });
    uni.redirectTo({ url: `/pages/payment/payment?${params.toString()}` });
    return;
  }
  phase.value = phase.value === "pickup" ? "waiting" : phase.value === "waiting" ? "in-trip" : "completed";
  await loadRoute();
}

async function finishOffline() {
  try { await driverApi.setAvailability(false); } catch { /* 本地演示状态继续 */ }
  uni.setStorageSync("onesoon-driver-online", false);
  uni.redirectTo({ url: "/pages/home/home" });
}

function cancelTrip() {
  cancelVisible.value = true;
}

async function confirmCancelTrip() {
  cancelVisible.value = false;
  try { await driverApi.updateTrip(order.value.id, "cancelled"); } catch { /* 本地演示状态继续 */ }
  uni.redirectTo({ url: "/pages/online/online" });
}

async function openContact() {
  try { contact.value = await driverApi.getPassengerContact(order.value.id); }
  catch { contact.value = { name: order.value.passengerName, maskedPhone: "138****5208" }; }
  contactVisible.value = true;
}

function openOrderDetails() {
  orderDetailVisible.value = true;
}

async function callPassenger() {
  try { await driverApi.requestPassengerCall(order.value.id); uni.showToast({ title: "已记录联系请求", icon: "none" }); }
  catch { uni.showToast({ title: "演示模式：已记录联系请求", icon: "none" }); }
  contactVisible.value = false;
}

</script>

<template>
  <view class="driver-page trip-page trip-page--map">
    <view class="trip-map">
      <view class="driver-map-road driver-map-road--a" /><view class="driver-map-road driver-map-road--b" /><view class="driver-map-road driver-map-road--c" /><view class="driver-map-route" /><view class="driver-map-pin driver-map-pin--car">车</view><view class="driver-map-pin driver-map-pin--place">{{ phase === 'in-trip' ? '终' : '上' }}</view>
    </view>
    <DriverPageHeader title="行程" back-to="/pages/dispatch/dispatch" />
    <view class="guidance-card"><view class="turn-icon">{{ phase === 'waiting' || phase === 'completed' ? '✓' : '↑' }}</view><view class="guidance-copy"><text class="guidance-title">{{ guidance }}</text><text class="guidance-distance">{{ route?.distanceKm ?? (phase === 'pickup' ? order.pickupDistanceKm : order.tripDistanceKm) }} km · 约 {{ route?.durationMinutes ?? order.estimatedMinutes }} 分钟</text></view><text class="phase-pill">{{ phaseLabel }}</text></view>
    <view v-if="phase === 'pickup' || phase === 'waiting'" class="trip-contact-float" role="button" aria-label="查看订单详情" @tap="openOrderDetails"><view class="passenger-avatar">{{ order.passengerName.slice(0, 1) }}</view><view class="trip-contact-copy"><text class="trip-contact-name">{{ order.passengerName }}</text><text class="trip-contact-meta">乘客 · 评分 4.9</text><text class="trip-contact-hint">点击查看订单详情</text></view><button class="contact-button" aria-label="联系乘客" @tap.stop="openContact"><text>联系乘客</text></button></view>
    <view class="trip-actions"><button v-if="phase === 'pickup'" class="driver-secondary cancel-button" @tap="cancelTrip"><image src="/static/icons/close.svg" mode="aspectFit" /><text>取消订单</text></button><button v-if="phase === 'completed'" class="driver-secondary finish-offline-button" @tap="finishOffline"><image src="/static/icons/close.svg" mode="aspectFit" /><text>收车</text></button><button class="driver-primary" @tap="advance">{{ actionLabel }}</button></view>
    <view v-if="orderDetailVisible" class="order-detail-overlay" @tap.self="orderDetailVisible = false"><view class="order-detail-sheet"><text class="order-detail-title">订单详情</text><view class="order-detail-route"><view class="order-detail-mark"><text class="history-dot history-dot--pickup" /><view class="order-detail-line" /><text class="history-dot history-dot--destination" /></view><view class="order-detail-addresses"><view><text class="order-detail-label">上车点</text><text class="order-detail-address">{{ order.pickup }}</text></view><view><text class="order-detail-label">目的地</text><text class="order-detail-address">{{ order.destination }}</text></view></view></view><view class="order-detail-metrics"><view><text class="order-detail-value">{{ order.tripDistanceKm }} km</text><text class="order-detail-label">预计里程</text></view><view><text class="order-detail-value">约 {{ order.estimatedMinutes }} 分钟</text><text class="order-detail-label">预计时长</text></view><view><text class="order-detail-value">¥{{ order.estimatedFare.toFixed(2) }}</text><text class="order-detail-label">预估收入</text></view></view><text class="order-detail-id">订单编号：{{ order.id }}</text><button class="driver-secondary order-detail-close" @tap="orderDetailVisible = false">关闭</button></view></view>
    <view v-if="cancelVisible" class="cancel-overlay" @tap.self="cancelVisible = false"><view class="cancel-sheet"><text class="cancel-title">取消本次行程</text><text class="cancel-message">确认取消当前订单吗？</text><view class="cancel-sheet-actions"><button class="cancel-keep" @tap="cancelVisible = false">继续行程</button><button class="cancel-confirm" @tap="confirmCancelTrip">确认取消</button></view></view></view>
    <view v-if="contactVisible" class="contact-overlay" @tap.self="contactVisible = false"><view class="contact-sheet"><text class="contact-name">{{ contact?.name }}</text><text class="contact-phone">{{ contact?.maskedPhone }}</text><button class="driver-primary contact-action" @tap="callPassenger">发起平台联系</button><button class="driver-secondary close-action" @tap="contactVisible = false">关闭</button></view></view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.trip-page { position: relative; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
.trip-page--map { background: #e8eeeb; }
.trip-page :deep(.driver-header) { position: absolute; z-index: 5; top: 0; right: 0; left: 0; box-sizing: border-box; background: #2a2a34ed; }
.trip-map { position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; overflow: hidden; background-color: #e8eeeb; background-image: linear-gradient(28deg,transparent 48%,#ffffffca 49%,#ffffffca 51%,transparent 52%),linear-gradient(145deg,transparent 46%,#ffffffbd 47%,#ffffffbd 49%,transparent 50%),linear-gradient(90deg,#76847712 1px,transparent 1px),linear-gradient(#76847712 1px,transparent 1px); background-size: auto,auto,42px 42px,42px 42px; }
.trip-map .driver-map-road--a { top: 44%; }.trip-map .driver-map-road--b { top: 63%; }.trip-map .driver-map-road--c { top: 35%; }
.trip-map .driver-map-route { top: 43%; }
.guidance-card { position: absolute; z-index: 3; top: calc(66px + env(safe-area-inset-top)); right: 12px; left: 12px; display: flex; align-items: center; gap: 10px; padding: 11px; border: 1px solid #e0e2e7; border-radius: 14px; background: #ffffffed; box-shadow: 0 4px 14px #20232d18; }
.turn-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 11px; background: #d0121a; color: #fff; font-size: 22px; font-weight: 750; }
.guidance-copy { flex: 1; min-width: 0; }.guidance-title { display: block; overflow: hidden; color: #252630; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.guidance-distance { display: block; margin-top: 4px; color: #737987; font-size: 10px; }
.phase-pill { flex: none; padding: 5px 8px; border-radius: 999px; background: #fcebed; color: #bd202b; font-size: 10px; }
.passenger-avatar { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; background: #f8e8e9; color: #b4232e; font-weight: 700; }
.trip-contact-float { position: absolute; z-index: 4; right: 12px; bottom: calc(80px + env(safe-area-inset-bottom) + 10px); left: 12px; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border: 1px solid #e0e2e7; border-radius: 16px; background: #ffffffed; box-shadow: 0 4px 14px #20232d1a; box-sizing: border-box; }
.trip-contact-copy { display: flex; flex: 1; flex-direction: column; gap: 3px; min-width: 0; }
.trip-contact-name { color: #252630; font-size: 13px; font-weight: 700; line-height: 1.2; }
.trip-contact-meta { color: #737987; font-size: 10px; line-height: 1.2; }
.contact-button { display: flex; flex: none; align-items: center; justify-content: center; min-width: 76px; min-height: 36px; margin: 0; padding: 0 8px; border: 1px solid #e3b7bb; border-radius: 10px; background: #fff; color: #bd202b; font-size: 11px; font-weight: 650; line-height: 1; white-space: nowrap; }.contact-button::after { border: 0; }.contact-button text { white-space: nowrap; }
.trip-actions { position: absolute; z-index: 6; right: 0; bottom: 0; left: 0; display: flex; align-items: center; gap: 10px; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); background: #272733; box-sizing: border-box; }.trip-actions .driver-primary { flex: 1; height: 56px; min-height: 56px; border-radius: 12px; background: #d0121a; font-size: 16px; }.trip-actions .driver-secondary { display: flex; flex: 0 0 56px; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 56px; height: 56px; min-height: 56px; margin: 0; padding: 0 4px; border: 0; border-radius: 12px; background: #4a4b5d; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; }.trip-actions .driver-secondary::after { border: 0; }.trip-actions .driver-secondary text { font-size: 10px; font-weight: 700; line-height: 1; }.cancel-button image { display: block; flex: none; width: 18px; height: 18px; filter: brightness(0) invert(1); }
.finish-offline-button image { display: block; flex: none; width: 18px; height: 18px; filter: brightness(0) invert(1); }
.cancel-overlay { position: fixed; z-index: 20; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: #1e202866; }
.cancel-sheet { width: 100%; max-width: 375px; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; background: #fff; box-sizing: border-box; text-align: center; }
.cancel-title { display: block; color: #252630; font-size: 18px; font-weight: 700; line-height: 1.4; }
.cancel-message { display: block; margin-top: 10px; color: #737987; font-size: 14px; line-height: 1.5; }
.cancel-sheet-actions { display: flex; flex-direction: column-reverse; gap: 10px; margin-top: 18px; }
.cancel-sheet-actions button { width: 100%; height: 46px; margin: 0; border-radius: 11px; font-size: 15px; font-weight: 700; line-height: 46px; }
.cancel-sheet-actions button::after { border: 0; }
.cancel-keep { background: #f1f2f5; color: #343642; }
.cancel-confirm { background: #d0121a; color: #fff; }
.trip-contact-float { cursor: pointer; }
.trip-contact-hint { display: block; margin-top: 3px; color: #8a909b; font-size: 9px; line-height: 1.2; }
.order-detail-overlay { position: fixed; z-index: 25; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: #1e202866; }
.order-detail-sheet { width: 100%; max-width: 375px; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; background: #fff; box-sizing: border-box; }
.order-detail-title { display: block; color: #252630; font-size: 18px; font-weight: 700; line-height: 1.4; text-align: center; }
.order-detail-route { display: flex; gap: 11px; margin-top: 18px; padding: 14px; border-radius: 12px; background: #f6f7f9; }
.order-detail-mark { display: flex; flex: none; flex-direction: column; align-items: center; justify-content: space-between; padding: 3px 0; }
.order-detail-mark .history-dot { display: block; width: 9px; height: 9px; border-radius: 50%; }
.order-detail-mark .history-dot--pickup { background: #c94a52; }
.order-detail-mark .history-dot--destination { background: #3c84c5; }
.order-detail-line { flex: 1; width: 1px; min-height: 20px; background: #d9dce2; }
.order-detail-addresses { display: flex; flex: 1; flex-direction: column; justify-content: space-between; gap: 17px; min-width: 0; }
.order-detail-addresses > view { display: flex; flex-direction: column; gap: 4px; }
.order-detail-label { color: #737987; font-size: 11px; }
.order-detail-address { color: #252630; font-size: 13px; font-weight: 650; line-height: 1.4; }
.order-detail-metrics { display: flex; justify-content: space-around; gap: 8px; margin-top: 14px; padding: 12px 6px; border: 1px solid #eceef1; border-radius: 12px; text-align: center; }
.order-detail-metrics > view { display: flex; flex-direction: column; gap: 4px; }
.order-detail-value { color: #252630; font-size: 13px; font-weight: 700; }
.order-detail-id { display: block; margin-top: 12px; color: #8a909b; font-size: 10px; text-align: center; }
.order-detail-close { width: 100%; margin-top: 14px; }
.contact-overlay { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: #1e202866; }.contact-sheet { width: 100%; max-width: 375px; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; background: #fff; text-align: center; }.contact-sheet .driver-section-title { display: block; font-size: 18px; font-weight: 700; line-height: 1.4; }.contact-name { display: block; margin-top: 0; color: #252630; font-size: 18px; font-weight: 700; line-height: 1.4; }.contact-phone { display: block; margin-top: 10px; color: #737987; font-size: 14px; font-weight: 400; line-height: 1.5; }.contact-action { margin-top: 18px; font-size: 15px; font-weight: 700; }.close-action { width: 100%; margin-top: 10px; font-size: 15px; font-weight: 700; }
</style>

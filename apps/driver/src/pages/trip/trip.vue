<script setup lang="ts">
import { onLoad, onReady, onUnload } from "@dcloudio/uni-app";
import { computed, getCurrentInstance, nextTick, ref } from "vue";
import {
  advanceOrderStage,
  driverState,
  findActiveOrder,
  TRIP_STAGE_ACTION,
  TRIP_STAGE_LABEL,
  TRIP_STAGE_ORDER,
  TRIP_STAGE_SHORT,
  type TripStage,
} from "../../driver-state";
import { mountDriverMap, type DriverMap } from "../../driver-map";

const proxy = getCurrentInstance()?.proxy;

let driverMap: DriverMap | null = null;

/** 当前在处理哪一单，由听单页或订单页带进来 */
const orderId = ref("");

const order = computed(() => (orderId.value ? findActiveOrder(orderId.value) : undefined));
const stage = computed<TripStage>(() => order.value?.stage ?? "toPickup");
const stageIndex = computed(() => TRIP_STAGE_ORDER.indexOf(stage.value));
const stageTitle = computed(() => TRIP_STAGE_LABEL[stage.value]);
const actionText = computed(() => TRIP_STAGE_ACTION[stage.value]);
const isSettling = computed(() => stage.value === "settling");
const fareText = computed(() => {
  const fare = order.value?.fare ?? 0;
  return fare.toFixed(2);
});

function goHome() {
  // 直接 reLaunch：navigateBack 在没有上一页时不会触发 fail 回调，会导致点了没反应
  uni.reLaunch({ url: "/pages/home/home" });
}

async function handleAdvance() {
  const current = order.value;
  if (!current) {
    return;
  }
  const settling = current.stage === "settling";
  // 只推进这一单，其它单不受影响
  const ok = await advanceOrderStage(current.id);
  if (!ok) {
    uni.showToast({ title: driverState.lastError || "行程推进失败", icon: "none" });
    return;
  }
  if (settling) {
    uni.showToast({ title: "收款成功", icon: "success", duration: 1200 });
    setTimeout(goHome, 900);
  }
}

function handleBack() {
  // 暂离行程页：订单保持进行中，回到「订单」→「进行中」可以继续处理
  goHome();
}

function callPassenger() {
  uni.showToast({ title: "演示环境不实际拨号", icon: "none" });
}

function messagePassenger() {
  uni.showToast({ title: "演示环境不实际发送", icon: "none" });
}

function openDetail() {
  const current = order.value;
  if (!current) {
    return;
  }
  const url = `/pages/dispatch/dispatch?id=${current.id}`;
  uni.navigateTo({
    url,
    fail: () => {
      uni.redirectTo({ url });
    },
  });
}

onLoad((options) => {
  orderId.value = typeof options?.id === "string" ? options.id : "";
});

onReady(() => {
  nextTick(() => {
    const current = order.value;
    if (!current) {
      return;
    }
    const root = proxy?.$el;
    const slot = root instanceof HTMLElement ? root.querySelector(".map-slot") : null;
    if (!(slot instanceof HTMLElement)) {
      return;
    }
    mountDriverMap(slot).then((map) => {
      driverMap = map;
      map.showRoute(
        {
          name: current.from.name,
          longitude: current.from.lngLat[0],
          latitude: current.from.lngLat[1],
        },
        {
          name: current.to.name,
          longitude: current.to.lngLat[0],
          latitude: current.to.lngLat[1],
        },
      );
    });
  });
});

onUnload(() => {
  driverMap?.destroy();
  driverMap = null;
});
</script>

<template>
  <view class="screen">
    <template v-if="order">
    <view class="topbar">
      <button class="back" hover-class="back--pressed" @tap="handleBack">
        <text class="back-glyph">‹</text>
      </button>
      <view class="topbar-copy">
        <text class="topbar-title">{{ stageTitle }}</text>
        <text class="topbar-sub">万顺 OneSoon · 司机</text>
      </view>
      <button class="detail-btn" hover-class="detail-btn--pressed" @tap="openDetail">详情</button>
    </view>

    <view class="map-area">
      <view class="map-slot" />
      <view class="map-badge">
        <image class="badge-icon" src="/static/icons/location.svg" mode="aspectFit" />
        <text class="badge-text">{{ order?.from.name || "丰都县" }}</text>
      </view>
    </view>

    <view class="sheet" :class="{ 'sheet--settle': isSettling }">
      <view class="steps">
        <view
          v-for="(item, index) in TRIP_STAGE_ORDER"
          :key="item"
          class="step"
          :class="{
            'step--done': index <= stageIndex,
            'step--current': index === stageIndex,
          }"
        >
          <view v-if="index > 0" class="step-track" />
          <view class="step-dot" />
          <text class="step-text">{{ TRIP_STAGE_SHORT[item] }}</text>
        </view>
      </view>

      <template v-if="!isSettling">
        <view class="passenger-row">
          <view class="avatar">
            <text class="avatar-text">{{ order?.passengerName?.slice(0, 1) || "乘" }}</text>
          </view>
          <view class="passenger-copy">
            <text class="passenger-name">{{ order?.passengerName || "乘客" }}</text>
            <text class="passenger-phone">{{ order?.passengerPhone || "" }}</text>
          </view>
          <view class="contact-actions">
            <button class="contact-btn" hover-class="contact-btn--pressed" @tap="messagePassenger">
              <image class="contact-icon" src="/static/icons/message.svg" mode="aspectFit" />
            </button>
            <button class="contact-btn" hover-class="contact-btn--pressed" @tap="callPassenger">
              <image class="contact-icon" src="/static/icons/phone.svg" mode="aspectFit" />
            </button>
          </view>
        </view>

        <view class="route">
          <view class="route-line">
            <view class="route-dot route-dot--start" />
            <view class="route-track" />
            <view class="route-dot route-dot--end" />
          </view>
          <view class="route-text">
            <view class="route-item">
              <text class="route-name">{{ order?.from.name }}</text>
              <text class="route-address">{{ order?.from.address }}</text>
            </view>
            <view class="route-item">
              <text class="route-name">{{ order?.to.name }}</text>
              <text class="route-address">{{ order?.to.address }}</text>
            </view>
          </view>
        </view>

        <view class="metrics">
          <view class="metric">
            <text class="metric-value">{{ order?.tripKm }}</text>
            <text class="metric-label">公里</text>
          </view>
          <view class="metric-divider" />
          <view class="metric">
            <text class="metric-value">{{ order?.tripMinutes }}</text>
            <text class="metric-label">分钟</text>
          </view>
          <view class="metric-divider" />
          <view class="metric metric--price">
            <text class="metric-value metric-value--price">¥{{ order?.fare }}</text>
            <text class="metric-label">预计车费</text>
          </view>
        </view>

        <button class="primary" hover-class="primary--pressed" @tap="handleAdvance">
          {{ actionText }}
        </button>
      </template>

      <template v-else>
        <view class="settle-head">
          <text class="settle-kicker">行程结束</text>
          <text class="settle-title">本次收入</text>
          <view class="settle-amount">
            <text class="settle-unit">¥</text>
            <text class="settle-number">{{ fareText }}</text>
          </view>
        </view>

        <view class="settle-lines">
          <view class="settle-line">
            <text class="settle-label">行程距离</text>
            <text class="settle-value">{{ order?.tripKm }} 公里</text>
          </view>
          <view class="settle-line">
            <text class="settle-label">行程时长</text>
            <text class="settle-value">{{ order?.tripMinutes }} 分钟</text>
          </view>
          <view class="settle-line">
            <text class="settle-label">乘客已支付</text>
            <text class="settle-value settle-value--ok">¥{{ fareText }}</text>
          </view>
        </view>

        <button class="primary" hover-class="primary--pressed" @tap="handleAdvance">
          确认收款
        </button>
      </template>
    </view>
    </template>

    <view v-else class="empty">
      <view class="empty-icon">
        <image class="empty-icon-image" src="/static/icons/tab-orders-active.svg" mode="aspectFit" />
      </view>
      <text class="empty-title">没有进行中的行程</text>
      <text class="empty-sub">接单后这里会显示路线、乘客信息和行程进度</text>
      <button class="empty-btn" hover-class="empty-btn--pressed" @tap="goHome">回到接单页</button>
    </view>
  </view>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #2a2a34;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  padding: 0 64rpx 120rpx;
}

.empty-icon {
  width: 136rpx;
  height: 136rpx;
  border-radius: 42rpx;
  background: rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14rpx;
}

.empty-icon-image {
  width: 62rpx;
  height: 62rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

.empty-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.65;
}

.empty-btn {
  margin-top: 44rpx;
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  padding: 0;
  border: none;
  border-radius: 46rpx;
  background: #d0121a;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
}

.empty-btn--pressed {
  background: #b01016;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx 28rpx 20rpx;
}

.back {
  width: 64rpx;
  height: 64rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.back::after {
  border: none;
}

.back--pressed {
  background: rgba(255, 255, 255, 0.22);
}

.back-glyph {
  font-size: 44rpx;
  color: #ffffff;
  line-height: 1;
  margin-top: -6rpx;
}

.topbar-copy {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.topbar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 1rpx;
}

.topbar-sub {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.45);
}

.topbar-space {
  flex: 1;
}

.detail-btn {
  flex: 1;
  margin: 0;
  padding: 0;
  height: auto;
  line-height: 1.4;
  text-align: right;
  background: transparent;
  border: none;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.62);
}

.detail-btn::after {
  border: none;
}

.detail-btn--pressed {
  color: rgba(255, 255, 255, 0.9);
}

.map-area {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0 24rpx;
  border-radius: 26rpx;
  overflow: hidden;
  background: #e8eaed;
}

.map-slot {
  position: absolute;
  inset: 0;
}

.map-badge {
  position: absolute;
  left: 20rpx;
  top: 20rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(42, 42, 52, 0.78);
  backdrop-filter: blur(6px);
}

.badge-icon {
  width: 26rpx;
  height: 26rpx;
}

.badge-text {
  font-size: 21rpx;
  color: #ffffff;
}

.sheet {
  margin: 20rpx 0 0;
  padding: 30rpx 32rpx calc(26rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #ffffff;
  box-shadow: 0 -14rpx 40rpx rgba(0, 0, 0, 0.18);
}

.sheet--settle {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}

.steps {
  display: flex;
  padding-bottom: 24rpx;
  margin-bottom: 24rpx;
  border-bottom: 1rpx solid #f2eded;
}

.step {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-track {
  position: absolute;
  top: 7rpx;
  right: 50%;
  width: 100%;
  height: 2rpx;
  background: #ece7e7;
}

.step--done .step-track {
  background: #f3b9bc;
}

.step-dot {
  position: relative;
  z-index: 2;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #e2dede;
}

.step--done .step-dot {
  background: #d0121a;
}

.step--current .step-dot {
  box-shadow: 0 0 0 6rpx rgba(208, 18, 26, 0.18);
}

.step-text {
  margin-top: 10rpx;
  font-size: 20rpx;
  color: #b0b4bb;
}

.step--done .step-text {
  color: #6a7078;
}

.step--current .step-text {
  color: #d0121a;
  font-weight: 600;
}

.passenger-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.avatar {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: #fdeef0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #d0121a;
}

.passenger-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.passenger-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.passenger-phone {
  font-size: 22rpx;
  color: #8a8f99;
}

.contact-actions {
  display: flex;
  gap: 14rpx;
}

.contact-btn {
  width: 72rpx;
  height: 72rpx;
  padding: 0;
  margin: 0;
  border-radius: 50%;
  background: #2a2a34;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.contact-btn::after {
  border: none;
}

.contact-btn--pressed {
  background: #41414d;
}

.contact-icon {
  width: 34rpx;
  height: 34rpx;
}

.route {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 20rpx;
  background: #faf8f8;
}

.route-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10rpx;
  width: 18rpx;
  flex-shrink: 0;
}

.route-dot {
  width: 13rpx;
  height: 13rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.route-dot--start {
  background: #1aae5a;
}

.route-dot--end {
  background: #d0121a;
}

.route-track {
  width: 2rpx;
  flex: 1;
  margin: 8rpx 0;
  background: repeating-linear-gradient(
    to bottom,
    #c9d0d6 0,
    #c9d0d6 8rpx,
    transparent 8rpx,
    transparent 16rpx
  );
}

.route-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.route-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.route-name {
  font-size: 27rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.route-address {
  font-size: 21rpx;
  color: #9aa0a6;
  line-height: 1.4;
}

.metrics {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
  padding: 18rpx 0;
  border-radius: 18rpx;
  background: #fdf4f5;
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.metric-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.1;
}

.metric-value--price {
  color: #d0121a;
}

.metric-label {
  font-size: 20rpx;
  color: #8a8f99;
}

.metric-divider {
  width: 1rpx;
  height: 38rpx;
  background: #f0dedf;
}

.primary {
  width: 100%;
  height: 100rpx;
  line-height: 100rpx;
  margin-top: 26rpx;
  border-radius: 50rpx;
  background: #d0121a;
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
  border: none;
  box-shadow: 0 12rpx 28rpx rgba(208, 18, 26, 0.26);
}

.primary::after {
  border: none;
}

.primary--pressed {
  background: #b30f16;
}

.settle-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding-top: 6rpx;
}

.settle-kicker {
  font-size: 22rpx;
  color: #8a8f99;
  letter-spacing: 4rpx;
}

.settle-title {
  font-size: 28rpx;
  color: #3c4149;
}

.settle-amount {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  margin-top: 6rpx;
}

.settle-unit {
  font-size: 32rpx;
  color: #d0121a;
}

.settle-number {
  font-size: 76rpx;
  font-weight: 700;
  color: #d0121a;
  line-height: 1;
  letter-spacing: -1rpx;
}

.settle-lines {
  margin-top: 28rpx;
  padding: 22rpx 24rpx;
  border-radius: 20rpx;
  background: #faf8f8;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.settle-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settle-label {
  font-size: 24rpx;
  color: #8a8f99;
}

.settle-value {
  font-size: 24rpx;
  color: #3c4149;
  font-weight: 500;
}

.settle-value--ok {
  color: #1aae5a;
}
</style>

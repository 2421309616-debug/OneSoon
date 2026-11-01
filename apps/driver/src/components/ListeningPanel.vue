<script setup lang="ts">
import { ref } from "vue";
import {
  TRIP_STAGE_LABEL,
  TRIP_STAGE_ORDER,
  TRIP_STAGE_SHORT,
  type ActiveOrder,
  type PoolOrder,
  type TripStage,
} from "../driver-state";import type { TripOrder } from "../mock-orders";

/** 进行中列表是否收起：手上的单占满时，可以把空间让给下面的新订单 */
const collapsed = ref(false);

defineProps<{
  income: string;
  onlineText: string;
  orderCount: number;
  orders: ActiveOrder[];
  pool: PoolOrder[];
}>();

const emit = defineEmits<{
  (event: "offline"): void;
  (event: "open", order: TripOrder): void;
  (event: "resume", orderId: string): void;
}>();

/** 当前阶段在四步里的下标 */
function stageIndex(stage: TripStage) {
  return TRIP_STAGE_ORDER.indexOf(stage);
}

/** 今日收入 → 营收情况 */
function goEarnings() {
  uni.navigateTo({
    url: "/pages/earnings/earnings",
    fail: () => {
      uni.reLaunch({ url: "/pages/earnings/earnings" });
    },
  });
}

/** 今日完单 → 订单页的「已完成」 */
function goDoneOrders() {
  const url = "/pages/orders/orders?tab=done";
  uni.navigateTo({
    url,
    fail: () => {
      uni.reLaunch({ url });
    },
  });
}
</script>

<template>
  <view class="listening">
    <view class="listening-head">
      <view class="brand">
        <text class="brand-cn">万顺</text>
        <text class="brand-en">OneSoon · 司机</text>
      </view>
      <view class="live-pill">
        <view class="live-dot" />
        <text class="live-text">听单中</text>
      </view>
    </view>

    <view class="summary">
      <view
        class="summary-item summary-item--link"
        role="button"
        hover-class="summary-item--pressed"
        @tap="goEarnings"
      >
        <text class="summary-label">今日收入</text>
        <text class="summary-value">¥{{ income }}</text>
      </view>
      <view class="summary-divider" />
      <view class="summary-item">
        <text class="summary-label">服务时长</text>
        <text class="summary-value">{{ onlineText }} 小时</text>
      </view>
      <view class="summary-divider" />
      <view
        class="summary-item summary-item--link"
        role="button"
        hover-class="summary-item--pressed"
        @tap="goDoneOrders"
      >
        <text class="summary-label">今日完单</text>
        <text class="summary-value">{{ orderCount }} 单</text>
      </view>
    </view>

    <scroll-view class="page-scroll" :scroll-y="true">
    <view v-if="orders.length" class="active-block">
      <view class="active-head" role="button" @tap="collapsed = !collapsed">
        <text class="active-title">进行中</text>
        <view class="active-toggle">
          <text class="active-count">{{ orders.length }} 单</text>
          <image
            class="active-arrow"
            :class="{ 'active-arrow--collapsed': collapsed }"
            src="/static/icons/chevron-right.svg"
            mode="aspectFit"
          />
        </view>
      </view>

      <view
        v-for="item in orders"
        v-show="!collapsed"
        :key="item.id"
        class="active-card"
        hover-class="active-card--pressed"
        role="button"
        @tap="emit('resume', item.id)"
      >
        <view class="active-top">
          <view class="active-badge">
            <view class="active-badge-dot" />
            <text class="active-badge-text">{{ TRIP_STAGE_LABEL[item.stage] }}</text>
          </view>
          <text class="active-fare">¥{{ item.fare }}</text>
        </view>

        <view class="active-route">
          <view class="route-node">
            <view class="node-dot node-dot--start" />
            <text class="node-name">{{ item.from.name }}</text>
          </view>
          <view class="route-track" />
          <view class="route-node">
            <view class="node-dot node-dot--end" />
            <text class="node-name">{{ item.to.name }}</text>
          </view>
        </view>

        <view class="steps">
          <view
            v-for="(stage, index) in TRIP_STAGE_ORDER"
            :key="stage"
            class="step"
            :class="{
              'step--done': index <= stageIndex(item.stage),
              'step--current': index === stageIndex(item.stage),
            }"
          >
            <view v-if="index > 0" class="step-track" />
            <view class="step-dot" />
            <text class="step-text">{{ TRIP_STAGE_SHORT[stage] }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="pool.length" class="pool-head">
      <text class="pool-title">{{ orders.length ? "更多订单" : "附近订单" }}</text>
      <text class="pool-count">{{ pool.length }} 单待接</text>
    </view>

      <view class="pool">
      <view v-if="!pool.length && !orders.length" class="empty">
        <view class="empty-radar">
          <view class="empty-ring empty-ring--1" />
          <view class="empty-ring empty-ring--2" />
          <view class="empty-core">
            <image class="empty-icon" src="/static/icons/location.svg" mode="aspectFit" />
          </view>
        </view>
        <text class="empty-title">正在为你寻找附近订单</text>
        <text class="empty-sub">附近 12 公里 · 有新订单会立刻提醒</text>
      </view>

      <view
        v-for="item in pool"
        :key="item.id"
        class="order-card"
        hover-class="order-card--pressed"
        role="button"
        @tap="emit('open', item)"
      >
        <view class="order-card-head">
          <view class="order-badge">
            <view class="order-badge-dot" />
            <text class="order-badge-text">新订单</text>
          </view>
          <text class="order-countdown">{{ item.expiresIn > 0 ? `剩余 ${item.expiresIn} 秒` : "待接单" }}</text>
        </view>

        <view class="order-route">
          <view class="route-node">
            <view class="node-dot node-dot--start" />
            <text class="node-name">{{ item.from.name }}</text>
          </view>
          <view class="route-track" />
          <view class="route-node">
            <view class="node-dot node-dot--end" />
            <text class="node-name">{{ item.to.name }}</text>
          </view>
        </view>

        <view class="order-foot">
          <text class="order-meta">接驾 {{ item.pickupKm }}km · 行程 {{ item.tripKm }}km</text>
          <text class="order-fare">¥{{ item.fare }}</text>
        </view>
      </view>

      <view v-if="pool.length" class="pool-more">
        <view class="pool-more-dot" />
        <text class="pool-more-text">正在刷新附近订单…</text>
      </view>

      <view v-else-if="orders.length" class="pool-more pool-more--solo">
        <view class="pool-more-dot" />
        <text class="pool-more-text">正在刷新附近订单…</text>
      </view>

      <view class="pool-space" />
      </view>
    </scroll-view>

    <view class="listening-action">
      <button class="go-offline" hover-class="go-offline--pressed" @tap="emit('offline')">
        收车
      </button>
      <text class="listening-hint">收车后将不再接收新订单</text>
    </view>
  </view>
</template>

<style scoped>
.listening {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #2a2a34;
}

.listening-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 36rpx 0;
  box-sizing: border-box;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.brand-cn {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.brand-en {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.55);
}

.live-pill {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: rgba(208, 18, 26, 0.18);
}

.live-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #ff4d55;
  animation: blink 1.4s ease-in-out infinite;
}

.live-text {
  font-size: 23rpx;
  color: #ff7a80;
  letter-spacing: 1rpx;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}

.summary {
  margin: 26rpx 36rpx 0;
  padding: 22rpx 12rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

/* 可点击的统计项（今日收入 / 今日完单） */
.summary-item--link {
  transition: opacity 0.15s ease;
}

.summary-item--pressed {
  opacity: 0.5;
}

.summary-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.45);
}

.summary-value {
  font-size: 27rpx;
  font-weight: 600;
  color: #ffffff;
}

.summary-divider {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255, 255, 255, 0.12);
}

.active-block {
  margin: 26rpx 36rpx 0;
}

.active-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.active-toggle {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.active-arrow {
  width: 22rpx;
  height: 22rpx;
  opacity: 0.75;
  /* 展开时箭头朝下，收起时朝右 */
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.active-arrow--collapsed {
  transform: rotate(0deg);
}

.active-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.active-count {
  font-size: 22rpx;
  color: #ff7a80;
}

.active-card {
  margin-bottom: 16rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: #ffffff;
}

.active-card--pressed {
  background: #f7f1f1;
}

.active-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.active-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(208, 18, 26, 0.1);
}

.active-badge-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #d0121a;
  animation: blink 1.4s ease-in-out infinite;
}

.active-badge-text {
  font-size: 20rpx;
  color: #d0121a;
  letter-spacing: 1rpx;
}

.active-fare {
  font-size: 32rpx;
  font-weight: 700;
  color: #d0121a;
}

.active-route {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.active-route .node-name {
  color: #1a1a1a;
  font-size: 28rpx;
}

.active-route .route-track {
  background: #ece7e7;
}

.steps {
  margin-top: 18rpx;
  display: flex;
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
  font-size: 19rpx;
  color: #b0b4bb;
}

.step--done .step-text {
  color: #6a7078;
}

.step--current .step-text {
  color: #d0121a;
  font-weight: 600;
}

.pool-head {
  margin: 28rpx 36rpx 16rpx;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.pool-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.pool-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
}

/* 整页滚动：进行中和更多订单作为一整块上下滑动 */
.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.pool {
  padding: 0 36rpx;
  box-sizing: border-box;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 60rpx;
}

.empty-radar {
  position: relative;
  width: 240rpx;
  height: 240rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-core {
  position: relative;
  z-index: 2;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: #d0121a;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 12rpx rgba(208, 18, 26, 0.16), 0 12rpx 32rpx rgba(208, 18, 26, 0.32);
}

.empty-icon {
  width: 48rpx;
  height: 48rpx;
}

.empty-ring {
  position: absolute;
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(208, 18, 26, 0.5);
  animation: ripple 2.8s ease-out infinite;
}

.empty-ring--2 {
  animation-delay: 1.4s;
}

@keyframes ripple {
  0% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  100% {
    transform: scale(2.1);
    opacity: 0;
  }
}

.empty-title {
  margin-top: 36rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 1rpx;
}

.empty-sub {
  margin-top: 12rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.42);
}

.order-card {
  margin-bottom: 20rpx;
  padding: 24rpx 26rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.06);
}

.order-card--pressed {
  background: rgba(255, 255, 255, 0.14);
}

.order-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.order-badge-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #ff4d55;
  animation: blink 1.4s ease-in-out infinite;
}

.order-badge-text {
  font-size: 21rpx;
  color: #ff7a80;
  letter-spacing: 1rpx;
}

.order-countdown {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.4);
}

.order-route {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.route-node {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.node-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.node-dot--start {
  background: #1aae5a;
}

.node-dot--end {
  background: #d0121a;
}

.node-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.route-track {
  width: 2rpx;
  height: 22rpx;
  margin-left: 6rpx;
  background: rgba(255, 255, 255, 0.18);
}

.order-foot {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-meta {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
}

.order-fare {
  font-size: 32rpx;
  font-weight: 700;
  color: #ff7a80;
}

.pool-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 26rpx 0 8rpx;
}

.pool-more-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  animation: blink 1.4s ease-in-out infinite;
}

.pool-more-text {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.32);
}

/* 手上有单、附近暂时没单时，只留一行刷新提示，不再显示大雷达 */
.pool-more--solo {
  padding: 60rpx 0 8rpx;
}

.pool-space {
  height: 20rpx;
}

.listening-action {
  width: 100%;
  padding: 16rpx 36rpx calc(150rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.go-offline {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 46rpx;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 6rpx;
  border: none;
}

.go-offline::after {
  border: none;
}

.go-offline--pressed {
  background: rgba(255, 255, 255, 0.2);
}

.listening-hint {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.35);
}
</style>

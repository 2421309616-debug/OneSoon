<script setup lang="ts">
import { computed } from "vue";
import type { TripOrder } from "../mock-orders";

const props = withDefaults(
  defineProps<{
    order: TripOrder;
    seconds?: number;
    total?: number;
    /** offer：抢单弹层；detail：只读详情 */
    mode?: "offer" | "detail";
  }>(),
  {
    seconds: 0,
    total: 30,
    mode: "offer",
  },
);

const emit = defineEmits<{
  (event: "accept"): void;
  (event: "reject"): void;
  (event: "close"): void;
}>();

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const isOffer = computed(() => props.mode === "offer");

/** 乘客评分（演示数据缺省 4.9） */
const passengerScore = computed(() => (props.order.passengerRating ?? 4.9).toFixed(1));

const dashOffset = computed(() => {
  const total = props.total || 1;
  const ratio = Math.max(0, Math.min(1, props.seconds / total));
  return CIRCUMFERENCE * (1 - ratio);
});
</script>

<template>
  <view class="offer-mask">
    <view class="offer-card">
      <view class="offer-top">
        <view v-if="isOffer && seconds > 0" class="countdown">
          <svg class="countdown-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#F2EDED" stroke-width="7" />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#D0121A"
              stroke-width="7"
              stroke-linecap="round"
              :stroke-dasharray="CIRCUMFERENCE"
              :stroke-dashoffset="dashOffset"
              transform="rotate(-90 50 50)"
            />
          </svg>
          <view class="countdown-text">
            <text class="countdown-number">{{ seconds }}</text>
            <text class="countdown-unit">秒</text>
          </view>
        </view>
        <view v-else class="detail-badge">
          <image class="detail-badge-icon" src="/static/icons/order.svg" mode="aspectFit" />
        </view>
        <view class="offer-head-copy">
          <text class="offer-kicker">{{ isOffer ? "新订单" : "订单详情" }}</text>
          <text class="offer-title">
            距您 {{ order.pickupKm }} 公里 · 约 {{ order.pickupMinutes }} 分钟到达
          </text>
        </view>
        <view v-if="!isOffer" class="detail-close" role="button" @tap="emit('close')">
          <image class="detail-close-icon" src="/static/icons/close.svg" mode="aspectFit" />
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
            <text class="route-name">{{ order.from.name }}</text>
            <text class="route-address">{{ order.from.address }}</text>
          </view>
          <view class="route-item">
            <text class="route-name">{{ order.to.name }}</text>
            <text class="route-address">{{ order.to.address }}</text>
          </view>
        </view>
      </view>

      <view class="metrics">
        <view class="metric">
          <text class="metric-value">{{ order.tripKm }}</text>
          <text class="metric-label">公里</text>
        </view>
        <view class="metric-divider" />
        <view class="metric">
          <text class="metric-value">{{ order.tripMinutes }}</text>
          <text class="metric-label">分钟</text>
        </view>
        <view class="metric-divider" />
        <view class="metric metric--price">
          <text class="metric-value metric-value--price">¥{{ order.fare }}</text>
          <text class="metric-label">预估车费</text>
        </view>
      </view>

      <view v-if="order.note" class="note">
        <text class="note-label">乘客备注</text>
        <text class="note-text">{{ order.note }}</text>
      </view>

      <view class="passenger-line">
        <view class="passenger-main">
          <text class="passenger-label">乘客</text>
          <text class="passenger-name">{{ order.passengerName }}</text>
          <text class="passenger-phone">{{ order.passengerPhone }}</text>
        </view>
        <view class="passenger-rating">
          <image class="rating-star" src="/static/icons/star.svg" mode="aspectFit" />
          <text class="rating-text">{{ passengerScore }}</text>
        </view>
      </view>

      <view v-if="isOffer" class="offer-actions">
        <button class="btn-reject" hover-class="btn-reject--pressed" @tap="emit('reject')">
          忽略
        </button>
        <button class="btn-accept" hover-class="btn-accept--pressed" @tap="emit('accept')">
          立即接单
        </button>
      </view>
      <view v-else class="offer-actions">
        <button class="btn-reject" hover-class="btn-reject--pressed" @tap="emit('close')">
          关闭
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.offer-mask {
  position: fixed;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: flex-end;
  background: rgba(20, 20, 24, 0.62);
}

.offer-card {
  width: 100%;
  padding: 34rpx 36rpx calc(30rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  border-radius: 36rpx 36rpx 0 0;
  background: #ffffff;
  animation: rise 0.28s ease-out;
}

@keyframes rise {
  from {
    transform: translateY(40rpx);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.offer-top {
  display: flex;
  align-items: center;
  gap: 26rpx;
}

.countdown {
  position: relative;
  width: 116rpx;
  height: 116rpx;
  flex-shrink: 0;
}

.countdown-svg {
  width: 100%;
  height: 100%;
}

.countdown-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.countdown-number {
  font-size: 40rpx;
  font-weight: 700;
  color: #d0121a;
  line-height: 1;
}

.countdown-unit {
  font-size: 16rpx;
  color: #d0121a;
  line-height: 1;
  margin-top: 4rpx;
}

.offer-head-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.detail-badge {
  width: 96rpx;
  height: 96rpx;
  border-radius: 26rpx;
  background: #fdecee;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-badge-icon {
  width: 52rpx;
  height: 52rpx;
}

.detail-close {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #f4f1f1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-close-icon {
  width: 26rpx;
  height: 26rpx;
}

.offer-kicker {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 2rpx;
}

.offer-title {
  font-size: 24rpx;
  color: #8a8f99;
}

.route {
  display: flex;
  gap: 20rpx;
  margin-top: 30rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: #faf8f8;
}

.route-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 10rpx;
  width: 20rpx;
  flex-shrink: 0;
}

.route-dot {
  width: 14rpx;
  height: 14rpx;
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
  gap: 26rpx;
}

.route-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.route-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.route-address {
  font-size: 22rpx;
  color: #9aa0a6;
  line-height: 1.4;
}

.metrics {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 20rpx 0;
  border-radius: 20rpx;
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
  font-size: 34rpx;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.1;
}

.metric-value--price {
  color: #d0121a;
}

.metric-label {
  font-size: 21rpx;
  color: #8a8f99;
}

.metric-divider {
  width: 1rpx;
  height: 40rpx;
  background: #f0dedf;
}

.note {
  margin-top: 20rpx;
  display: flex;
  gap: 12rpx;
  align-items: baseline;
}

.note-label {
  font-size: 21rpx;
  color: #b08a3e;
  background: #fdf6e7;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.note-text {
  font-size: 23rpx;
  color: #3c4149;
  line-height: 1.5;
}

.passenger-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f2eded;
}

.passenger-main {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.passenger-label {
  font-size: 21rpx;
  color: #b0b4bb;
  background: #f5f3f3;
  border-radius: 6rpx;
  padding: 3rpx 10rpx;
}

.passenger-name {
  font-size: 25rpx;
  color: #1a1a1a;
  font-weight: 600;
}

.passenger-phone {
  font-size: 23rpx;
  color: #8a8f99;
}

.passenger-rating {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.rating-star {
  width: 24rpx;
  height: 24rpx;
}

.rating-text {
  font-size: 21rpx;
  color: #b08a3e;
}

.offer-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.btn-reject,
.btn-accept {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 48rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
}

.btn-reject::after,
.btn-accept::after {
  border: none;
}

.btn-reject {
  flex: 0 0 30%;
  background: #f4f1f1;
  color: #6b7079;
}

.btn-reject--pressed {
  background: #ebe6e6;
}

.btn-accept {
  background: #d0121a;
  color: #ffffff;
  letter-spacing: 4rpx;
  box-shadow: 0 12rpx 28rpx rgba(208, 18, 26, 0.28);
}

.btn-accept--pressed {
  background: #b30f16;
}
</style>

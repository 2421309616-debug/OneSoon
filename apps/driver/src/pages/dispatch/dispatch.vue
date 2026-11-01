<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { cancelActiveOrder, findActiveOrder, TRIP_STAGE_LABEL } from "../../driver-state";

const orderId = ref("");

const order = computed(() => (orderId.value ? findActiveOrder(orderId.value) : undefined));
const phaseLabel = computed(() => (order.value ? TRIP_STAGE_LABEL[order.value.stage] : ""));

onLoad((options) => {
  orderId.value = typeof options?.id === "string" ? options.id : "";
});

function goBack() {
  uni.navigateBack({
    fail: () => {
      uni.redirectTo({ url: "/pages/home/home" });
    },
  });
}

function callPassenger() {
  uni.showToast({ title: "演示环境不实际拨号", icon: "none" });
}

function cancelOrder() {
  uni.showModal({
    title: "取消订单",
    content: "这一单会放回订单池，其它司机可以继续接，其它单不受影响。",
    confirmText: "确认取消",
    confirmColor: "#D0121A",
    success: ({ confirm }) => {
      if (!confirm) {
        return;
      }
      void cancelActiveOrder(orderId.value).then((ok) => {
        if (!ok) {
          uni.showToast({ title: "取消失败，请重试", icon: "none" });
          return;
        }
        uni.showToast({ title: "已放回订单池", icon: "none" });
        uni.reLaunch({ url: "/pages/home/home" });
      });
    },
  });
}
</script>

<template>
  <view class="screen">
    <view class="topbar">
      <button class="back" hover-class="back--pressed" @tap="goBack">
        <text class="back-glyph">‹</text>
      </button>
      <text class="topbar-title">订单详情</text>
      <view class="topbar-space" />
    </view>

    <scroll-view class="body" scroll-y>
      <view class="status-card">
        <text class="status-label">当前状态</text>
        <text class="status-value">{{ phaseLabel }}</text>
      </view>

      <view class="card">
        <view class="card-title">乘客信息</view>
        <view class="passenger">
          <view class="avatar">
            <text class="avatar-text">{{ order?.passengerName?.slice(0, 1) || "乘" }}</text>
          </view>
          <view class="passenger-copy">
            <text class="passenger-name">{{ order?.passengerName }}</text>
            <text class="passenger-phone">{{ order?.passengerPhone }}</text>
          </view>
          <button class="call" hover-class="call--pressed" @tap="callPassenger">
            <image class="call-icon" src="/static/icons/phone.svg" mode="aspectFit" />
            <text class="call-text">联系</text>
          </button>
        </view>
      </view>

      <view class="card">
        <view class="card-title">行程信息</view>
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

        <view class="lines">
          <view class="line">
            <text class="line-label">接驾距离</text>
            <text class="line-value">{{ order?.pickupKm }} 公里 · 约 {{ order?.pickupMinutes }} 分钟</text>
          </view>
          <view class="line">
            <text class="line-label">行程距离</text>
            <text class="line-value">{{ order?.tripKm }} 公里 · 约 {{ order?.tripMinutes }} 分钟</text>
          </view>
          <view class="line">
            <text class="line-label">预估车费</text>
            <text class="line-value line-value--price">¥{{ order?.fare }}.00</text>
          </view>
          <view class="line">
            <text class="line-label">订单编号</text>
            <text class="line-value line-value--mono">{{ order?.id }}</text>
          </view>
        </view>
      </view>

      <view v-if="order?.note" class="card">
        <view class="card-title">乘客备注</view>
        <text class="note">{{ order.note }}</text>
      </view>

      <button class="danger" hover-class="danger--pressed" @tap="cancelOrder">取消订单</button>

      <view class="bottom-space" />
    </scroll-view>
  </view>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f2f3f5;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx 28rpx 20rpx;
  background: #2a2a34;
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

.topbar-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

.topbar-space {
  flex: 1;
}

.body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
  padding: 26rpx 28rpx;
  border-radius: 24rpx;
  background: #2a2a34;
}

.status-label {
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.45);
}

.status-value {
  font-size: 28rpx;
  font-weight: 600;
  color: #ff7a80;
}

.card {
  margin-bottom: 22rpx;
  padding: 26rpx 28rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 6rpx 20rpx rgba(26, 26, 26, 0.04);
}

.card-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 20rpx;
}

.passenger {
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
  font-size: 29rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.passenger-phone {
  font-size: 22rpx;
  color: #8a8f99;
}

.call {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin: 0;
  padding: 14rpx 24rpx;
  height: auto;
  line-height: 1.2;
  border-radius: 999rpx;
  background: #2a2a34;
  border: none;
}

.call::after {
  border: none;
}

.call--pressed {
  background: #41414d;
}

.call-icon {
  width: 28rpx;
  height: 28rpx;
}

.call-text {
  font-size: 23rpx;
  color: #ffffff;
}

.route {
  display: flex;
  gap: 18rpx;
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

.lines {
  margin-top: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.line-label {
  font-size: 24rpx;
  color: #8a8f99;
}

.line-value {
  font-size: 24rpx;
  color: #3c4149;
  font-weight: 500;
}

.line-value--price {
  color: #d0121a;
  font-weight: 600;
}

.line-value--mono {
  font-size: 20rpx;
  color: #9aa0a6;
  font-weight: 400;
}

.note {
  font-size: 24rpx;
  line-height: 1.7;
  color: #3c4149;
}

.danger {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  margin-top: 8rpx;
  border-radius: 24rpx;
  background: #ffffff;
  color: #d0121a;
  font-size: 27rpx;
  border: none;
}

.danger::after {
  border: none;
}

.danger--pressed {
  background: #fdf4f5;
}

.bottom-space {
  height: 60rpx;
}
</style>

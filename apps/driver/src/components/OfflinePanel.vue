<script setup lang="ts">
import type { NoticeItem } from "../mock-orders";

defineProps<{
  income: string;
  onlineText: string;
  orderCount: number;
  notices: NoticeItem[];
}>();

const emit = defineEmits<{
  (event: "online"): void;
}>();

function openNotice(notice: NoticeItem) {
  uni.showModal({
    title: notice.title,
    content: notice.body,
    showCancel: false,
    confirmText: "知道了",
    confirmColor: "#D0121A",
  });
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
  <view class="offline">
    <view class="offline-head">
      <view class="brand">
        <text class="brand-cn">万顺</text>
        <text class="brand-en">OneSoon · 司机</text>
      </view>
      <view class="head-status">
        <view class="status-dot" />
        <text class="status-text">尚未出车</text>
      </view>
    </view>

    <view class="stat-card">
      <view class="stat-row">
        <view
          class="stat-block stat-block--link"
          role="button"
          hover-class="stat-block--pressed"
          @tap="goEarnings"
        >
          <text class="stat-label">今日收入</text>
          <view class="stat-value">
            <text class="stat-unit">¥</text>
            <text class="stat-number">{{ income }}</text>
          </view>
        </view>
        <view class="stat-divider" />
        <view class="stat-block">
          <text class="stat-label">服务时长</text>
          <view class="stat-value">
            <text class="stat-number">{{ onlineText }}</text>
            <text class="stat-unit">小时</text>
          </view>
        </view>
        <view class="stat-divider" />
        <view
          class="stat-block stat-block--link"
          role="button"
          hover-class="stat-block--pressed"
          @tap="goDoneOrders"
        >
          <text class="stat-label">今日完单</text>
          <view class="stat-value">
            <text class="stat-number">{{ orderCount }}</text>
            <text class="stat-unit">单</text>
          </view>
        </view>
      </view>

      <view class="stat-meta">
        <view class="meta-row">
          <text class="meta-label">听单范围</text>
          <text class="meta-value">12 公里</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">听单偏好</text>
          <text class="meta-value">不限车型 · 全部订单</text>
        </view>
        <view class="meta-row">
          <text class="meta-label">预约时段</text>
          <text class="meta-value">全天可接</text>
        </view>
      </view>
    </view>

    <scroll-view class="notice-scroll" scroll-y>
      <view class="section-title">
        <text class="section-title-text">系统消息</text>
        <text class="section-title-count">{{ notices.length }}</text>
      </view>

      <view
        v-for="notice in notices"
        :key="notice.id"
        class="notice-card"
        role="button"
        hover-class="notice-card--pressed"
        @tap="openNotice(notice)"
      >
        <view class="notice-head">
          <text class="notice-title">{{ notice.title }}</text>
          <text class="notice-time">{{ notice.time }}</text>
        </view>
        <text class="notice-body">{{ notice.body }}</text>
        <image v-if="notice.image" class="notice-image" :src="notice.image" mode="aspectFill" />
      </view>
    </scroll-view>

    <view class="offline-action">
      <button class="go-online" hover-class="go-online--pressed" @tap="emit('online')">
        立即接单
      </button>
      <text class="offline-hint">开启后附近订单会实时推送到列表</text>
    </view>
  </view>
</template>

<style scoped>
.offline {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #2a2a34;
}

.offline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 36rpx 20rpx;
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
  letter-spacing: 1rpx;
}

.head-status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.1);
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #8a8f99;
}

.status-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.78);
}

.stat-card {
  margin: 8rpx 28rpx 0;
  padding: 32rpx 28rpx 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(0, 0, 0, 0.18);
}

.stat-row {
  display: flex;
  align-items: stretch;
}

.stat-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

/* 可点击的统计项（今日收入 / 今日完单） */
.stat-block--link {
  transition: opacity 0.15s ease;
}

.stat-block--pressed {
  opacity: 0.5;
}

.stat-label {
  font-size: 22rpx;
  color: #8a8f99;
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.stat-unit {
  font-size: 22rpx;
  color: #3c4149;
}

.stat-number {
  font-size: 44rpx;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.1;
}

.stat-divider {
  width: 1rpx;
  margin: 4rpx 20rpx;
  background: #ece7e7;
}

.stat-meta {
  margin-top: 26rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f2eded;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.meta-label {
  font-size: 24rpx;
  color: #8a8f99;
}

.meta-value {
  font-size: 24rpx;
  color: #3c4149;
  font-weight: 500;
}

.notice-scroll {
  flex: 1;
  min-height: 0;
  margin-top: 26rpx;
  padding: 0 28rpx;
  box-sizing: border-box;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 0 8rpx 16rpx;
}

.section-title-text {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
}

.section-title-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
}

.notice-card {
  margin-bottom: 18rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.07);
}

.notice-card--pressed {
  background: rgba(255, 255, 255, 0.12);
}

.notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.notice-title {
  flex: 1;
  font-size: 27rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-time {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.4);
}

.notice-body {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.55);
}

.notice-image {
  width: 100%;
  height: 200rpx;
  margin-top: 16rpx;
  border-radius: 16rpx;
}

.offline-action {
  padding: 20rpx 36rpx calc(24rpx + env(safe-area-inset-bottom));
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.go-online {
  width: 100%;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: 50rpx;
  background: #d0121a;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
  letter-spacing: 6rpx;
  border: none;
}

.go-online::after {
  border: none;
}

.go-online--pressed {
  background: #b30f16;
}

.offline-hint {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.38);
}
</style>

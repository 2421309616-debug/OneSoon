<script setup lang="ts">
import { computed, onMounted } from "vue";
import { driverState, todayIncomeText, todayOnlineText } from "../../driver-state";
import { requireDriver } from "../../driver-session";

/** 近 7 日：前 6 天是演示数据，今天用真实收入 */
const WEEK_BASE = [
  { day: "一", value: 168 },
  { day: "二", value: 232 },
  { day: "三", value: 195 },
  { day: "四", value: 286 },
  { day: "五", value: 315 },
  { day: "六", value: 402 },
];

const weekData = computed(() => [
  ...WEEK_BASE,
  { day: "日", value: Math.round(driverState.stats.income) },
]);

const maxValue = computed(() => Math.max(...weekData.value.map((item) => item.value), 1));
const income = computed(() => todayIncomeText());
const onlineText = computed(() => todayOnlineText());
const weekTotal = computed(() => weekData.value.reduce((sum, item) => sum + item.value, 0));

/** 近期订单：新完成的排最前，只展示真实完成记录 */
const recentOrders = computed(() => driverState.completed.slice(0, 6));

function barHeight(value: number) {
  const ratio = value / maxValue.value;
  return `${Math.round(28 + ratio * 130)}rpx`;
}

function withdraw() {
  uni.showToast({ title: "演示环境，未接入提现", icon: "none" });
}

function goBack() {
  // H5 下没有上一页时 navigateBack 不会触发 fail，先自己判断栈深
  if (getCurrentPages().length > 1) {
    uni.navigateBack({ delta: 1 });
    return;
  }
  uni.reLaunch({ url: "/pages/profile/profile" });
}

onMounted(() => {
  requireDriver();
});
</script>

<template>
  <view class="screen">
    <view class="head">
      <view class="head-top">
        <view class="head-back" role="button" @tap="goBack">
          <image class="back-icon" src="/static/icons/chevron-right.svg" mode="aspectFit" />
        </view>
        <text class="head-title">营收情况</text>
        <button class="withdraw" hover-class="withdraw--pressed" @tap="withdraw">提现</button>
      </view>
      <text class="head-label">今日收入（元）</text>
      <view class="head-amount">
        <text class="head-unit">¥</text>
        <text class="head-number">{{ income }}</text>
      </view>
      <view class="head-meta">
        <view class="head-meta-item">
          <text class="head-meta-value">{{ driverState.stats.orders }}</text>
          <text class="head-meta-label">今日完单</text>
        </view>
        <view class="head-meta-divider" />
        <view class="head-meta-item">
          <text class="head-meta-value">{{ onlineText }}</text>
          <text class="head-meta-label">服务时长(小时)</text>
        </view>
        <view class="head-meta-divider" />
        <view class="head-meta-item">
          <text class="head-meta-value">4.9</text>
          <text class="head-meta-label">服务评分</text>
        </view>
      </view>
    </view>

    <scroll-view class="body" scroll-y>
      <view class="card">
        <view class="card-head">
          <text class="card-title">近 7 日收入</text>
          <text class="card-total">合计 ¥{{ weekTotal }}</text>
        </view>
        <view class="chart">
          <view class="chart-row chart-row--values">
            <text
              v-for="(item, index) in weekData"
              :key="`v-${item.day}`"
              class="chart-value"
              :class="{ 'chart-value--today': index === weekData.length - 1 }"
            >
              {{ item.value }}
            </text>
          </view>
          <view class="chart-row chart-row--bars">
            <view v-for="(item, index) in weekData" :key="`b-${item.day}`" class="chart-bar-slot">
              <view
                class="chart-bar"
                :class="{ 'chart-bar--today': index === weekData.length - 1 }"
                :style="{ height: barHeight(item.value) }"
              />
            </view>
          </view>
          <view class="chart-row chart-row--days">
            <text
              v-for="(item, index) in weekData"
              :key="`d-${item.day}`"
              class="chart-day"
              :class="{ 'chart-day--today': index === weekData.length - 1 }"
            >
              {{ item.day }}
            </text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">近期订单</text>
          <text class="card-total">最近 {{ recentOrders.length }} 单</text>
        </view>
        <view v-for="item in recentOrders" :key="item.id" class="order-row">
          <view class="order-time">
            <text class="order-time-text">{{ item.finishedAt }}</text>
          </view>
          <view class="order-route">
            <text class="order-route-text">{{ item.from.name }} → {{ item.to.name }}</text>
            <text class="order-route-sub">已完成</text>
          </view>
          <text class="order-fare">+{{ item.fare.toFixed(2) }}</text>
        </view>
      </view>

      <view class="card card--tips">
        <text class="tips-title">收入说明</text>
        <text class="tips-line">· 订单完成后车费实时计入今日收入</text>
        <text class="tips-line">· 平台服务费按订单金额 8% 扣除，已包含在实收中</text>
        <text class="tips-line">· 每日 02:00 自动结算至账户余额</text>
      </view>

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

.head {
  padding: 28rpx 36rpx 34rpx;
  background: #2a2a34;
  border-radius: 0 0 34rpx 34rpx;
}

.head-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.head-back {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.back-icon {
  width: 24rpx;
  height: 24rpx;
  transform: rotate(180deg);
}

.head-title {
  flex: 1;
  font-size: 38rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.withdraw {
  margin: 0;
  padding: 10rpx 28rpx;
  height: auto;
  line-height: 1.4;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 23rpx;
  border: none;
}

.withdraw::after {
  border: none;
}

.withdraw--pressed {
  background: rgba(255, 255, 255, 0.24);
}

.head-label {
  display: block;
  margin-top: 30rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
  letter-spacing: 1rpx;
}

.head-amount {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
  margin-top: 8rpx;
}

.head-unit {
  font-size: 32rpx;
  color: #ffffff;
}

.head-number {
  font-size: 82rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
  letter-spacing: -2rpx;
}

.head-meta {
  display: flex;
  align-items: center;
  margin-top: 30rpx;
  padding: 22rpx 0;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.07);
}

.head-meta-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.head-meta-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.head-meta-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.42);
}

.head-meta-divider {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255, 255, 255, 0.12);
}

.body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.card {
  margin-bottom: 22rpx;
  padding: 26rpx 26rpx 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 6rpx 20rpx rgba(26, 26, 26, 0.04);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.card-total {
  font-size: 22rpx;
  color: #8a8f99;
}

.chart {
  padding-top: 6rpx;
}

.chart-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

/* 数字单独一行，七根柱子的数值始终在同一条水平线上 */
.chart-row--values {
  height: 34rpx;
  padding-bottom: 8rpx;
}

/* 柱子区高度固定，柱子从底部往上长，基线统一 */
.chart-row--bars {
  height: 160rpx;
}

.chart-row--days {
  height: 34rpx;
  align-items: center;
  padding-top: 8rpx;
}

.chart-bar-slot {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
}

.chart-value {
  flex: 1;
  text-align: center;
  font-size: 18rpx;
  line-height: 1;
  color: #b6bbc2;
}

.chart-value--today {
  color: #d0121a;
  font-weight: 600;
}

.chart-bar {
  width: 28rpx;
  border-radius: 14rpx;
  background: #e7e2e2;
  transition: height 0.3s ease;
}

.chart-bar--today {
  background: #d0121a;
}

.chart-day {
  flex: 1;
  text-align: center;
  font-size: 20rpx;
  line-height: 1;
  color: #9aa0a6;
}

.chart-day--today {
  color: #d0121a;
  font-weight: 600;
}

.order-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f5f1f1;
}

.order-row:first-of-type {
  border-top: none;
}

.order-time {
  width: 76rpx;
  flex-shrink: 0;
}

.order-time-text {
  font-size: 22rpx;
  color: #8a8f99;
}

.order-route {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.order-route-text {
  font-size: 24rpx;
  color: #3c4149;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-route-sub {
  font-size: 19rpx;
  color: #b6bbc2;
}

.order-fare {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.card--tips {
  background: #fbf9f9;
}

.tips-title {
  display: block;
  font-size: 23rpx;
  font-weight: 600;
  color: #6b7079;
  margin-bottom: 10rpx;
}

.tips-line {
  display: block;
  font-size: 21rpx;
  line-height: 1.9;
  color: #9aa0a6;
}

.bottom-space {
  height: calc(176rpx + env(safe-area-inset-bottom));
}
</style>

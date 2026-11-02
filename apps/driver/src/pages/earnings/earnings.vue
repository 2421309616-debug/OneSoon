<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoEarnings, driverApi, type DriverEarningsSummary } from "@/driver-api";

type Period = "today" | "week" | "month";
const period = ref<Period>("today");
const summary = ref<DriverEarningsSummary>(demoEarnings);
const periods: { id: Period; label: string }[] = [
  { id: "today", label: "今日" }, { id: "week", label: "近7天" }, { id: "month", label: "近30天" },
];
const displayTotal = computed(() => summary.value.total);

async function load() {
  try {
    const result = await driverApi.getEarnings(period.value);
    if (result) summary.value = result;
    else summary.value = demoPeriod(period.value);
  } catch {
    summary.value = demoPeriod(period.value);
  }
}

function demoPeriod(value: Period): DriverEarningsSummary {
  if (value === "week") return { ...demoEarnings, dateLabel: "近7天", total: 3886, completedOrders: 124, onlineMinutes: 2580, bonus: 248 };
  if (value === "month") return { ...demoEarnings, dateLabel: "近30天", total: 14060, completedOrders: 482, onlineMinutes: 16140, bonus: 870 };
  return demoEarnings;
}

function changePeriod(value: Period) { period.value = value; void load(); }
function openTrip(id: string) { uni.navigateTo({ url: `/pages/trip/trip?orderId=${encodeURIComponent(id)}&phase=completed` }); }
onMounted(load);
</script>

<template>
  <view class="driver-page driver-page--scroll">
    <DriverPageHeader title="收入明细" />
    <scroll-view class="earnings-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="period-tabs">
          <button v-for="item in periods" :key="item.id" class="period-tab" :class="{ 'period-tab--active': period === item.id }" @tap="changePeriod(item.id)">{{ item.label }}</button>
        </view>
        <view class="earnings-hero">
          <text class="hero-caption">{{ summary.dateLabel }}流水（元）</text>
          <text class="hero-total">{{ displayTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</text>
          <view class="driver-stat-grid hero-stats">
            <view><text class="hero-stat-value">{{ summary.completedOrders }}</text><text class="hero-stat-label">完成订单</text></view>
            <view><text class="hero-stat-value">{{ Math.floor(summary.onlineMinutes / 60) }}h{{ summary.onlineMinutes % 60 }}m</text><text class="hero-stat-label">在线时长</text></view>
            <view><text class="hero-stat-value">¥{{ summary.bonus }}</text><text class="hero-stat-label">奖励收入</text></view>
          </view>
        </view>
        <view class="driver-card">
          <view class="driver-between"><text class="driver-section-title">收入构成</text><text class="driver-muted small-note">{{ periods.find((item) => item.id === period)?.label }}</text></view>
          <view class="income-row"><text>订单收入</text><strong>¥{{ (displayTotal - summary.bonus).toFixed(2) }}</strong></view>
          <view class="income-row"><text>平台奖励</text><strong>¥{{ summary.bonus.toFixed(2) }}</strong></view>
        </view>
        <view class="driver-card">
          <view class="driver-between"><text class="driver-section-title">最近行程</text><text class="driver-muted small-note">显示 {{ summary.trips.length }} 条</text></view>
          <button v-for="trip in summary.trips" :key="trip.id" class="trip-row" @tap="openTrip(trip.id)">
            <view class="trip-copy"><text class="driver-list-title">{{ trip.pickup }} → {{ trip.destination }}</text><text class="driver-list-sub">{{ trip.time }} · {{ trip.distanceKm }} km · {{ trip.durationMinutes }} 分钟</text></view>
            <text class="driver-amount">+¥{{ trip.fare.toFixed(2) }}</text>
          </button>
          <view v-if="!summary.trips.length" class="driver-empty">该时段暂无行程</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.earnings-scroll { flex: 1; min-height: 0; }
.period-tabs { display: flex; gap: 8px; margin-bottom: 12px; padding: 4px; border-radius: 12px; background: #e7e9ed; }
.period-tab { flex: 1; min-height: 36px; margin: 0; padding: 0; border: 0; border-radius: 9px; background: transparent; color: #626977; font-size: 13px; }
.period-tab::after { border: 0; }
.period-tab--active { background: #fff; color: #c5222d; font-weight: 700; box-shadow: 0 2px 5px #20232d10; }
.earnings-hero { margin-bottom: 12px; padding: 21px 17px 16px; border-radius: 16px; background: #fff; }
.hero-caption { display: block; color: #737987; font-size: 12px; }
.hero-total { display: block; margin-top: 8px; color: #20212a; font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; }
.hero-stats { margin-top: 18px; padding-top: 13px; border-top: 1px solid #eceef1; text-align: center; }
.hero-stat-value { display: block; color: #252630; font-size: 15px; font-weight: 700; }
.hero-stat-label { display: block; margin-top: 4px; color: #737987; font-size: 10px; }
.small-note { margin: 0; font-size: 11px; }
.income-row { display: flex; justify-content: space-between; padding-top: 14px; color: #737987; font-size: 13px; }
.income-row strong { color: #252630; }
.trip-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; margin: 0; padding: 13px 0; border: 0; border-bottom: 1px solid #eceef1; border-radius: 0; background: transparent; text-align: left; }
.trip-row:last-child { border-bottom: 0; }
.trip-row::after { border: 0; }
.trip-copy { flex: 1; min-width: 0; }
.trip-copy .driver-list-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.driver-amount { font-size: 14px; }
</style>

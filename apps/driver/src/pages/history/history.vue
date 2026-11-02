<script setup lang="ts">
import { onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoTrips, driverApi, type DriverTripSummary } from "@/driver-api";

const trips = ref<DriverTripSummary[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const result = await driverApi.getCompletedTrips();
    trips.value = (result ?? demoTrips).filter((trip) => trip.status === "completed");
  } catch {
    trips.value = demoTrips.filter((trip) => trip.status === "completed");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <view class="driver-page driver-page--scroll history-page">
    <DriverPageHeader title="已完成订单" back-to="/pages/home/home" />
    <scroll-view class="history-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="history-heading">
          <text class="driver-eyebrow">行程记录</text>
          <text class="driver-title">已完成订单</text>
          <text class="driver-muted">共 {{ trips.length }} 笔行程</text>
        </view>
        <view v-if="loading" class="driver-card driver-empty">正在加载订单…</view>
        <view v-else-if="!trips.length" class="driver-card driver-empty">暂无已完成订单</view>
        <view v-for="trip in trips" :key="trip.id" class="driver-card history-trip">
          <view class="history-trip-head">
            <text class="history-status">已完成</text>
            <text class="history-time">{{ trip.time }}</text>
          </view>
          <view class="history-route">
            <view class="history-route-mark"><text class="history-dot history-dot--pickup" /><view class="history-line" /><text class="history-dot history-dot--destination" /></view>
            <view class="history-addresses">
              <text class="history-address">{{ trip.pickup }}</text>
              <text class="history-address">{{ trip.destination }}</text>
            </view>
            <text class="history-fare">¥{{ trip.fare.toFixed(2) }}</text>
          </view>
          <view class="history-trip-meta">{{ trip.distanceKm }} km · {{ trip.durationMinutes }} 分钟 · 订单 {{ trip.id }}</view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.history-scroll { flex: 1; min-height: 0; }
.history-heading { margin-bottom: 12px; }
.history-trip { padding: 14px; }
.history-trip-head { display: flex; align-items: center; justify-content: space-between; }
.history-status { color: #25815b; font-size: 12px; font-weight: 700; }
.history-time { color: #737987; font-size: 12px; }
.history-route { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.history-route-mark { display: flex; flex: none; flex-direction: column; align-items: center; height: 48px; }
.history-dot { width: 8px; height: 8px; border-radius: 50%; }
.history-dot--pickup { background: #c94a52; }
.history-dot--destination { background: #3c84c5; }
.history-line { flex: 1; width: 1px; min-height: 12px; margin: 3px 0; background: #d9dce2; }
.history-addresses { display: flex; flex: 1; flex-direction: column; justify-content: space-between; min-width: 0; height: 48px; }
.history-address { overflow: hidden; color: #252630; font-size: 13px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.history-fare { flex: none; color: #252630; font-size: 16px; font-weight: 750; }
.history-trip-meta { margin: 12px 0 0 18px; padding-top: 10px; border-top: 1px solid #eceef1; color: #737987; font-size: 11px; }
</style>

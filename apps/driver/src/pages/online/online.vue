<script setup lang="ts">
import { onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { demoEarnings, driverApi } from "@/driver-api";

const online = ref(false);
const busy = ref(false);
const safetyVisible = ref(false);
const income = ref(demoEarnings.total);
const trips = ref(demoEarnings.completedOrders);

onMounted(async () => {
  online.value = uni.getStorageSync("onesoon-driver-online") === true;
  const enteringFromOffline = !online.value;
  if (enteringFromOffline) {
    try { await driverApi.setAvailability(true); } catch { /* 本地演示状态继续 */ }
    online.value = true;
    uni.setStorageSync("onesoon-driver-online", true);
  }
  try {
    const dashboard = await driverApi.getDashboard();
    if (dashboard) {
      if (!enteringFromOffline) online.value = dashboard.online;
      income.value = dashboard.todayIncome;
      trips.value = dashboard.todayOrders;
    }
  } catch { /* 保持演示数据 */ }
});

async function goOffline() {
  if (busy.value) return;
  busy.value = true;
  try { await driverApi.setAvailability(false); } catch { /* 本地收车状态继续 */ }
  uni.setStorageSync("onesoon-driver-online", false);
  busy.value = false;
  uni.redirectTo({ url: "/pages/home/home" });
}

function openDispatch() { uni.navigateTo({ url: "/pages/dispatch/dispatch" }); }
function openEarnings() { uni.navigateTo({ url: "/pages/earnings/earnings" }); }
function requestSafetyHelp() {
  safetyVisible.value = true;
}
async function confirmSafetyHelp() {
  safetyVisible.value = false;
  try {
    await driverApi.sendSafetyAlert();
    uni.showToast({ title: "求助请求已记录", icon: "none" });
  } catch {
    uni.showToast({ title: "演示模式：求助请求已记录", icon: "none" });
  }
}
</script>

<template>
  <view class="driver-page driver-page--scroll online-page">
    <DriverPageHeader title="听单中心" />
    <scroll-view class="online-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="driver-card today-card">
          <view class="driver-between"><text class="driver-section-title">今日表现</text><button class="text-link" @tap="openEarnings">收入明细 ›</button></view>
          <view class="driver-stat-grid"><view class="driver-stat"><text class="driver-stat-value">{{ trips }}</text><text class="driver-stat-label">完成订单</text></view><view class="driver-stat"><text class="driver-stat-value">¥{{ income }}</text><text class="driver-stat-label">今日流水</text></view><view class="driver-stat"><text class="driver-stat-value">98分</text><text class="driver-stat-label">服务评分</text></view></view>
        </view>
        <button class="dispatch-entry" @tap="openDispatch"><text class="dispatch-entry-title">{{ online ? "查看附近订单" : "预览派单大厅" }}</text><text class="dispatch-entry-sub">查看路线、接驾距离和预估收入</text><text class="entry-arrow">›</text></button>
      </view>
    </scroll-view>
    <view v-if="online" class="driver-fixed-action online-fixed-action">
      <button class="online-safety-button" @tap="requestSafetyHelp"><image src="/static/icons/safety.svg" mode="aspectFit" /><text>安全求助</text></button>
      <button class="driver-primary online-primary" :disabled="busy" @tap="goOffline">{{ busy ? "正在更新…" : "收车休息" }}</button>
    </view>
    <view v-if="safetyVisible" class="safety-overlay" @tap.self="safetyVisible = false"><view class="safety-sheet"><text class="safety-title">安全求助</text><text class="safety-message">确认向平台发送安全求助吗？</text><view class="safety-actions"><button class="safety-cancel" @tap="safetyVisible = false">取消</button><button class="safety-confirm" @tap="confirmSafetyHelp">确认求助</button></view></view></view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.online-scroll { flex: 1; min-height: 0; }
.today-card { padding: 12px 14px; }
.text-link { margin: 0; padding: 4px 0; border: 0; background: transparent; color: #c5222d; font-size: 12px; }
.text-link::after { border: 0; }
.today-card .driver-stat-grid { display: flex; gap: 0; margin-top: 7px; }
.today-card .driver-stat { flex: 1; padding: 4px 3px; border-radius: 0; background: transparent; }
.today-card .driver-stat-value { font-size: 16px; }
.today-card .driver-stat-label { margin-top: 2px; font-size: 10px; }
.dispatch-entry { position: relative; display: flex; flex-direction: column; align-items: flex-start; width: 100%; margin: 0 0 12px; padding: 15px 40px 15px 15px; border: 1px solid #e0e2e7; border-radius: 14px; background: #fff; text-align: left; }
.dispatch-entry::after { border: 0; }
.dispatch-entry-title { color: #252630; font-size: 14px; font-weight: 700; }
.dispatch-entry-sub { margin-top: 5px; color: #737987; font-size: 11px; }
.entry-arrow { position: absolute; top: 50%; right: 15px; color: #9298a3; font-size: 22px; transform: translateY(-50%); }
.online-fixed-action { display: flex; align-items: center; gap: 10px; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); border-top: 0; background: #272733; box-sizing: border-box; }
.online-safety-button { display: flex; flex: 0 0 56px; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 56px; height: 56px; margin: 0; padding: 0 4px; border: 0; border-radius: 12px; background: #4a4b5d; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; white-space: nowrap; }
.online-safety-button text { font-size: 10px; font-weight: 700; line-height: 1; }
.online-safety-button::after { border: 0; }
.online-safety-button image { display: block; flex: none; width: 18px; height: 18px; filter: brightness(0) invert(1); }
.online-primary { flex: 1; min-width: 0; height: 56px; border-radius: 12px; background: #d0121a; font-size: 16px; }
.online-primary.go-offline { background: #d0121a; }
.go-offline { background: #3d414b; }
.safety-overlay { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: #1e202866; }
.safety-sheet { width: 100%; max-width: 375px; padding: 20px 18px calc(18px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; background: #fff; box-sizing: border-box; text-align: center; }
.safety-title { display: block; color: #252630; font-size: 18px; font-weight: 700; line-height: 1.4; }
.safety-message { display: block; margin-top: 10px; color: #737987; font-size: 14px; line-height: 1.5; }
.safety-actions { display: flex; flex-direction: column-reverse; gap: 10px; margin-top: 18px; }
.safety-actions button { width: 100%; height: 46px; margin: 0; border-radius: 11px; font-size: 15px; font-weight: 700; line-height: 46px; }
.safety-actions button::after { border: 0; }
.safety-cancel { background: #f1f2f5; color: #343642; }
.safety-confirm { background: #d0121a; color: #fff; }
</style>

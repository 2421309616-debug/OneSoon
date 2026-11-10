<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { requirePassenger } from "@/passenger-session";
import { saveRideOptions } from "@/passenger-ride-settings";
import { clearChosenDestination, clearChosenPickup } from "@/chosen-destination";

const mode = ref<"appointment" | "someone">("appointment");
const returnToBooking = ref(false);
const riderName = ref("");
const riderPhone = ref("");
const today = formatDate(new Date());
const maxDate = formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
const initialScheduledAt = defaultDateTime();
const scheduledDate = ref(formatDate(initialScheduledAt));
const scheduledTime = ref(formatTime(initialScheduledAt));
const title = computed(() => mode.value === "appointment" ? "预约用车" : "帮人叫车");
const description = computed(() => mode.value === "appointment"
  ? "选择出发时间，提前安排您的行程。"
  : "填写乘车人信息，方便司机联系实际乘车人。");

onLoad((query) => {
  const passenger = requirePassenger();
  if (!passenger) return;
  mode.value = query?.mode === "someone" ? "someone" : "appointment";
  returnToBooking.value = query?.returnTo === "booking";
  if (!returnToBooking.value) {
    clearChosenPickup();
    clearChosenDestination();
  }
});

function continueToTrip() {
  if (!requirePassenger()) return;
  let scheduledAt: string | null = null;
  if (mode.value === "appointment") {
    const local = new Date(`${scheduledDate.value}T${scheduledTime.value}:00`);
    if (!Number.isFinite(local.getTime()) || local.getTime() < Date.now() + 10 * 60_000) {
      uni.showToast({ title: "预约时间至少需要提前 10 分钟", icon: "none" });
      return;
    }
    const phone = riderPhone.value.trim();
    if (!riderName.value.trim() || !/^[+\d\-\s]{6,20}$/.test(phone)) {
      uni.showToast({ title: "请填写姓名和有效联系电话", icon: "none" });
      return;
    }
    scheduledAt = local.toISOString();
  } else {
    const phone = riderPhone.value.trim();
    if (!riderName.value.trim() || !/^[+\d\-\s]{6,20}$/.test(phone)) {
      uni.showToast({ title: "请填写乘车人姓名和有效手机号", icon: "none" });
      return;
    }
  }

  saveRideOptions({
    scheduledAt,
    riderName: riderName.value.trim(),
    riderPhone: riderPhone.value.trim(),
  });

  if (returnToBooking.value) {
    uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/home/home" }) });
  } else {
    uni.navigateTo({ url: "/pages/booking/booking" });
  }
}

function goBack() {
  uni.navigateBack({ fail: () => uni.reLaunch({ url: "/pages/home/home" }) });
}

function dateChanged(event: { detail: { value: string } }) {
  scheduledDate.value = event.detail.value;
}

function timeChanged(event: { detail: { value: string } }) {
  scheduledTime.value = event.detail.value;
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDateTime() {
  const value = new Date(Date.now() + 2 * 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value;
}

function formatTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
</script>

<template>
  <view class="app-page screen">
    <view class="topbar">
      <button class="back" aria-label="返回" @tap="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
      </button>
      <text class="topbar-title">{{ title }}</text>
    </view>

    <scroll-view class="content" scroll-y>
      <view class="intro">
        <text class="eyebrow">万顺出行</text>
        <text class="heading">{{ title }}</text>
        <text class="subheading">{{ description }}</text>
      </view>

      <view v-if="mode === 'appointment'" class="card">
        <text class="section-title">预约时间</text>
        <text class="hint">请至少提前 10 分钟预约，最长可提前 30 天。</text>
        <view class="picker-row">
          <view class="picker-cell">
            <text class="field-label">出发日期</text>
            <picker mode="date" :value="scheduledDate" :start="today" :end="maxDate" @change="dateChanged">
              <view class="picker-value">{{ scheduledDate }}</view>
            </picker>
          </view>
          <view class="picker-cell">
            <text class="field-label">出发时间</text>
            <picker mode="time" :value="scheduledTime" @change="timeChanged">
              <view class="picker-value">{{ scheduledTime }}</view>
            </picker>
          </view>
        </view>
      </view>

      <view v-else class="card">
        <text class="section-title">乘车人信息</text>
        <text class="hint">司机将按本次订单填写的信息联系乘车人。</text>
        <label class="field">
          <text class="field-label">乘车人姓名</text>
          <input v-model="riderName" class="input" maxlength="60" placeholder="请输入姓名" placeholder-class="placeholder" />
        </label>
        <label class="field">
          <text class="field-label">联系电话</text>
          <input v-model="riderPhone" class="input" type="tel" maxlength="20" placeholder="请输入乘车人手机号" placeholder-class="placeholder" />
        </label>
      </view>

      <view v-if="mode === 'appointment'" class="card">
        <text class="section-title">乘车人信息</text>
        <text class="hint">请填写本次乘车人的姓名和联系电话。</text>
        <label class="field">
          <text class="field-label">乘车人姓名</text>
          <input v-model="riderName" class="input" maxlength="60" placeholder="请输入姓名" placeholder-class="placeholder" />
        </label>
        <label class="field">
          <text class="field-label">联系电话</text>
          <input v-model="riderPhone" class="input" type="tel" maxlength="20" placeholder="请输入乘车人手机号" placeholder-class="placeholder" />
        </label>
      </view>

      <view v-if="mode !== 'appointment'" class="notice">
        <text class="notice-dot"></text>
        <text>下一步选择上车点和目的地，确认路线后提交订单。</text>
      </view>
    </scroll-view>

    <view class="footer">
      <button class="primary" hover-class="primary--pressed" @tap="continueToTrip">
        {{ mode === "appointment" ? "选择行程" : "填写行程" }}
      </button>
    </view>

  </view>
</template>

<style scoped>
.screen { min-height: var(--app-viewport-height); padding-bottom: calc(78px + var(--app-safe-bottom)); background: #f2f3f5; }
.topbar { position: relative; display: flex; align-items: center; height: 52px; padding: 0 16px; background: #fff; }
.back { position: absolute; left: 8px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; background: transparent; color: #252630; }
.back::after, .primary::after { border: 0; }
.back svg { width: 22px; height: 22px; }
.topbar-title { width: 100%; color: #252630; font-size: 17px; font-weight: 700; text-align: center; }
.content { height: calc(var(--app-viewport-height) - 52px - 78px - var(--app-safe-bottom)); padding: 20px 16px; box-sizing: border-box; }
.intro { display: flex; flex-direction: column; gap: 5px; margin-bottom: 18px; }
.eyebrow { color: #d0121a; font-size: 13px; font-weight: 650; }
.heading { color: #252630; font-size: 24px; font-weight: 750; line-height: 1.3; }
.subheading { color: #737b89; font-size: 14px; line-height: 1.5; }
.card { margin-bottom: 12px; padding: 18px 16px; border-radius: 14px; background: #fff; box-shadow: 0 4px 16px rgba(30, 35, 45, .04); }
.section-title { display: block; color: #252630; font-size: 17px; font-weight: 700; }
.hint { display: block; margin-top: 5px; color: #8a9099; font-size: 12px; line-height: 1.5; }
.picker-row { display: flex; gap: 10px; margin-top: 18px; }
.picker-cell { flex: 1; min-width: 0; }
.field-label { display: block; margin-bottom: 7px; color: #5c6370; font-size: 13px; }
.picker-value { display: flex; align-items: center; height: 48px; padding: 0 12px; border: 1px solid #dfe2e7; border-radius: 10px; background: #fafbfc; color: #252630; font-size: 15px; font-weight: 650; }
.field { display: block; margin-top: 16px; }
.input { width: 100%; height: 48px; padding: 0 12px; border: 1px solid #dfe2e7; border-radius: 10px; background: #fafbfc; color: #252630; font-size: 15px; }
.placeholder { color: #a0a6b0; }
.notice { display: flex; align-items: flex-start; gap: 9px; padding: 14px; border-radius: 12px; background: #fff; color: #737b89; font-size: 13px; line-height: 1.5; }
.notice-dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #d0121a; }
.footer { position: fixed; right: 0; bottom: 0; left: 0; max-width: 375px; margin: 0 auto; padding: 10px 16px calc(10px + var(--app-safe-bottom)); border-top: 1px solid #ece7e7; background: #fff; }
.primary { width: 100%; height: 50px; margin: 0; border: 0; border-radius: 25px; background: #d0121a; color: #fff; font-size: 16px; font-weight: 700; line-height: 50px; }
.primary--pressed { opacity: .85; }
</style>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import DriverPageHeader from "@/components/DriverPageHeader.vue";

type DriverMode = "普通接单" | "预约优先" | "顺路单优先";
type ListeningType = "实时单" | "预约单" | "顺路单";
type SavedSettings = { scheduleEnabled?: boolean; startTime?: string; endTime?: string; routeRange?: string; listeningTypes?: ListeningType[] };

const modes: { name: DriverMode; description: string }[] = [
  { name: "普通接单", description: "接收附近实时订单" },
  { name: "预约优先", description: "优先匹配预约行程" },
  { name: "顺路单优先", description: "优先匹配顺路订单" },
];
const selectedMode = ref<DriverMode>("普通接单");
const listeningTypeOptions: ListeningType[] = ["实时单", "预约单", "顺路单"];
const scheduleEnabled = ref(true);
const startTime = ref("06:00");
const endTime = ref("22:00");
const routeRange = ref("10 km");
const routeRanges = ["5 km", "10 km", "20 km"];
const listeningTypes = ref<ListeningType[]>(["实时单", "预约单", "顺路单"]);

onMounted(() => {
  const storedMode = uni.getStorageSync("onesoon-driver-mode");
  if (modes.some((mode) => mode.name === storedMode)) selectedMode.value = storedMode as DriverMode;
  const storedSettings = uni.getStorageSync("onesoon-driver-mode-settings") as SavedSettings | "";
  if (!storedSettings || typeof storedSettings !== "object") return;
  if (typeof storedSettings.scheduleEnabled === "boolean") scheduleEnabled.value = storedSettings.scheduleEnabled;
  if (storedSettings.startTime) startTime.value = storedSettings.startTime;
  if (storedSettings.endTime) endTime.value = storedSettings.endTime;
  if (storedSettings.routeRange && routeRanges.includes(storedSettings.routeRange)) routeRange.value = storedSettings.routeRange;
  if (Array.isArray(storedSettings.listeningTypes)) {
    const validTypes = storedSettings.listeningTypes.filter((type): type is ListeningType => ["实时单", "预约单", "顺路单"].includes(type));
    if (validTypes.length) listeningTypes.value = validTypes;
  }
});

function setStartTime(event: { detail: { value: string } }) { startTime.value = event.detail.value; }
function setEndTime(event: { detail: { value: string } }) { endTime.value = event.detail.value; }
function toggleListeningType(type: ListeningType) {
  if (listeningTypes.value.includes(type)) {
    if (listeningTypes.value.length === 1) {
      uni.showToast({ title: "至少保留一种听单类型", icon: "none" });
      return;
    }
    listeningTypes.value = listeningTypes.value.filter((item) => item !== type);
    return;
  }
  listeningTypes.value = [...listeningTypes.value, type];
}

function saveSettings() {
  uni.setStorageSync("onesoon-driver-mode", selectedMode.value);
  uni.setStorageSync("onesoon-driver-mode-settings", {
    scheduleEnabled: scheduleEnabled.value,
    startTime: startTime.value,
    endTime: endTime.value,
    routeRange: routeRange.value,
    listeningTypes: listeningTypes.value,
  });
  uni.showToast({ title: "模式设置已保存", icon: "none" });
  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) uni.navigateBack();
    else uni.redirectTo({ url: "/pages/home/home" });
  }, 250);
}
</script>

<template>
  <view class="driver-page driver-page--scroll mode-page">
    <DriverPageHeader title="模式设置" back-to="/pages/home/home" />
    <scroll-view class="mode-scroll" scroll-y>
      <view class="mode-content">
        <view class="mode-intro"><text class="mode-eyebrow">接单偏好</text><text class="mode-intro-title">选择适合你的接单方式</text><text class="mode-intro-note">设置将用于匹配后续订单，可随时调整。</text></view>

        <view class="mode-section mode-section--options">
          <text class="mode-section-title">接单模式</text>
          <view class="mode-options">
            <button v-for="item in modes" :key="item.name" class="mode-option" :class="{ 'mode-option--selected': selectedMode === item.name }" :aria-pressed="selectedMode === item.name" @tap="selectedMode = item.name">
              <text class="mode-option-name">{{ item.name }}</text>
              <text class="mode-option-description">{{ item.description }}</text>
            </button>
          </view>
        </view>

        <view class="mode-section">
          <text class="mode-section-title">听单类型</text>
          <text class="mode-section-description">可多选，至少保留一种听单类型</text>
          <view class="listening-type-options">
            <button v-for="type in listeningTypeOptions" :key="type" class="listening-type-option" :class="{ 'listening-type-option--selected': listeningTypes.includes(type) }" :aria-pressed="listeningTypes.includes(type)" @tap="toggleListeningType(type)">
              <text>{{ type }}</text>
            </button>
          </view>
        </view>

        <view class="mode-section">
          <view class="mode-section-heading"><text class="mode-section-title">接单时段</text><button class="mode-switch" :class="{ 'mode-switch--on': scheduleEnabled }" :aria-label="scheduleEnabled ? '关闭接单时段' : '开启接单时段'" @tap="scheduleEnabled = !scheduleEnabled"><view /></button></view>
          <view class="time-row" :class="{ 'time-row--disabled': !scheduleEnabled }">
            <picker mode="time" :value="startTime" :disabled="!scheduleEnabled" @change="setStartTime"><view class="time-picker"><text class="time-label">开始</text><text class="time-value">{{ startTime }}</text></view></picker>
            <text class="time-separator">至</text>
            <picker mode="time" :value="endTime" :disabled="!scheduleEnabled" @change="setEndTime"><view class="time-picker"><text class="time-label">结束</text><text class="time-value">{{ endTime }}</text></view></picker>
          </view>
          <text class="mode-hint">关闭后，将按你的在线状态随时接收订单。</text>
        </view>

        <view v-if="selectedMode === '顺路单优先'" class="mode-section">
          <text class="mode-section-title">顺路范围</text>
          <text class="mode-section-description">选择可接受的绕行距离</text>
          <view class="range-options"><button v-for="range in routeRanges" :key="range" class="range-option" :class="{ 'range-option--selected': routeRange === range }" @tap="routeRange = range">{{ range }}</button></view>
        </view>
      </view>
    </scroll-view>
    <view class="mode-footer"><button class="driver-primary mode-save" @tap="saveSettings">保存设置</button></view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.mode-page { background: #292a34; color: #f4f5f7; }
.mode-scroll { flex: 1; min-height: 0; background: #292a34; }
.mode-content { padding: 19px 14px 24px; }
.mode-intro { display: flex; flex-direction: column; gap: 5px; margin-bottom: 20px; }
.mode-eyebrow { color: #e15a61; font-size: 11px; font-weight: 700; }
.mode-intro-title { color: #fff; font-size: 20px; font-weight: 750; line-height: 1.3; }
.mode-intro-note { color: #aeb2bd; font-size: 11px; }
.mode-section { margin-bottom: 14px; padding: 15px 13px; border: 1px solid #454650; border-radius: 15px; background: #343540; }
.mode-section--options { padding: 10px 12px; }
.mode-section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.mode-section-title { color: #f4f5f7; font-size: 14px; font-weight: 700; }
.mode-options { display: flex; gap: 7px; margin-top: 8px; }
.mode-option { position: relative; display: flex; flex: 1; flex-direction: column; align-items: flex-start; justify-content: center; min-width: 0; min-height: 64px; margin: 0; padding: 7px 9px; border: 1px solid #51525d; border-radius: 12px; background: #3c3d48; text-align: left; }
.mode-option::after,.range-option::after,.mode-save::after { border: 0; }
.mode-option--selected { border: 1px solid #c94a52; background: #492f37; }
.mode-option-name { color: #fff; font-size: 11px; font-weight: 700; line-height: 1.25; }
.mode-option-description { margin-top: 5px; color: #aeb2bd; font-size: 9px; line-height: 1.3; }
.listening-type-options { display: flex; gap: 7px; margin-top: 12px; }
.listening-type-option { display: flex; flex: 1; align-items: center; justify-content: center; gap: 5px; min-width: 0; height: 42px; margin: 0; padding: 0 5px; border: 1px solid #555762; border-radius: 10px; background: #3c3d48; color: #d5d7dd; font-size: 11px; white-space: nowrap; }
.listening-type-option::after { border: 0; }
.listening-type-option--selected { border: 1px solid #c94a52; background: #492f37; color: #fff; font-weight: 700; }
.mode-switch { display: flex; align-items: center; width: 40px; height: 22px; margin: 0; padding: 2px; border: 0; border-radius: 12px; background: #565863; box-sizing: border-box; }
.mode-switch::after { border: 0; }
.mode-switch view { width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s ease; }
.mode-switch--on { background: #c94a52; }
.mode-switch--on view { transform: translateX(20px); }
.time-row { display: flex; align-items: center; gap: 8px; margin-top: 13px; }
.time-row--disabled { opacity: .45; }
.time-row picker { flex: 1; min-width: 0; }
.time-picker { display: flex; align-items: center; gap: 6px; min-height: 42px; padding: 0 9px; border: 1px solid #555762; border-radius: 10px; background: #3c3d48; }
.time-label { color: #aeb2bd; font-size: 10px; }
.time-value { margin-left: auto; color: #fff; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.time-separator { color: #aeb2bd; font-size: 10px; }
.mode-hint,.mode-section-description { display: block; margin-top: 10px; color: #9da2af; font-size: 10px; line-height: 1.4; }
.range-options { display: flex; gap: 8px; margin-top: 12px; }
.range-option { display: flex; flex: 1; align-items: center; justify-content: center; height: 36px; margin: 0; border: 1px solid #555762; border-radius: 10px; background: #3c3d48; color: #d5d7dd; font-size: 11px; }
.range-option--selected { border-color: #c94a52; background: #c94a52; color: #fff; font-weight: 700; }
.mode-footer { display: flex; flex: none; align-items: center; height: calc(80px + env(safe-area-inset-bottom)); min-height: calc(80px + env(safe-area-inset-bottom)); padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); background: #272733; box-sizing: border-box; }
.mode-save { width: 100%; height: 56px; min-height: 56px; border-radius: 12px; font-size: 15px; }
</style>

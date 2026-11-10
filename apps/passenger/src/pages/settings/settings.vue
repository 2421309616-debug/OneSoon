<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { requirePassenger } from "@/passenger-session";
import { readRideSettings, saveRideSettings, type RideSettings } from "@/passenger-ride-settings";

const settings = ref<RideSettings>(readRideSettings());

onShow(() => {
  if (!requirePassenger()) return;
  settings.value = readRideSettings();
});

function save() {
  saveRideSettings({ ...settings.value, note: settings.value.note?.trim().slice(0, 100) ?? "" });
  uni.showToast({ title: "设置已保存", icon: "success" });
  setTimeout(() => uni.reLaunch({ url: "/pages/profile/profile" }), 350);
}

function goBack() {
  uni.reLaunch({ url: "/pages/profile/profile" });
}
</script>

<template>
  <view class="app-page screen">
    <view class="topbar">
      <button class="back" aria-label="返回" @tap="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
      </button>
      <text class="topbar-title">设置</text>
    </view>
    <scroll-view class="content" scroll-y>
      <view class="intro">
        <text class="heading">乘车偏好</text>
        <text class="subheading">保存后会自动应用到之后提交的订单。</text>
      </view>

      <view class="card">
        <view class="preference" role="switch" :aria-checked="settings.quietRide" @tap="settings.quietRide = !settings.quietRide">
          <view class="copy"><text class="label">安静出行</text><text class="hint">尽量减少车内交流</text></view>
          <view class="toggle" :class="{ 'toggle--on': settings.quietRide }"><view class="knob" /></view>
        </view>
        <view class="divider" />
        <view class="preference" role="switch" :aria-checked="settings.smokeFree" @tap="settings.smokeFree = !settings.smokeFree">
          <view class="copy"><text class="label">无烟车辆</text><text class="hint">优先告知司机无烟需求</text></view>
          <view class="toggle" :class="{ 'toggle--on': settings.smokeFree }"><view class="knob" /></view>
        </view>
        <view class="divider" />
        <view class="preference" role="switch" :aria-checked="settings.trunkNeeded" @tap="settings.trunkNeeded = !settings.trunkNeeded">
          <view class="copy"><text class="label">需要后备箱</text><text class="hint">携带行李或大件物品时开启</text></view>
          <view class="toggle" :class="{ 'toggle--on': settings.trunkNeeded }"><view class="knob" /></view>
        </view>
      </view>

      <view class="card note-card">
        <text class="label">给司机的备注</text>
        <text class="hint">备注会随订单一起提交，最多 100 字。</text>
        <textarea v-model="settings.note" class="note" maxlength="100" placeholder="例如：到小区南门接我" placeholder-class="placeholder" />
      </view>
    </scroll-view>
    <view class="footer">
      <button class="primary" hover-class="primary--pressed" @tap="save">保存设置</button>
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
.heading { color: #252630; font-size: 22px; font-weight: 750; }
.subheading, .hint { color: #737b89; font-size: 13px; line-height: 1.5; }
.card { margin-bottom: 12px; padding: 4px 16px; border-radius: 14px; background: #fff; box-shadow: 0 4px 16px rgba(30, 35, 45, .04); }
.preference { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 68px; cursor: pointer; }
.copy { display: flex; flex-direction: column; gap: 3px; }
.label { color: #252630; font-size: 15px; font-weight: 650; }
.hint { font-size: 12px; }
.divider { height: 1px; background: #f0f1f3; }
.toggle { display: flex; flex: none; align-items: center; justify-content: flex-start; width: 46px; height: 27px; padding: 3px; border-radius: 14px; background: #dfe2e7; transition: background .18s ease; }
.toggle--on { justify-content: flex-end; background: #d0121a; }
.knob { width: 21px; height: 21px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .16); }
.note-card { padding: 16px; }
.note { display: block; width: 100%; min-height: 92px; margin-top: 12px; padding: 11px; border: 1px solid #e1e3e8; border-radius: 10px; background: #fafbfc; color: #252630; font-size: 14px; }
.placeholder { color: #a0a6b0; }
.footer { position: fixed; right: 0; bottom: 0; left: 0; max-width: 375px; margin: 0 auto; padding: 10px 16px calc(10px + var(--app-safe-bottom)); border-top: 1px solid #ece7e7; background: #fff; }
.primary { width: 100%; height: 50px; margin: 0; border: 0; border-radius: 25px; background: #d0121a; color: #fff; font-size: 16px; font-weight: 700; line-height: 50px; }
.primary--pressed { opacity: .85; }
</style>

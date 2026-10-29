<script setup lang="ts">
import { miniApps, type MiniAppEntry } from "@/mini-apps";

function openApp(app: MiniAppEntry) {
  if (!app.url) return;
  if (app.url.startsWith("/")) {
    uni.navigateTo({ url: app.url });
    return;
  }
  // #ifdef H5
  window.open(app.url, "_blank", "noopener");
  // #endif
}
</script>

<template>
  <view class="apps" aria-label="小应用">
    <button
      v-for="app in miniApps"
      :key="app.id"
      class="cell"
      role="button"
      hover-class="cell--pressed"
      @tap="openApp(app)"
    >
      <image class="cell-icon" :src="app.icon" mode="aspectFit" />
      <text class="cell-name">{{ app.name }}</text>
    </button>
  </view>
</template>

<style scoped>
.apps {
  display: grid;
  grid-template-columns: repeat(var(--app-shortcut-columns), minmax(0, 1fr));
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-width: 0;
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  margin: 0;
  padding: 8rpx 0 16rpx;
  border: 0;
  border-radius: 16rpx;
  background: transparent;
  line-height: 1.3;
  cursor: pointer;
}

.cell::after {
  border: none;
}

.cell--pressed {
  background: #f7f1f1;
}

.cell:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: 2px;
}

.cell-icon {
  width: 64rpx;
  height: 64rpx;
}

.cell-name {
  max-width: 100%;
  padding: 0 4rpx;
  color: #1a1a1a;
  font-size: var(--app-font-small);
  overflow-wrap: anywhere;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .cell--pressed {
    background: transparent;
  }
}
</style>

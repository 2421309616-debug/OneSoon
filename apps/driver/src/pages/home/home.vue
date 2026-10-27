<script setup lang="ts">
import { nextTick, ref } from "vue";
import { onReady } from "@dcloudio/uni-app";

const offset = ref(0);
const travel = ref(0);
const dragging = ref(false);
const settled = ref(false);

let startY = 0;
let startOffset = 0;
let startScroll = 0;
let moved = false;
let wheelTimer = 0;

type Notice = {
  title: string;
  time: string;
  body: string;
  image?: string;
};

const notices = ref<Notice[]>([
  {
    title: "万顺播报",
    time: "10.27 08:30",
    body: "各位司机请注意，今日城区短途订单较多。出车前请核对上车点，遇到拥堵或暂时联系不上乘客，先在订单里留言，再按导航前往。",
  },
  {
    title: "五星老司机推荐",
    time: "10.27 09:20",
    body: "保持准点到达，上车后主动确认目的地。服务稳定，更容易拿到五星好评。",
    image: "/static/promo/star-driver.jpg",
  },
  {
    title: "丰都热报",
    time: "10.27 16:40",
    body: "丰都城区晚间订单明显增多，热门路段容易缓行。建议提前十五分钟出发，避开窄路和临停点，按导航前往约定地点。",
  },
]);

function removeNotice(title: string) {
  notices.value = notices.value.filter((item) => item.title !== title);
}

function sheetEl() {
  const sheet = document.querySelector(".info-card");
  return sheet instanceof HTMLElement ? sheet : null;
}

function clamp(value: number) {
  return Math.min(0, Math.max(-travel.value, value));
}

function settle(value: number) {
  return value < -travel.value / 2 ? -travel.value : 0;
}

function measure() {
  const task = document.querySelector(".task-card");
  if (!(task instanceof HTMLElement)) return;
  travel.value = task.getBoundingClientRect().height;
  offset.value = clamp(offset.value);
  requestAnimationFrame(() => {
    settled.value = true;
  });
}

function begin(y: number) {
  dragging.value = true;
  moved = false;
  startY = y;
  startOffset = offset.value;
  startScroll = sheetEl()?.scrollTop ?? 0;
}

function update(y: number) {
  const dy = y - startY;
  if (!moved && Math.abs(dy) < 6) return;
  moved = true;
  const sheet = sheetEl();
  const atFull = startOffset <= -travel.value + 0.5;
  if (sheet && atFull) {
    const overflow = sheet.scrollHeight - sheet.clientHeight;
    if (overflow > 1 && dy < 0) {
      sheet.scrollTop = Math.min(overflow, startScroll - dy);
      offset.value = -travel.value;
      return;
    }
    if (overflow > 1 && startScroll > 0 && dy > 0) {
      const nextScroll = startScroll - dy;
      if (nextScroll > 0) {
        sheet.scrollTop = nextScroll;
        offset.value = -travel.value;
        return;
      }
      sheet.scrollTop = 0;
      offset.value = clamp(dy - startScroll);
      return;
    }
  }
  if (sheet && startOffset + dy > -travel.value + 0.5) sheet.scrollTop = 0;
  offset.value = clamp(startOffset + dy);
}

function end() {
  if (!dragging.value) return;
  dragging.value = false;
  if (!moved) return;
  offset.value = settle(offset.value);
}

function onTouchStart(event: TouchEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest("button")) return;
  begin(event.touches[0].clientY);
}

function onTouchMove(event: TouchEvent) {
  if (!dragging.value) return;
  update(event.touches[0].clientY);
}

function onTouchEnd() {
  end();
}

function bindSheet() {
  const sheet = sheetEl();
  if (!sheet || sheet.dataset.bound === "1") return;
  sheet.dataset.bound = "1";
  sheet.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    try {
      sheet.setPointerCapture(event.pointerId);
    } catch {
      // 指针捕获失败时仍由窗口上的移动事件接管。
    }
    begin(event.clientY);
    const move = (ev: PointerEvent) => update(ev.clientY);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      end();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
  sheet.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      dragging.value = true;
      offset.value = clamp(offset.value - pixels);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        dragging.value = false;
        offset.value = settle(offset.value);
      }, 140);
    },
    { passive: false },
  );
}

onReady(() => {
  nextTick(() => {
    measure();
    bindSheet();
    window.addEventListener("resize", measure);
  });
});
</script>

<template>
  <view class="screen">
    <view class="titlebar">
      <button class="account" role="button" hover-class="account--pressed" aria-label="个人">
        <image class="account-icon" src="/static/icons/person.svg" mode="aspectFit" aria-hidden="true" />
      </button>
      <view class="brand">
        <text class="brand-name">万顺</text>
        <text class="brand-en">OneSoon</text>
      </view>
    </view>
    <view class="stage">
    <view class="task-card">
      <view class="stats-score">
        <view class="stats-value">
          <text class="stats-num stats-num--hero">98</text>
          <text class="stats-unit stats-unit--hero">分</text>
        </view>
        <text class="stats-label">服务评分</text>
      </view>
      <view class="stats-row">
        <view class="stats-item">
          <view class="stats-value">
            <text class="stats-num">23</text>
            <text class="stats-unit">单</text>
          </view>
          <text class="stats-label">今日接单</text>
        </view>
        <view class="stats-divider" />
        <view class="stats-item">
          <view class="stats-value">
            <text class="stats-num">657</text>
            <text class="stats-unit">元</text>
          </view>
          <text class="stats-label">今日收益</text>
        </view>
      </view>
      <view class="tool-row">
        <button class="tool" role="button" hover-class="tool--pressed">
          <image class="tool-icon" src="/static/icons/manual.svg" mode="aspectFit" aria-hidden="true" />
          <text class="tool-label">手册</text>
        </button>
        <button class="tool" role="button" hover-class="tool--pressed">
          <image class="tool-icon" src="/static/icons/reward.svg" mode="aspectFit" aria-hidden="true" />
          <text class="tool-label">奖励</text>
        </button>
        <button class="tool" role="button" hover-class="tool--pressed">
          <image class="tool-icon" src="/static/icons/order.svg" mode="aspectFit" aria-hidden="true" />
          <text class="tool-label">订单详情</text>
        </button>
      </view>
    </view>
    <view
      class="info-card"
      :class="{ 'is-dragging': dragging, 'is-settled': settled }"
      :style="{ transform: `translateY(${offset}px)` }"
      @touchstart="onTouchStart"
      @touchmove.stop="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <view v-for="item in notices" :key="item.title" class="notice">
        <view class="notice-head">
          <text class="notice-title">{{ item.title }}</text>
          <text class="notice-time">{{ item.time }}</text>
        </view>
        <button
          class="notice-close"
          role="button"
          hover-class="notice-close--pressed"
          :aria-label="'删除' + item.title"
          @tap="removeNotice(item.title)"
        >
          <image class="notice-close-icon" src="/static/icons/close.svg" mode="aspectFit" aria-hidden="true" />
        </button>
        <text class="notice-body">{{ item.body }}</text>
        <image v-if="item.image" class="notice-image" :src="item.image" mode="aspectFill" alt="" />
      </view>
      </view>
    </view>
    <view class="action-bar">
      <button class="action-side" role="button" hover-class="action-side--pressed" aria-label="模式">
        <image class="action-gear" src="/static/icons/gear.svg" mode="aspectFit" aria-hidden="true" />
        <text class="action-mode">模式</text>
      </button>
      <button class="action-main" role="button" hover-class="action-main--pressed">
        <text class="action-go">点击出车</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 375px;
  height: 100vh;
  height: 100dvh;
  margin: 0 auto;
  overflow: hidden;
  background: #272733;
  box-sizing: border-box;
  touch-action: manipulation;
  overscroll-behavior: none;
}

.titlebar {
  position: relative;
  flex: none;
  height: calc(112rpx + env(safe-area-inset-top));
  background: #2a2a34;
}

.account {
  position: absolute;
  z-index: 1;
  top: calc(12rpx + env(safe-area-inset-top));
  left: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 16rpx;
  background: transparent;
  line-height: 1;
  cursor: pointer;
}

.account::after {
  border: none;
}

.account--pressed {
  opacity: 0.55;
}

.account:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}

.account-icon {
  width: 48rpx;
  height: 48rpx;
}

.brand {
  position: absolute;
  z-index: 1;
  top: calc(24rpx + env(safe-area-inset-top));
  right: 32rpx;
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.brand-name {
  color: #d0121a;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.brand-en {
  color: #e8eaed;
  font-size: 24rpx;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.stats-score {
  position: absolute;
  top: 17%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-row {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  display: flex;
}

.stats-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.stats-value {
  display: flex;
  align-items: baseline;
  gap: 2rpx;
}

.stats-num {
  color: #ffffff;
  font-size: 36px;
  font-size: 12cqh;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.stats-num--hero {
  font-size: 52px;
  font-size: 18cqh;
}

.stats-unit {
  color: #ffffff;
  font-size: 14px;
  font-size: 4.5cqh;
  font-weight: 500;
  line-height: 1;
}

.stats-unit--hero {
  font-size: 20px;
  font-size: 7cqh;
  font-weight: 600;
}

.stats-label {
  margin-top: 6px;
  margin-top: 2cqh;
  color: #a3a8b2;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
}

.stats-divider {
  position: absolute;
  top: 1cqh;
  left: 50%;
  width: 1px;
  height: 10cqh;
  background: #6a7080;
  transform: translateX(-50%);
}

.tool-row {
  position: absolute;
  top: calc(100% - 17cqh - 16rpx);
  left: 22rpx;
  right: 22rpx;
  display: flex;
  height: 17cqh;
  gap: 28rpx;
}

.tool {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0 8rpx;
  border: 0;
  border-radius: 16rpx;
  background: #40424e;
  line-height: 1;
  cursor: pointer;
}

.tool::after {
  border: none;
}

.tool--pressed {
  opacity: 0.55;
}

.tool:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: 2px;
}

.tool-icon {
  width: 44rpx;
  height: 44rpx;
  flex: none;
}

.tool-label {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 500;
  line-height: 1;
}

.task-card {
  position: relative;
  z-index: 1;
  container-type: size;
  height: calc(100% * 4 / 9);
  min-height: 0;
  background: #31313b;
}

.stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: #31313b;
}

.info-card {
  position: absolute;
  z-index: 2;
  top: calc(100% * 4 / 9);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  height: 100%;
  padding: 20rpx 16rpx 32rpx;
  overflow: auto;
  background: #d8dce2;
  box-sizing: border-box;
  touch-action: none;
  cursor: grab;
}

.info-card.is-dragging {
  cursor: grabbing;
}

.info-card.is-settled:not(.is-dragging) {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.notice {
  position: relative;
  flex: none;
  padding: 28rpx 28rpx 32rpx;
  background: #ffffff;
}

.notice-head {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  padding-right: 72rpx;
}

.notice-title {
  color: #1a1a1a;
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.4;
}

.notice-time {
  color: #3c4149;
  font-size: 24rpx;
  font-weight: 500;
  line-height: 1.4;
}

.notice-close {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 12rpx;
  background: transparent;
  cursor: pointer;
}

.notice-close::after {
  border: none;
}

.notice-close--pressed {
  opacity: 0.55;
}

.notice-close:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}

.notice-close-icon {
  width: 32rpx;
  height: 32rpx;
}

.notice-body {
  display: block;
  margin-top: 16rpx;
  color: #3c4149;
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.6;
}

.notice-image {
  display: block;
  width: 100%;
  height: 280rpx;
  margin-top: 20rpx;
}

.action-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 40rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #272733;
}

.action-side {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  width: 112rpx;
  height: 112rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 24rpx;
  background: #4a4b5d;
  line-height: 1;
  cursor: pointer;
}

.action-side::after,
.action-main::after {
  border: none;
}

.action-side--pressed,
.action-main--pressed {
  opacity: 0.55;
}

.action-side:focus-visible,
.action-main:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: 2px;
}

.action-gear {
  width: 36rpx;
  height: 36rpx;
  flex: none;
}

.action-mode {
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 500;
  line-height: 1;
}

.action-main {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  height: 112rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 24rpx;
  background: #d0121a;
  line-height: 1;
  cursor: pointer;
}

.action-go {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .account--pressed,
  .tool--pressed,
  .notice-close--pressed,
  .action-side--pressed,
  .action-main--pressed {
    opacity: 1;
  }

  .info-card.is-settled:not(.is-dragging) {
    transition: none;
  }
}
</style>

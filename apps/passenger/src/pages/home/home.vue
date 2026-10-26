<script setup lang="ts">
import { getCurrentInstance, nextTick, ref } from "vue";
import { onReady } from "@dcloudio/uni-app";
import BottomNav from "@/components/BottomNav.vue";
import MiniAppGrid from "@/components/MiniAppGrid.vue";

const destination = ref("");
const offset = ref(0);
const minOffset = ref(0);
const restOffset = ref(0);
const maxOffset = ref(0);
const dragging = ref(false);
const placed = ref(false);
const settled = ref(false);
const pickupLayoutTop = ref(0);
const pinTop = ref(0);
const cardShift = ref(0);
const proxy = getCurrentInstance()?.proxy;

const promoPoster = "/static/promo/term-poster.jpg";
const foods = [
  { id: "noodles", name: "老街面馆", dish: "面条", price: 18, image: "/static/promo/food-noodles.jpg" },
  { id: "hotpot", name: "山城火锅", dish: "火锅", price: 88, image: "/static/promo/food-hotpot.jpg" },
  { id: "pork", name: "湘味小厨", dish: "辣椒炒肉", price: 32, image: "/static/promo/food-pork.jpg" },
];
const hotels = [
  { id: "cloud", name: "云栖酒店", room: "大床房", price: 268, image: "/static/promo/hotel-cloud.jpg" },
  { id: "river", name: "江景酒店", room: "江景房", price: 328, image: "/static/promo/hotel-river.jpg" },
  { id: "home", name: "青禾民宿", room: "双床房", price: 168, image: "/static/promo/hotel-home.jpg" },
];

let startY = 0;
let startOffset = 0;
let moved = false;

function clamp(value: number) {
  return Math.min(maxOffset.value, Math.max(minOffset.value, value));
}

function settle(value: number) {
  const collapsed = maxOffset.value;
  const rest = restOffset.value;
  const full = minOffset.value;
  if (value >= rest - 72) {
    return value > (collapsed + rest) / 2 ? collapsed : rest;
  }
  if (value <= full + 24) return full;
  if (rest - value <= 24) return rest;
  return value;
}

function placeCard(sheetY: number) {
  const natural = pickupLayoutTop.value + sheetY;
  cardShift.value = Math.max(0, pinTop.value - natural);
}

let followingCard = false;

function syncCard(followVisual: boolean) {
  placeCard(followVisual ? appliedOffset() : offset.value);
  if (!followVisual || Math.abs(appliedOffset() - offset.value) <= 0.5 || followingCard) return;
  followingCard = true;
  requestAnimationFrame(() => {
    followingCard = false;
    syncCard(true);
  });
}

function readPinTop() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;padding-top:env(safe-area-inset-top);visibility:hidden";
  document.body.appendChild(probe);
  pinTop.value = probe.clientHeight;
  probe.remove();
}

function appliedOffset() {
  const sheet = document.querySelector(".below");
  if (!(sheet instanceof HTMLElement)) return offset.value;
  const raw = getComputedStyle(sheet).transform;
  if (!raw || raw === "none") return 0;
  const match = raw.match(/matrix\(([^)]+)\)/);
  if (!match) return offset.value;
  const parts = match[1].split(",");
  const y = Number(parts[5]);
  return Number.isFinite(y) ? y : offset.value;
}

function measure(pinCollapsed: boolean) {
  if (Math.abs(appliedOffset() - offset.value) > 1) {
    requestAnimationFrame(() => measure(pinCollapsed));
    return;
  }
  uni
    .createSelectorQuery()
    .in(proxy)
    .select(".screen")
    .boundingClientRect()
    .select(".below")
    .boundingClientRect()
    .select(".pickup-card")
    .boundingClientRect()
    .select(".card--apps")
    .boundingClientRect()
    .select(".nav")
    .boundingClientRect()
    .exec((res) => {
      const screen = res[0];
      const sheet = res[1];
      const pickup = res[2];
      const apps = res[3];
      const nav = res[4];
      if (!screen || !sheet || !pickup || !apps || !nav) return;
      const layoutTop = pickup.top - offset.value - cardShift.value;
      const layoutBottom = pickup.bottom - offset.value - cardShift.value;
      pickupLayoutTop.value = layoutTop;
      const target = nav.top - 8;
      const collapsed = target - layoutBottom;
      const rest = offset.value + (target - apps.bottom);
      const full = offset.value + (screen.bottom - sheet.bottom);
      maxOffset.value = collapsed;
      restOffset.value = Math.min(collapsed, rest);
      minOffset.value = Math.min(restOffset.value, full);
      offset.value = pinCollapsed ? maxOffset.value : clamp(offset.value);
      placeCard(offset.value);
      placed.value = true;
      requestAnimationFrame(() => {
        settled.value = true;
      });
    });
}

function remeasure() {
  measure(Math.abs(offset.value - maxOffset.value) < 1);
}

onReady(() => {
  nextTick(() => {
    readPinTop();
    measure(true);
    bindSheet();
    window.addEventListener("resize", remeasure);
  });
});

function bindSheet() {
  const sheet = document.querySelector(".below");
  if (!(sheet instanceof HTMLElement) || sheet.dataset.bound === "1") return;
  sheet.dataset.bound = "1";

  sheet.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      sheet.setPointerCapture(event.pointerId);
    } catch {
      // 某些浏览器在未按下的指针上会拒绝捕获，拖动仍由窗口事件接管。
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
      placeCard(offset.value);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        dragging.value = false;
        offset.value = settle(offset.value);
        syncCard(true);
      }, 140);
    },
    { passive: false },
  );
}

let wheelTimer = 0;

function begin(y: number) {
  dragging.value = true;
  moved = false;
  startY = y;
  startOffset = offset.value;
}

function update(y: number) {
  const dy = y - startY;
  if (!moved && Math.abs(dy) < 6) return;
  moved = true;
  offset.value = clamp(startOffset + dy);
  placeCard(offset.value);
}

function end() {
  if (!dragging.value) return;
  dragging.value = false;
  if (!moved) return;
  offset.value = settle(offset.value);
  syncCard(true);
}

function onTouchStart(event: TouchEvent) {
  begin(event.touches[0].clientY);
}

function onTouchMove(event: TouchEvent) {
  update(event.touches[0].clientY);
}

function onTouchEnd() {
  end();
}
</script>

<template>
  <view class="screen">
    <view class="stage">
      <view class="brand">
        <text class="brand-name">万顺</text>
        <text class="brand-en">OneSoon</text>
      </view>
      <view class="map-slot" aria-label="地图展示区域"></view>
    </view>

    <view
      class="below"
      :class="{ 'is-dragging': dragging, 'is-ready': placed, 'is-settled': settled }"
      :style="{ transform: `translateY(${offset}px)` }"
      @touchstart="onTouchStart"
      @touchmove.stop="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <view
        class="card pickup-card"
        :class="{ 'is-pinned': cardShift > 0.5 }"
        :style="{ transform: `translateY(${cardShift}px)` }"
      >
        <view class="pickup">
          <view class="pickup-dot" aria-hidden="true"></view>
          <text class="pickup-text">请选择上车点</text>
        </view>

        <view class="field">
          <text class="field-label">目的地</text>
          <view class="field-box">
            <image class="search-icon" src="/static/icons/search.svg" mode="aspectFit" aria-hidden="true" />
            <input
              v-model="destination"
              class="field-input"
              type="text"
              confirm-type="search"
              placeholder="输入目的地"
              placeholder-class="field-placeholder"
              aria-label="目的地"
            />
          </view>
        </view>

        <view class="actions">
          <button class="action" role="button" hover-class="action--pressed">
            <image class="action-icon" src="/static/icons/clock.svg" mode="aspectFit" aria-hidden="true" />
            <text class="action-label">预约</text>
          </button>
          <button class="action action--split" role="button" hover-class="action--pressed">
            <image class="action-icon" src="/static/icons/person.svg" mode="aspectFit" aria-hidden="true" />
            <text class="action-label">帮人叫车</text>
          </button>
        </view>
      </view>

      <view class="card card--apps">
        <MiniAppGrid />
      </view>

      <view class="card card--block">
        <text class="block-title" role="heading" aria-level="2">万顺开学季优惠</text>
        <view class="poster">
          <image
            class="poster-img"
            :src="promoPoster"
            mode="aspectFill"
            alt="开学季出行立减"
          />
        </view>
      </view>

      <view class="card card--block">
        <text class="block-title" role="heading" aria-level="2">万顺美食地</text>
        <view class="food-row">
          <view v-for="item in foods" :key="item.id" class="food">
            <view class="food-photo">
              <image class="food-img" :src="item.image" mode="aspectFill" :alt="item.dish" />
            </view>
            <text class="food-name">{{ item.name }}</text>
            <text class="food-dish">{{ item.dish }}</text>
            <text class="food-price">¥{{ item.price }}</text>
          </view>
        </view>
      </view>

      <view class="card card--block">
        <text class="block-title" role="heading" aria-level="2">万顺优酒店</text>
        <view class="food-row">
          <view v-for="item in hotels" :key="item.id" class="food">
            <view class="food-photo">
              <image class="food-img" :src="item.image" mode="aspectFill" :alt="item.room" />
            </view>
            <text class="food-name">{{ item.name }}</text>
            <text class="food-dish">{{ item.room }}</text>
            <text class="food-price">¥{{ item.price }}</text>
          </view>
        </view>
      </view>
    </view>

    <BottomNav current="home" />
  </view>
</template>

<style scoped>
.screen {
  position: relative;
  height: 100vh;
  height: 100dvh;
  max-width: 375px;
  margin: 0 auto;
  overflow: hidden;
  background: #e8eaed;
  box-sizing: border-box;
}

.stage {
  position: absolute;
  inset: 0;
}

.brand {
  position: absolute;
  z-index: 2;
  top: calc(24rpx + env(safe-area-inset-top));
  left: 32rpx;
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
  color: #3c4149;
  font-size: 24rpx;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.map-slot {
  height: 100%;
  background: #e8eaed;
}

.below {
  position: absolute;
  z-index: 3;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 16rpx 16rpx calc(116rpx + env(safe-area-inset-bottom));
  border-radius: 24rpx 24rpx 0 0;
  background: #f2f3f5;
  box-sizing: border-box;
  visibility: hidden;
  touch-action: none;
  cursor: grab;
}

.below.is-ready {
  visibility: visible;
}

.below.is-settled {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.below.is-dragging {
  cursor: grabbing;
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .below.is-settled {
    transition: none;
  }
}

.card {
  padding: 28rpx 24rpx 8rpx;
  border-radius: 24rpx;
  background: #ffffff;
}

.card--apps {
  padding: 16rpx 8rpx;
}

.pickup-card {
  position: relative;
  z-index: 5;
  padding: 16rpx 24rpx 0;
}

.pickup-card.is-pinned {
  margin-right: -16rpx;
  margin-left: -16rpx;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: 0 8px 20px rgba(26, 26, 26, 0.12);
}

.card--block {
  padding: 28rpx 24rpx 24rpx;
}

.block-title {
  display: block;
  margin-bottom: 20rpx;
  color: #1a1a1a;
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.poster {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 16rpx;
  background: #f6f1f1;
}

.poster-img,
.food-img {
  display: block;
  width: 100%;
  height: 100%;
}

.food-row {
  display: flex;
  gap: 12rpx;
}

.food {
  flex: 1;
  min-width: 0;
}

.food-photo {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 16rpx;
  background: #f6f1f1;
}

.food-name,
.food-dish,
.food-price {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.food-name {
  margin-top: 12rpx;
  color: #1a1a1a;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.3;
}

.food-dish {
  margin-top: 4rpx;
  color: #3c4149;
  font-size: 22rpx;
  line-height: 1.3;
}

.food-price {
  margin-top: 8rpx;
  color: #d0121a;
  font-size: 28rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.pickup {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.pickup-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #d0121a;
  flex: none;
}

.pickup-text {
  color: #1a1a1a;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.2;
}

.field-label {
  display: block;
  margin-bottom: 8rpx;
  color: #3c4149;
  font-size: 26rpx;
  font-weight: 500;
  line-height: 1.2;
}

.field-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 80rpx;
  padding: 0 28rpx;
  border: 2px solid #d0121a;
  border-radius: 999px;
  background: #ffffff;
  box-sizing: border-box;
}

.field-box:focus-within {
  box-shadow: 0 0 0 4px rgba(208, 18, 26, 0.18);
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  flex: none;
}

.field-input {
  flex: 1;
  height: 72rpx;
  min-width: 0;
  color: #1a1a1a;
  font-size: 32rpx;
  caret-color: #d0121a;
}

.field-placeholder {
  color: #5c6370;
  font-size: 32rpx;
}

.actions {
  display: flex;
}

.action {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 0;
  height: 72rpx;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 12rpx;
  background: transparent;
  line-height: 1.2;
  cursor: pointer;
}

.action::after {
  border: none;
}

.action--split {
  border-left: 1px solid #e6e6e6;
}

.action-icon {
  width: 36rpx;
  height: 36rpx;
  flex: none;
}

.action-label {
  color: #1a1a1a;
  font-size: 28rpx;
  font-weight: 500;
}

.action--pressed {
  background: #f6f6f6;
}

.action:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}
</style>

<script setup lang="ts">
import { getCurrentInstance, nextTick, onUnmounted, ref } from "vue";
import { onReady, onShow } from "@dcloudio/uni-app";
import BottomNav from "@/components/BottomNav.vue";
import MiniAppGrid from "@/components/MiniAppGrid.vue";
import { readChosenDestination, type ChosenDestination } from "@/chosen-destination";
import { mountPassengerMap, type MapPlace } from "@/passenger-map";
import { requirePassenger } from "@/passenger-session";

const destinationName = ref("");
let showDestination: ((place: MapPlace, screenY: number) => void) | undefined;

onShow(() => {
  if (!requirePassenger()) return;
  applyDestination(readChosenDestination());
});

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
let disposed = false;
let flowLayout = false;
let wheelTimer = 0;
let measurementVersion = 0;
let followingCard = false;
let sheetElement: HTMLElement | null = null;
let destroyMap: (() => void) | undefined;
let removePointerListeners: (() => void) | undefined;
const animationFrames = new Set<number>();

function frame(callback: () => void) {
  const id = requestAnimationFrame(() => {
    animationFrames.delete(id);
    if (!disposed) callback();
  });
  animationFrames.add(id);
}

function cancelFrames() {
  animationFrames.forEach((id) => cancelAnimationFrame(id));
  animationFrames.clear();
  followingCard = false;
}

function isFlowLayout() {
  return !!sheetElement && getComputedStyle(sheetElement).position !== "absolute";
}

function stopGesture() {
  removePointerListeners?.();
  removePointerListeners = undefined;
  window.clearTimeout(wheelTimer);
  dragging.value = false;
  moved = false;
}

function resetFlowLayout() {
  stopGesture();
  flowLayout = true;
  offset.value = 0;
  minOffset.value = 0;
  restOffset.value = 0;
  maxOffset.value = 0;
  cardShift.value = 0;
  placed.value = true;
  settled.value = true;
}

function openDestination() {
  uni.navigateTo({ url: "/pages/destination/destination" });
}

function markerScreenY() {
  const top = sheetElement?.getBoundingClientRect().top ?? 0;
  if (top > 80) return top * 0.42;
  return window.innerHeight * 0.28;
}

function applyDestination(place: ChosenDestination | null) {
  destinationName.value = place?.name ?? "";
  if (!place) return;
  showDestination?.(place, markerScreenY());
}

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(
    "input, textarea, select, button, a, [role='button'], [contenteditable='true'], uni-input, uni-textarea, uni-button",
  );
}

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

function syncCard(followVisual: boolean) {
  if (disposed || dragging.value) return;
  if (isFlowLayout()) {
    cardShift.value = 0;
    return;
  }
  placeCard(followVisual ? appliedOffset() : offset.value);
  if (!followVisual || Math.abs(appliedOffset() - offset.value) <= 0.5 || followingCard) return;
  followingCard = true;
  frame(() => {
    followingCard = false;
    syncCard(true);
  });
}

function readPinTop() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;padding-top:var(--app-safe-top, 0px);visibility:hidden";
  const root = proxy?.$el;
  (root instanceof HTMLElement ? root : document.body).appendChild(probe);
  pinTop.value = probe.clientHeight;
  probe.remove();
}

function appliedOffset() {
  const sheet = sheetElement;
  if (!(sheet instanceof HTMLElement)) return offset.value;
  const raw = getComputedStyle(sheet).transform;
  if (!raw || raw === "none") return 0;
  const match = raw.match(/matrix\(([^)]+)\)/);
  if (!match) return offset.value;
  const parts = match[1].split(",");
  const y = Number(parts[5]);
  return Number.isFinite(y) ? y : offset.value;
}

function measure(pinCollapsed: boolean, version: number, deadline = Date.now() + 450) {
  if (disposed || version !== measurementVersion || !sheetElement) return;
  // 矮屏使用文档滚动；先判断布局，避免等待被 CSS 禁用的 transform。
  if (isFlowLayout()) {
    resetFlowLayout();
    return;
  }
  flowLayout = false;
  const renderedOffset = appliedOffset();
  if (Math.abs(renderedOffset - offset.value) > 1 && Date.now() < deadline) {
    frame(() => measure(pinCollapsed, version, deadline));
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
      if (disposed || version !== measurementVersion) return;
      if (isFlowLayout()) {
        resetFlowLayout();
        return;
      }
      const screen = res[0];
      const sheet = res[1];
      const pickup = res[2];
      const apps = res[3];
      const nav = res[4];
      if (!screen || !sheet || !pickup || !apps || !nav) return;
      const layoutTop = pickup.top - renderedOffset - cardShift.value;
      const layoutBottom = pickup.bottom - renderedOffset - cardShift.value;
      pickupLayoutTop.value = layoutTop;
      const gap = sheetElement ? parseFloat(getComputedStyle(sheetElement).rowGap) || 0 : 0;
      const target = nav.top - gap;
      const collapsed = target - layoutBottom;
      const rest = renderedOffset + (target - apps.bottom);
      const full = renderedOffset + (screen.bottom - sheet.bottom);
      maxOffset.value = collapsed;
      restOffset.value = Math.min(collapsed, rest);
      minOffset.value = Math.min(restOffset.value, full);
      offset.value = pinCollapsed ? maxOffset.value : clamp(offset.value);
      placeCard(offset.value);
      placed.value = true;
      frame(() => {
        if (version === measurementVersion) settled.value = true;
      });
    });
}

function remeasure() {
  const pinCollapsed = flowLayout || Math.abs(offset.value - maxOffset.value) < 1;
  const version = ++measurementVersion;
  stopGesture();
  cancelFrames();
  settled.value = false;
  readPinTop();
  nextTick(() => measure(pinCollapsed, version));
}

onReady(() => {
  nextTick(() => {
    if (disposed) return;
    bindSheet();
    readPinTop();
    measure(true, ++measurementVersion);
    window.addEventListener("resize", remeasure);
    const root = proxy?.$el;
    const mapSlot = root instanceof HTMLElement ? root.querySelector(".map-slot") : null;
    if (mapSlot instanceof HTMLElement) {
      mountPassengerMap(mapSlot).then((map) => {
        if (disposed) {
          map.destroy();
          return;
        }
        destroyMap = () => map.destroy();
        showDestination = map.showDestination;
        applyDestination(readChosenDestination());
      });
    }
  });
});

function bindSheet() {
  const root = proxy?.$el;
  if (!(root instanceof HTMLElement)) return;
  sheetElement = root.querySelector<HTMLElement>(".below");
  sheetElement?.addEventListener("pointerdown", onPointerDown);
  sheetElement?.addEventListener("wheel", onWheel, { passive: false });
}

function onPointerDown(event: PointerEvent) {
  // 触屏使用模板中的 touch 事件，避免同一次手势重复执行。
  if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0 || isInteractive(event.target)) return;
  if (!begin(event.clientY)) return;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId === event.pointerId) update(ev.clientY);
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== event.pointerId) return;
    removePointerListeners?.();
    removePointerListeners = undefined;
    end();
  };
  removePointerListeners = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

function onWheel(event: WheelEvent) {
  if (disposed || isFlowLayout() || isInteractive(event.target)) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  dragging.value = true;
  offset.value = clamp(offset.value - event.deltaY * unit);
  placeCard(offset.value);
  window.clearTimeout(wheelTimer);
  wheelTimer = window.setTimeout(() => {
    if (disposed) return;
    if (isFlowLayout()) {
      resetFlowLayout();
      return;
    }
    dragging.value = false;
    offset.value = settle(offset.value);
    syncCard(true);
  }, 140);
}

function begin(y: number) {
  if (disposed || isFlowLayout()) return false;
  stopGesture();
  dragging.value = true;
  moved = false;
  startY = y;
  startOffset = offset.value;
  return true;
}

function update(y: number) {
  if (!dragging.value || disposed || isFlowLayout()) return;
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
  if (event.touches.length !== 1 || isInteractive(event.target)) return;
  begin(event.touches[0].clientY);
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length === 1) update(event.touches[0].clientY);
}

function onTouchEnd() {
  end();
}

onUnmounted(() => {
  destroyMap?.();
  disposed = true;
  measurementVersion++;
  stopGesture();
  cancelFrames();
  window.removeEventListener("resize", remeasure);
  sheetElement?.removeEventListener("pointerdown", onPointerDown);
  sheetElement?.removeEventListener("wheel", onWheel);
  sheetElement = null;
});
</script>

<template>
  <view class="screen app-page app-page--viewport">
    <view class="stage">
      <view class="brand">
        <text class="brand-name">万顺</text>
        <text class="brand-en">OneSoon</text>
      </view>
      <view class="map-slot" aria-label="地图展示区域"></view>
    </view>

    <view
      class="below app-content app-content--with-nav app-section-grid"
      :class="{ 'is-dragging': dragging, 'is-ready': placed, 'is-settled': settled }"
      :style="{ transform: `translateY(${offset}px)` }"
      @touchstart="onTouchStart"
      @touchmove.stop="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <view
        class="card app-card pickup-card"
        :class="{ 'is-pinned': cardShift > 0.5 }"
        :style="{ transform: `translateY(${cardShift}px)` }"
      >
        <view class="pickup">
          <view class="pickup-dot" aria-hidden="true"></view>
          <text class="pickup-text">请选择上车点</text>
        </view>

        <view class="field">
          <text class="field-label">目的地</text>
          <view class="field-box" role="button" hover-class="field-box--pressed" @tap="openDestination">
            <image class="search-icon" src="/static/icons/search.svg" mode="aspectFit" aria-hidden="true" />
            <text :class="destinationName ? 'field-value' : 'field-placeholder'">
              {{ destinationName || "输入目的地" }}
            </text>
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

      <view class="card app-card card--apps">
        <MiniAppGrid />
      </view>

      <view class="card app-card card--block">
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

      <view class="card app-card card--block">
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

      <view class="card app-card card--block">
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
  background: #e8eaed;
}

.stage {
  position: absolute;
  inset: 0;
}

.brand {
  position: absolute;
  z-index: 2;
  top: calc(12px + var(--app-safe-top));
  left: calc(var(--app-gutter) + 8px + var(--app-safe-left));
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.brand-name {
  color: #d0121a;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.brand-en {
  color: #3c4149;
  font-size: var(--app-font-small);
  font-weight: 500;
  letter-spacing: 0.04em;
}

.map-slot {
  width: 100%;
  height: 100%;
  background: #e8eaed;
}

.map-slot :deep(.amap-logo) {
  top: calc(12px + var(--app-safe-top)) !important;
  right: 8px !important;
  bottom: auto !important;
  left: auto !important;
}

.map-slot :deep(.amap-copyright) {
  top: calc(34px + var(--app-safe-top)) !important;
  right: 8px !important;
  bottom: auto !important;
  left: auto !important;
  text-align: right;
}

.map-slot :deep(.amap-marker-label) {
  border: 0 !important;
  background: transparent !important;
  padding: 2px 0 0 !important;
  color: #1a1a1a;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  text-shadow: 0 0 2px #ffffff, 0 0 4px #ffffff;
}

.below {
  position: absolute;
  z-index: 3;
  top: 0;
  left: 0;
  right: 0;
  padding-top: var(--app-gap);
  border-radius: var(--app-card-radius) var(--app-card-radius) 0 0;
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
  padding: 14px var(--app-card-padding) 4px;
}

.card--apps {
  grid-column: 1 / -1;
  padding: 8px 4px;
}

.pickup-card {
  position: relative;
  z-index: 5;
  grid-column: 1 / -1;
  padding: 8px var(--app-card-padding) 0;
}

.pickup-card.is-pinned {
  margin-right: calc(0px - var(--app-gutter));
  margin-left: calc(0px - var(--app-gutter));
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: 0 8px 20px rgba(26, 26, 26, 0.12);
}

.card--block {
  padding: 14px var(--app-card-padding) var(--app-card-padding);
}

.block-title {
  display: block;
  margin-bottom: 20rpx;
  color: #1a1a1a;
  font-size: var(--app-font-body);
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
  font-size: var(--app-font-small);
  font-weight: 600;
  line-height: 1.3;
}

.food-dish {
  margin-top: 4rpx;
  color: #3c4149;
  font-size: var(--app-font-small);
  line-height: 1.3;
}

.food-price {
  margin-top: 8rpx;
  color: #d0121a;
  font-size: 14px;
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
  font-size: var(--app-font-body);
  font-weight: 600;
  line-height: 1.2;
}

.field-label {
  display: block;
  margin-bottom: 8rpx;
  color: #3c4149;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.field-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: var(--app-touch-target);
  padding: 0 28rpx;
  border: 2px solid #d0121a;
  border-radius: 999px;
  background: #ffffff;
  box-sizing: border-box;
}

.field-box--pressed {
  background: #f7f7f7;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  flex: none;
}

.field-placeholder,
.field-value {
  min-width: 0;
  overflow: hidden;
  font-size: var(--app-font-body);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.field-placeholder {
  color: #5c6370;
}

.field-value {
  color: #1a1a1a;
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
  min-height: var(--app-touch-target);
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
  font-size: 14px;
  font-weight: 500;
}

.action--pressed {
  background: #f6f6f6;
}

.action:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}

@media (max-height: 500px) {
  .stage {
    position: relative;
    height: 140px;
  }

  .below {
    position: relative;
    transform: none !important;
    visibility: visible;
    touch-action: pan-y;
    cursor: auto;
    transition: none;
  }

  .pickup-card {
    transform: none !important;
  }
}
</style>

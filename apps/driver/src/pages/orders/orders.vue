<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import BottomNav from "../../components/BottomNav.vue";
import OrderOffer from "../../components/OrderOffer.vue";
import { bindDriver, driverState, TRIP_STAGE_LABEL, TRIP_STAGE_ORDER, TRIP_STAGE_SHORT, type ActiveOrder, type TripStage } from "../../driver-state";
import { requireDriver } from "../../driver-session";
import type { TripOrder } from "../../mock-orders";

const detail = ref<TripOrder | null>(null);
const tab = ref<"active" | "done">("active");

/** 已完成订单：与「今日完单」共用同一份持久化明细，数量天然一致 */
const pastOrders = computed(() => driverState.completed);

/** 手上所有没跑完的单 */
const activeOrders = computed<ActiveOrder[]>(() => driverState.orders);

/** 当前阶段在四步里的下标 */
function stageIndex(stage: TripStage) {
  return TRIP_STAGE_ORDER.indexOf(stage);
}

onLoad((options) => {
  // 从「今日完单」跳进来时直接停在「已完成」
  if (options?.tab === "done") {
    tab.value = "done";
  }
});

onShow(() => {
  const driver = requireDriver();
  if (driver) {
    bindDriver(driver);
  }
});

function openDetail(order: TripOrder) {
  detail.value = order;
}

function openActive(id: string) {
  const url = `/pages/trip/trip?id=${id}`;
  uni.navigateTo({
    url,
    fail: () => {
      uni.redirectTo({ url });
    },
  });
}

function closeDetail() {
  detail.value = null;
}

function goHome() {
  uni.reLaunch({ url: "/pages/home/home" });
}
</script>

<template>
  <view class="orders">
    <view class="head">
      <view class="head-copy">
        <text class="head-title">订单</text>
        <text class="head-sub">今日完单 {{ driverState.stats.orders }} 单 · 收入 ¥{{ driverState.stats.income.toFixed(2) }}</text>
      </view>
    </view>

    <view class="tabs">
      <view
        class="tab"
        :class="{ 'tab--active': tab === 'active' }"
        @tap="tab = 'active'"
      >
        <text class="tab-text">进行中</text>
        <text class="tab-count">{{ activeOrders.length }}</text>
      </view>
      <view
        class="tab"
        :class="{ 'tab--active': tab === 'done' }"
        @tap="tab = 'done'"
      >
        <text class="tab-text">已完成</text>
        <text class="tab-count">{{ pastOrders.length }}</text>
      </view>
    </view>

    <scroll-view class="body" :scroll-y="true">
      <template v-if="tab === 'active'">
        <template v-if="activeOrders.length">
          <view
            v-for="item in activeOrders"
            :key="item.id"
            class="active-card"
            role="button"
            @tap="openActive(item.id)"
          >
            <view class="active-top">
              <view class="active-badge">
                <view class="active-dot" />
                <text class="active-badge-text">{{ TRIP_STAGE_LABEL[item.stage] }}</text>
              </view>
              <text class="active-fare">¥{{ item.fare }}</text>
            </view>
            <text class="active-route">{{ item.from.name }} → {{ item.to.name }}</text>

            <view class="steps">
              <view
                v-for="(stage, index) in TRIP_STAGE_ORDER"
                :key="stage"
                class="step"
                :class="{
                  'step--done': index <= stageIndex(item.stage),
                  'step--current': index === stageIndex(item.stage),
                }"
              >
                <view v-if="index > 0" class="step-track" />
                <view class="step-dot" />
                <text class="step-text">{{ TRIP_STAGE_SHORT[stage] }}</text>
              </view>
            </view>

            <view class="active-foot">
              <text class="active-more">查看行程 ›</text>
            </view>
          </view>
        </template>

        <view v-else class="empty">
          <view class="empty-icon">
            <image class="empty-icon-image" src="/static/icons/tab-orders-active.svg" mode="aspectFit" />
          </view>
          <text class="empty-title">暂无进行中的订单</text>
          <text class="empty-sub">在「接单」里接到订单后，会出现在这里</text>
          <button class="empty-btn" hover-class="empty-btn--pressed" @tap="goHome">去接单</button>
        </view>
      </template>

      <template v-else>
        <view class="section-head">
          <text class="section-title">全部订单</text>
          <text class="section-count">{{ pastOrders.length }} 单</text>
        </view>

        <view
          v-for="item in pastOrders"
          :key="item.id"
          class="order-card"
          hover-class="order-card--pressed"
          role="button"
          @tap="openDetail(item)"
        >
          <view class="order-main">
            <text class="order-time">{{ item.finishedAt }}</text>
            <view class="order-route">
              <text class="order-route-text">{{ item.from.name }} → {{ item.to.name }}</text>
              <text class="order-route-sub">{{ item.tripKm }} 公里 · {{ item.tripMinutes }} 分钟 · 已完成</text>
            </view>
            <text class="order-fare">+{{ item.fare }}.00</text>
          </view>
        </view>
      </template>

      <view class="bottom-space" />
    </scroll-view>

    <BottomNav current="orders" />

    <OrderOffer v-if="detail" :order="detail" mode="detail" @close="closeDetail" />
  </view>
</template>

<style scoped>
.orders {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f2f2f2;
}

.head {
  background: #2a2a34;
  padding: calc(28rpx + env(safe-area-inset-top)) 36rpx 32rpx;
  box-sizing: border-box;
}

.head-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.head-title {
  font-size: 44rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.head-sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
}

.tabs {
  display: flex;
  gap: 12rpx;
  padding: 18rpx 30rpx 0;
  margin-top: -6rpx;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 76rpx;
  border-radius: 20rpx;
  background: #ffffff;
}

.tab--active {
  background: #2a2a34;
}

.tab-text {
  font-size: 27rpx;
  color: #6b7078;
}

.tab--active .tab-text {
  color: #ffffff;
  font-weight: 600;
}

.tab-count {
  font-size: 22rpx;
  color: #9aa0a6;
}

.tab--active .tab-count {
  color: rgba(255, 255, 255, 0.55);
}

.body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 30rpx 0;
  box-sizing: border-box;
}

.active-card {
  padding: 26rpx;
  margin-bottom: 20rpx;
  border-radius: 24rpx;
  background: #d0121a;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.active-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.active-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.active-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #ffffff;
  animation: blink 1.4s ease-in-out infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.active-badge-text {
  font-size: 21rpx;
  color: #ffffff;
  letter-spacing: 1rpx;
}

.steps {
  display: flex;
  padding-top: 2rpx;
}

.step {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-track {
  position: absolute;
  top: 7rpx;
  right: 50%;
  width: 100%;
  height: 2rpx;
  background: rgba(255, 255, 255, 0.24);
}

.step--done .step-track {
  background: rgba(255, 255, 255, 0.7);
}

.step-dot {
  position: relative;
  z-index: 2;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
}

.step--done .step-dot {
  background: #ffffff;
}

.step--current .step-dot {
  box-shadow: 0 0 0 6rpx rgba(255, 255, 255, 0.22);
}

.step-text {
  margin-top: 10rpx;
  font-size: 19rpx;
  color: rgba(255, 255, 255, 0.55);
}

.step--done .step-text {
  color: rgba(255, 255, 255, 0.85);
}

.step--current .step-text {
  color: #ffffff;
  font-weight: 600;
}

.active-route {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

.active-foot {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
}

.active-fare {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
}

.active-more {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section-head {
  margin: 32rpx 6rpx 16rpx;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #3c4149;
}

.section-count {
  font-size: 22rpx;
  color: #9aa0a6;
}

.order-card {
  margin-bottom: 16rpx;
  padding: 24rpx 26rpx;
  border-radius: 22rpx;
  background: #ffffff;
}

.order-card--pressed {
  background: #f7f1f1;
}

.order-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.order-time {
  width: 92rpx;
  font-size: 24rpx;
  color: #9aa0a6;
  flex-shrink: 0;
}

.order-route {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.order-route-text {
  font-size: 27rpx;
  font-weight: 600;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-route-sub {
  font-size: 21rpx;
  color: #9aa0a6;
}

.order-fare {
  font-size: 30rpx;
  font-weight: 700;
  color: #d0121a;
  flex-shrink: 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 120rpx 40rpx 60rpx;
}

.empty-icon {
  width: 132rpx;
  height: 132rpx;
  border-radius: 40rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12rpx;
}

.empty-icon-image {
  width: 60rpx;
  height: 60rpx;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
}

.empty-sub {
  font-size: 23rpx;
  color: #9aa0a6;
  text-align: center;
  line-height: 1.6;
}

.empty-btn {
  margin-top: 30rpx;
  width: 320rpx;
  height: 84rpx;
  line-height: 84rpx;
  padding: 0;
  border: none;
  border-radius: 42rpx;
  background: #d0121a;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
}

.empty-btn--pressed {
  background: #b01016;
}

.bottom-space {
  height: calc(190rpx + env(safe-area-inset-bottom));
}
</style>

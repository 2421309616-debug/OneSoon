<script setup lang="ts">
import { computed, onMounted } from "vue";
import BottomNav from "../../components/BottomNav.vue";
import { clearDriver, requireDriver } from "../../driver-session";
import { driverState, goOffline } from "../../driver-state";

const driver = computed(() => driverState.driver);
const initial = computed(() => (driver.value?.name || "司").slice(0, 1));

type MenuItem = { id: string; label: string; value?: string; route?: string };

const menuGroups: MenuItem[][] = [
  [
    { id: "earnings", label: "营收情况", route: "/pages/earnings/earnings" },
    { id: "vehicle", label: "车辆信息", value: "审核通过" },
    { id: "cert", label: "车主认证", value: "已认证" },
  ],
  [
    { id: "help", label: "帮助中心" },
    { id: "settings", label: "设置" },
  ],
];

function openMenu(item: MenuItem) {
  if (item.route) {
    uni.navigateTo({
      url: item.route,
      fail: () => {
        uni.redirectTo({ url: item.route as string });
      },
    });
    return;
  }
  uni.showToast({ title: `${item.label}功能开发中`, icon: "none" });
}

/** 今日完单 → 订单页的「已完成」 */
function goDoneOrders() {
  const url = "/pages/orders/orders?tab=done";
  uni.navigateTo({
    url,
    fail: () => {
      uni.reLaunch({ url });
    },
  });
}

function logout() {
  uni.showModal({
    title: "退出登录",
    content: "确定要退出当前账号吗？",
    confirmText: "退出",
    confirmColor: "#D0121A",
    success: ({ confirm }) => {
      if (!confirm) {
        return;
      }
      // 先把后端状态置为收车，再清掉本地登录信息
      void goOffline().finally(() => {
        clearDriver();
        driverState.driver = null;
        uni.reLaunch({ url: "/pages/login/login" });
      });
    },
  });
}

onMounted(() => {
  requireDriver();
});
</script>

<template>
  <view class="screen">
    <view class="head">
      <view class="head-row">
        <view class="avatar">
          <text class="avatar-text">{{ initial }}</text>
        </view>
        <view class="identity">
          <text class="name">{{ driver?.name || "司机" }}</text>
          <text class="sub">{{ driver?.carModel || "—" }} · {{ driver?.plate || "—" }}</text>
        </view>
        <view class="level-pill">
          <text class="level-text">金牌司机</text>
        </view>
      </view>

      <view class="stats">
        <view class="stat">
          <text class="stat-value">{{ driver?.rating?.toFixed(1) || "5.0" }}</text>
          <text class="stat-label">服务分</text>
        </view>
        <view class="stat-divider" />
        <view
          class="stat stat--link"
          role="button"
          hover-class="stat--pressed"
          @tap="goDoneOrders"
        >
          <text class="stat-value">{{ driverState.stats.orders }}</text>
          <text class="stat-label">今日完单</text>
        </view>
        <view class="stat-divider" />
        <view class="stat">
          <text class="stat-value">100%</text>
          <text class="stat-label">好评率</text>
        </view>
      </view>
    </view>

    <scroll-view class="body" scroll-y>
      <view v-for="(group, groupIndex) in menuGroups" :key="groupIndex" class="group">
        <button
          v-for="item in group"
          :key="item.id"
          class="row"
          hover-class="row--pressed"
          @tap="openMenu(item)"
        >
          <text class="row-label">{{ item.label }}</text>
          <view class="row-right">
            <text v-if="item.value" class="row-value">{{ item.value }}</text>
            <image class="row-chevron" src="/static/icons/chevron-right.svg" mode="aspectFit" />
          </view>
        </button>
      </view>

      <button class="logout" hover-class="logout--pressed" @tap="logout">退出登录</button>

      <text class="version">万顺 OneSoon 司机端 · v1.0.0</text>

      <view class="bottom-space" />
    </scroll-view>

    <BottomNav current="profile" />
  </view>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f2f3f5;
}

.head {
  padding: 34rpx 36rpx 30rpx;
  background: #2a2a34;
  border-radius: 0 0 34rpx 34rpx;
}

.head-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: #d0121a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 8rpx 22rpx rgba(208, 18, 26, 0.32);
}

.avatar-text {
  font-size: 44rpx;
  font-weight: 600;
  color: #ffffff;
}

.identity {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.name {
  font-size: 34rpx;
  font-weight: 600;
  color: #ffffff;
}

.sub {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.level-pill {
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(245, 166, 35, 0.16);
  flex-shrink: 0;
}

.level-text {
  font-size: 20rpx;
  color: #f5a623;
}

.stats {
  display: flex;
  align-items: center;
  margin-top: 30rpx;
  padding: 22rpx 0;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.07);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

/* 可点击的统计项（今日完单） */
.stat--link {
  transition: opacity 0.15s ease;
}

.stat--pressed {
  opacity: 0.5;
}

.stat-value {
  font-size: 30rpx;
  font-weight: 600;
  color: #ffffff;
}

.stat-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.42);
}

.stat-divider {
  width: 1rpx;
  height: 40rpx;
  background: rgba(255, 255, 255, 0.12);
}

.body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 24rpx 0;
  box-sizing: border-box;
}

.group {
  margin-bottom: 22rpx;
  border-radius: 24rpx;
  background: #ffffff;
  overflow: hidden;
  box-shadow: 0 6rpx 20rpx rgba(26, 26, 26, 0.04);
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 28rpx;
  margin: 0;
  background: transparent;
  border: none;
  border-top: 1rpx solid #f5f1f1;
  border-radius: 0;
  line-height: 1.4;
  text-align: left;
}

.row:first-child {
  border-top: none;
}

.row::after {
  border: none;
}

.row--pressed {
  background: #faf7f7;
}

.row-label {
  font-size: 27rpx;
  color: #1a1a1a;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.row-value {
  font-size: 23rpx;
  color: #9aa0a6;
}

.row-chevron {
  width: 26rpx;
  height: 26rpx;
}

.logout {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  margin-top: 8rpx;
  border-radius: 24rpx;
  background: #ffffff;
  color: #d0121a;
  font-size: 29rpx;
  font-weight: 500;
  border: none;
}

.logout::after {
  border: none;
}

.logout--pressed {
  background: #fdf4f5;
}

.version {
  display: block;
  margin-top: 30rpx;
  text-align: center;
  font-size: 20rpx;
  color: #b6bbc2;
}

.bottom-space {
  height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>

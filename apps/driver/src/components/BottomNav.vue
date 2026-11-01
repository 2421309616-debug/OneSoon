<script setup lang="ts">
type TabKey = "home" | "orders" | "profile";

const props = defineProps<{ current: TabKey }>();

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: string;
  activeIcon: string;
  url: string;
}> = [
  {
    key: "home",
    label: "接单",
    icon: "/static/icons/tab-work.svg",
    activeIcon: "/static/icons/tab-work-active.svg",
    url: "/pages/home/home",
  },
  {
    key: "orders",
    label: "订单",
    icon: "/static/icons/tab-orders.svg",
    activeIcon: "/static/icons/tab-orders-active.svg",
    url: "/pages/orders/orders",
  },
  {
    key: "profile",
    label: "我的",
    icon: "/static/icons/tab-me.svg",
    activeIcon: "/static/icons/tab-me-active.svg",
    url: "/pages/profile/profile",
  },
];

function go(key: TabKey, url: string) {
  if (key === props.current) {
    return;
  }
  uni.redirectTo({
    url,
    fail: () => {
      uni.reLaunch({ url });
    },
  });
}
</script>

<template>
  <view class="bottom-nav">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="nav-item"
      :class="{ 'nav-item--active': tab.key === current }"
      role="button"
      hover-class="nav-item--pressed"
      @tap="go(tab.key, tab.url)"
    >
      <image
        class="nav-icon"
        :src="tab.key === current ? tab.activeIcon : tab.icon"
        mode="aspectFit"
      />
      <text class="nav-label">{{ tab.label }}</text>
    </button>
  </view>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 400;
  display: flex;
  background: #ffffff;
  border-top: 1rpx solid #ece7e7;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -6rpx 24rpx rgba(26, 26, 26, 0.05);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 16rpx 0 14rpx;
  margin: 0;
  background: transparent;
  border: none;
  line-height: 1;
  color: #8a8f99;
}

.nav-item::after {
  border: none;
}

.nav-item--pressed {
  background: #faf7f7;
}

.nav-item--active {
  color: #d0121a;
}

.nav-icon {
  width: 46rpx;
  height: 46rpx;
}

.nav-label {
  font-size: 22rpx;
  line-height: 1.2;
  color: inherit;
}
</style>

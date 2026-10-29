<script setup lang="ts">
import BottomNav from "@/components/BottomNav.vue";

const entries = [
  { id: "orders", name: "全部订单", icon: "/static/icons/entry-orders.svg" },
  { id: "depart", name: "待出发", icon: "/static/icons/entry-depart.svg" },
  { id: "service", name: "客服", icon: "/static/icons/entry-service.svg" },
  { id: "settings", name: "设置", icon: "/static/icons/entry-settings.svg" },
];

function logout() {
  uni.showModal({
    title: "退出登录",
    content: "确定要退出登录吗？",
    confirmText: "退出登录",
    confirmColor: "#d0121a",
    success: ({ confirm }) => {
      if (!confirm) return;

      uni.removeStorageSync("token");
      uni.removeStorageSync("accessToken");
      uni.removeStorageSync("refreshToken");
      uni.showToast({ title: "已退出登录", icon: "success" });
      setTimeout(() => uni.reLaunch({ url: "/pages/home/home" }), 500);
    },
  });
}
</script>

<template>
  <view class="app-page">
    <view class="sheet app-content app-content--with-nav">
      <view class="app-card profile-card">
        <view class="avatar" aria-hidden="true">
          <text class="avatar-text">万</text>
        </view>
        <text class="name">万顺用户</text>
        <text class="en">OneSoon</text>
      </view>

      <view class="app-card entry-card" aria-label="功能入口">
        <button
          v-for="item in entries"
          :key="item.id"
          class="entry"
          role="button"
          hover-class="entry--pressed"
        >
          <image class="entry-icon" :src="item.icon" mode="aspectFit" aria-hidden="true" />
          <text class="entry-name">{{ item.name }}</text>
        </button>
      </view>

      <view class="app-card logout-card">
        <button class="logout-button" hover-class="logout-button--pressed" @tap="logout">
          <text class="logout-label">退出登录</text>
        </button>
      </view>
    </view>
    <BottomNav current="profile" />
  </view>
</template>

<style scoped>
.sheet {
  display: flex;
  flex-direction: column;
  gap: var(--app-gap);
}

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px var(--app-card-padding) 20px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: #d0121a;
}

.avatar-text {
  color: #ffffff;
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1;
}

.name {
  margin-top: 28rpx;
  color: #1a1a1a;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
}

.en {
  margin-top: 8rpx;
  color: #3c4149;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0.04em;
}

.entry-card {
  display: flex;
  padding: 12rpx 8rpx;
}

.entry {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  width: 0;
  min-width: 0;
  min-height: 148rpx;
  margin: 0;
  padding: 16rpx 0;
  border: 0;
  border-radius: 16rpx;
  background: transparent;
  line-height: 1.3;
  cursor: pointer;
  box-sizing: border-box;
}

.entry::after {
  border: none;
}

.entry--pressed {
  background: #f7f1f1;
}

.entry:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}

.entry-icon {
  width: 64rpx;
  height: 64rpx;
}

.entry-name {
  max-width: 100%;
  color: #1a1a1a;
  font-size: var(--app-font-small);
  font-weight: 500;
}

.logout-card {
  overflow: hidden;
}

.logout-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  line-height: 1.4;
}

.logout-button::after {
  border: 0;
}

.logout-button--pressed {
  background: #f7f1f1;
}

.logout-button:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -2px;
}

.logout-label {
  color: #d0121a;
  font-size: var(--app-font-body);
  font-weight: 500;
}
</style>

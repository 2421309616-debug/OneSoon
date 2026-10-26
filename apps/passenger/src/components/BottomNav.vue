<script setup lang="ts">
defineProps<{
  current: "home" | "profile";
}>();

function go(url: string) {
  const stack = getCurrentPages();
  const route = stack[stack.length - 1]?.route ?? "";
  const target = url.replace(/^\//, "");
  if (route === target) return;
  uni.redirectTo({ url });
}
</script>

<template>
  <view class="nav">
    <button
      class="nav-item"
      role="button"
      hover-class="nav-item--pressed"
      :aria-current="current === 'home' ? 'page' : undefined"
      @tap="go('/pages/home/home')"
    >
      <image
        class="nav-icon"
        :src="current === 'home' ? '/static/icons/home-active.svg' : '/static/icons/home.svg'"
        mode="aspectFit"
        aria-hidden="true"
      />
      <text class="nav-label" :class="{ 'nav-label--active': current === 'home' }">首页</text>
    </button>
    <button
      class="nav-item"
      role="button"
      hover-class="nav-item--pressed"
      :aria-current="current === 'profile' ? 'page' : undefined"
      @tap="go('/pages/profile/profile')"
    >
      <image
        class="nav-icon"
        :src="current === 'profile' ? '/static/icons/user-active.svg' : '/static/icons/user.svg'"
        mode="aspectFit"
        aria-hidden="true"
      />
      <text class="nav-label" :class="{ 'nav-label--active': current === 'profile' }">我的</text>
    </button>
  </view>
</template>

<style scoped>
.nav {
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: 100%;
  max-width: 375px;
  margin: 0 auto;
  background: #ffffff;
  border-top: 1px solid #ece7e7;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.nav-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-height: 100rpx;
  margin: 0;
  padding: 8rpx 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  line-height: 1.2;
  cursor: pointer;
}

.nav-item::after {
  border: none;
}

.nav-item--pressed {
  opacity: 0.55;
}

.nav-item:focus-visible {
  outline: 2px solid #d0121a;
  outline-offset: -4px;
}

.nav-icon {
  width: 48rpx;
  height: 48rpx;
}

.nav-label {
  color: #3c4149;
  font-size: 24rpx;
  font-weight: 500;
}

.nav-label--active {
  color: #d0121a;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .nav-item--pressed {
    opacity: 1;
  }
}
</style>

<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string; backTo?: string; actionText?: string }>(), {
  backTo: "/pages/home/home",
  actionText: "",
});

function back() {
  const stack = getCurrentPages();
  if (stack.length > 1) uni.navigateBack();
  else uni.redirectTo({ url: props.backTo });
}
</script>

<template>
  <view class="driver-header">
    <button class="driver-header-back" aria-label="返回" @tap="back"><view class="driver-header-chevron" /></button>
    <text class="driver-header-title">{{ title }}</text>
    <slot name="right">
      <text class="driver-header-action">{{ actionText }}</text>
    </slot>
  </view>
</template>

<style scoped>
.driver-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 54px;
  padding: 0 14px;
  border-bottom: 1px solid #41424c;
  background: #2a2a34;
}

.driver-header-back {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #f4f5f7;
  line-height: 1;
}

.driver-header-back::after { border: 0; }
.driver-header-chevron {
  width: 9px;
  height: 9px;
  margin-left: 4px;
  border-bottom: 2px solid #f4f5f7;
  border-left: 2px solid #f4f5f7;
  transform: rotate(45deg);
}
.driver-header-title { display: flex; flex: 1; align-items: center; min-height: 44px; color: #ffffff; font-size: 17px; font-weight: 700; line-height: 1.2; }
.driver-header-action { color: #f1b7bb; font-size: 13px; font-weight: 600; }
</style>

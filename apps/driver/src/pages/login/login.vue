<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import {
  enterWithCode,
  requestVerificationCode,
  toDriverSession,
} from "../../driver-api";
import { readDriver, saveDriver } from "../../driver-session";

const phone = ref("");
const code = ref("");
const error = ref("");
const notice = ref("");
const requesting = ref(false);
const entering = ref(false);

const phoneOk = computed(() => /^1\d{10}$/.test(phone.value.trim()));
const codeOk = computed(() => /^\d{6}$/.test(code.value.trim()));
const canSubmit = computed(() => phoneOk.value && codeOk.value);

onShow(() => {
  if (readDriver()) {
    uni.reLaunch({ url: "/pages/home/home" });
  }
});

function fillDemo() {
  phone.value = "13800138000";
  code.value = "";
  uni.showToast({ title: "已填入演示手机号，请点获取验证码", icon: "none" });
}

async function requestCode() {
  error.value = "";
  notice.value = "";
  if (!phoneOk.value) {
    error.value = "请输入 11 位手机号";
    return;
  }
  requesting.value = true;
  try {
    await requestVerificationCode(phone.value.trim());
    notice.value = "验证码已打印在运行后端的终端里，5 分钟内有效。";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "获取验证码失败";
  } finally {
    requesting.value = false;
  }
}

async function submit() {
  error.value = "";
  if (!canSubmit.value) {
    error.value = "请填写手机号和 6 位验证码";
    return;
  }
  entering.value = true;
  try {
    const driver = await enterWithCode(phone.value.trim(), code.value.trim());
    saveDriver(toDriverSession(driver));
    uni.showToast({ title: "登录成功", icon: "success", duration: 900 });
    setTimeout(() => {
      uni.reLaunch({ url: "/pages/home/home" });
    }, 600);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败";
  } finally {
    entering.value = false;
  }
}
</script>

<template>
  <view class="screen">
    <view class="brand">
      <text class="brand-cn">万顺</text>
      <text class="brand-en">OneSoon</text>
      <text class="brand-slogan">司机端 · 轻松接单，安心出行</text>
    </view>

    <view class="card">
      <text class="card-title">手机号登录</text>

      <view class="field">
        <text class="field-prefix">+86</text>
        <input
          v-model="phone"
          class="field-input"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="field-placeholder"
          :disabled="requesting || entering"
        />
        <button
          class="code-button"
          hover-class="code-button--pressed"
          :disabled="!phoneOk || requesting || entering"
          @tap="requestCode"
        >
          {{ requesting ? "获取中" : "获取验证码" }}
        </button>
      </view>

      <view class="field">
        <text class="field-prefix">验证码</text>
        <input
          v-model="code"
          class="field-input"
          type="number"
          maxlength="6"
          placeholder="请输入 6 位验证码"
          placeholder-class="field-placeholder"
          :disabled="entering"
        />
      </view>

      <text v-if="notice" class="notice">{{ notice }}</text>
      <text v-if="error" class="error" role="alert">{{ error }}</text>

      <button
        class="submit"
        :class="{ 'submit--disabled': !canSubmit }"
        hover-class="submit--pressed"
        :disabled="entering"
        @tap="submit"
      >
        {{ entering ? "正在登录" : "登录并开始接单" }}
      </button>

      <button class="demo" hover-class="demo--pressed" @tap="fillDemo">
        填入演示手机号
      </button>
    </view>

    <text class="footer">登录即代表同意《司机服务协议》与《隐私政策》</text>
  </view>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #2a2a34;
  padding: 0 44rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 110rpx;
}

.brand-cn {
  font-size: 68rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 6rpx;
}

.brand-en {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.42);
  letter-spacing: 6rpx;
  text-transform: uppercase;
}

.brand-slogan {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.55);
}

.card {
  margin-top: 60rpx;
  padding: 40rpx 34rpx 34rpx;
  border-radius: 30rpx;
  background: #ffffff;
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.28);
}

.card-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 28rpx;
}

.field {
  display: flex;
  align-items: center;
  gap: 20rpx;
  height: 96rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  border-radius: 18rpx;
  background: #faf8f8;
}

.field-prefix {
  font-size: 26rpx;
  color: #3c4149;
  font-weight: 500;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  color: #1a1a1a;
}

.field-placeholder {
  color: #b6bbc2;
  font-size: 26rpx;
}

.code-button {
  flex-shrink: 0;
  height: 60rpx;
  line-height: 60rpx;
  padding: 0 22rpx;
  margin: 0;
  border-radius: 30rpx;
  background: #fdecee;
  color: #d0121a;
  font-size: 23rpx;
  font-weight: 600;
  border: none;
}

.code-button::after {
  border: none;
}

.code-button--pressed {
  background: #f7d9dc;
}

.code-button[disabled] {
  background: #f5f3f3;
  color: #c3c7cd;
}

.notice {
  display: block;
  font-size: 22rpx;
  line-height: 1.5;
  color: #8a8f99;
  margin-bottom: 12rpx;
}

.error {
  display: block;
  font-size: 22rpx;
  line-height: 1.5;
  color: #d0121a;
  margin-bottom: 12rpx;
}

.submit {
  width: 100%;
  height: 98rpx;
  line-height: 98rpx;
  margin-top: 14rpx;
  border-radius: 49rpx;
  background: #d0121a;
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
  border: none;
  box-shadow: 0 14rpx 30rpx rgba(208, 18, 26, 0.28);
}

.submit::after {
  border: none;
}

.submit--disabled {
  background: #f0c7ca;
  box-shadow: none;
}

.submit--pressed {
  background: #b30f16;
}

.demo {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  margin-top: 16rpx;
  border-radius: 40rpx;
  background: transparent;
  color: #8a8f99;
  font-size: 25rpx;
  border: none;
}

.demo::after {
  border: none;
}

.demo--pressed {
  background: #faf8f8;
}

.footer {
  margin-top: auto;
  padding: 40rpx 0 calc(50rpx + env(safe-area-inset-bottom));
  text-align: center;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.3);
}
</style>

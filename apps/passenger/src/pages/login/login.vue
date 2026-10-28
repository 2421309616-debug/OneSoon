<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { enterWithCode, requestVerificationCode } from "@/passenger-api";
import { readPassenger, savePassenger } from "@/passenger-session";

const phone = ref("");
const code = ref("");
const error = ref("");
const notice = ref("");
const requesting = ref(false);
const entering = ref(false);

const phoneReady = computed(() => phone.value.trim() !== "");
const codeReady = computed(() => /^\d{6}$/.test(code.value.trim()));

onShow(() => {
  if (readPassenger()) {
    uni.reLaunch({ url: "/pages/home/home" });
  }
});

async function requestCode() {
  error.value = "";
  notice.value = "";
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

async function enterHome() {
  error.value = "";
  entering.value = true;
  try {
    const passenger = await enterWithCode(phone.value.trim(), code.value.trim());
    savePassenger(passenger);
    uni.reLaunch({ url: "/pages/home/home" });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败";
  } finally {
    entering.value = false;
  }
}
</script>

<template>
  <view class="login-screen">
    <view class="login">
    <view class="brand">
      <text class="brand-name">万顺</text>
      <text class="brand-en">OneSoon</text>
    </view>

    <view class="form">
      <view class="field">
        <text class="label" id="passenger-phone-label">手机号</text>
        <view class="phone-row">
          <input
            id="passenger-phone"
            v-model="phone"
            class="input"
            type="tel"
            maxlength="20"
            placeholder="请输入手机号"
            placeholder-class="placeholder"
            confirm-type="next"
            aria-labelledby="passenger-phone-label"
            :disabled="requesting || entering"
          />
          <button
            class="code-button"
            hover-class="code-button--pressed"
            :disabled="!phoneReady || requesting || entering"
            @tap="requestCode"
          >
            <text class="code-button-sizer" aria-hidden="true">获取验证码</text>
            <text class="code-button-label">{{ requesting ? "获取中" : "获取验证码" }}</text>
          </button>
        </view>
      </view>

      <view class="field">
        <text class="label" id="passenger-code-label">验证码</text>
        <view class="phone-row">
          <input
            id="passenger-code"
            v-model="code"
            class="input input--code"
            type="tel"
            maxlength="6"
            inputmode="numeric"
            placeholder="请输入 6 位验证码"
            placeholder-class="placeholder"
            confirm-type="done"
            aria-labelledby="passenger-code-label"
            :disabled="entering"
            @confirm="codeReady && enterHome()"
          />
          <view class="code-button code-button--spacer" aria-hidden="true">获取验证码</view>
        </view>
      </view>

      <text v-if="notice" class="notice">{{ notice }}</text>
      <text v-if="error" class="error" role="alert">{{ error }}</text>

      <view class="phone-row">
        <button
          class="button button--primary"
          hover-class="button--pressed"
          :disabled="!phoneReady || !codeReady || requesting || entering"
          @tap="enterHome"
        >
          {{ entering ? "正在登录" : "登录" }}
        </button>
        <view class="code-button code-button--spacer" aria-hidden="true">获取验证码</view>
      </view>
    </view>
    </view>
  </view>
</template>

<style scoped>
.login-screen {
  min-height: var(--app-viewport-height);
  background: #f2f3f5;
}

.login {
  width: min(100%, 390px);
  min-height: var(--app-viewport-height);
  margin: 0 auto;
  padding: calc(var(--app-safe-top) + 72px) 24px calc(var(--app-safe-bottom) + 32px);
  background: #ffffff;
}

.brand-name {
  display: block;
  color: #d0121a;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.brand-en {
  display: block;
  margin-top: 8px;
  color: #3c4149;
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 48px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label {
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 2px solid #d0121a;
  border-radius: 12px;
  background: #ffffff;
  color: #1a1a1a;
  font-size: 16px;
  caret-color: #d0121a;
}

.input:focus {
  outline: 3px solid rgba(208, 18, 26, 0.28);
  outline-offset: 2px;
}

.input--code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2em;
}

.placeholder {
  color: #5c6370;
  letter-spacing: 0;
}

.notice {
  color: #3c4149;
  font-size: 16px;
  line-height: 1.5;
}

.error {
  color: #d0121a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  margin: 0;
  padding: 0 16px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}

.button::after {
  border: none;
}

.phone-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phone-row .input,
.phone-row .button {
  flex: 1;
  width: auto;
  min-width: 0;
}

.code-button {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid #d0121a;
  border-radius: 12px;
  background: #ffffff;
  color: #d0121a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
}

.code-button-sizer {
  visibility: hidden;
}

.code-button-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-button--spacer {
  visibility: hidden;
  pointer-events: none;
}

.code-button::after {
  border: none;
}

.code-button[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.code-button:focus-visible {
  outline: 3px solid rgba(208, 18, 26, 0.28);
  outline-offset: 2px;
}

.code-button--pressed {
  opacity: 0.82;
}

.button--primary {
  margin-top: 8px;
  border: 0;
  background: #d0121a;
  color: #ffffff;
}

.button[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.button:focus-visible {
  outline: 3px solid rgba(208, 18, 26, 0.28);
  outline-offset: 2px;
}

.button--pressed {
  opacity: 0.82;
}
</style>

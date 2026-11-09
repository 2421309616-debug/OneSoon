<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { enterWithCode, requestVerificationCode } from "@/passenger-api";
import { readPassenger, savePassenger } from "@/passenger-session";

const dialCode = ref("+86");
const phone = ref("");
const code = ref("");
const error = ref("");
const notice = ref("");
const requesting = ref(false);
const entering = ref(false);

const canRequest = computed(() => phone.value.trim().length >= 6 && !requesting.value && !entering.value);
const canSubmit = computed(() => phone.value.trim().length >= 6 && /^\d{6}$/.test(code.value.trim()) && !entering.value);

onShow(() => {
  if (readPassenger()) {
    uni.reLaunch({ url: "/pages/home/home" });
  }
});

async function requestCode() {
  if (!canRequest.value) return;
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
  if (!canSubmit.value) return;
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
      <text class="label" id="passenger-phone-label">手机号</text>
      <view class="phone-row">
        <input
          v-model="dialCode"
          class="input dial-input"
          maxlength="4"
          aria-label="国际区号"
        />
        <input
          id="passenger-phone"
          v-model="phone"
          class="input phone-input"
          type="tel"
          maxlength="20"
          placeholder="请输入手机号"
          placeholder-class="placeholder"
          confirm-type="next"
          aria-labelledby="passenger-phone-label"
          :disabled="requesting || entering"
        />
      </view>
      <text class="label" id="passenger-code-label">验证码</text>
      <view class="code-row">
        <input
          id="passenger-code"
          v-model="code"
          class="input"
          type="tel"
          maxlength="6"
          inputmode="numeric"
          placeholder="请输入 6 位验证码"
          placeholder-class="placeholder"
          confirm-type="done"
          aria-labelledby="passenger-code-label"
          :disabled="entering"
          @confirm="enterHome"
        />
        <button class="code-button" hover-class="code-button--pressed" :disabled="!canRequest" @tap="requestCode">
          {{ requesting ? "发送中" : "获取验证码" }}
        </button>
      </view>
      <text v-if="notice" class="notice">{{ notice }}</text>
      <text v-if="error" class="error" role="alert">{{ error }}</text>
      <button class="button button--primary" hover-class="button--pressed" :disabled="!canSubmit" @tap="enterHome">
        {{ entering ? "正在登录…" : "登录/注册" }}
      </button>
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
  width: min(100%, 375px);
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
  margin-top: 48px;
}

.label {
  display: block;
  margin: 14px 0 7px;
  color: #252630;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
}

.form .label:first-child {
  margin-top: 0;
}

.input {
  box-sizing: border-box;
  width: 100%;
  height: 48px;
  padding: 0 13px;
  border: 1px solid #d9dce2;
  border-radius: 11px;
  background: #ffffff;
  color: #20212a;
  font-size: 15px;
  caret-color: #d0121a;
}

.input:focus {
  border-color: #d0121a;
  outline: 2px solid #f0c5c8;
  outline-offset: 1px;
}

.placeholder {
  color: #8b909a;
}

.notice,
.error {
  display: block;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.notice {
  color: #198357;
}

.error {
  color: #c5222d;
}

.button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin: 23px 0 0;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}

.button::after,
.code-button::after {
  border: none;
}

.phone-row,
.code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.phone-row .input,
.code-row .input,
.code-button {
  box-sizing: border-box;
}

.phone-row .phone-input,
.code-row .input {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}

.dial-input {
  flex: 0 0 68px;
  width: 68px;
  padding: 0;
  text-align: center;
}

.code-button {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 0;
  padding: 0 11px;
  border: 1px solid #f0c5c8;
  border-radius: 11px;
  background: #fff6f6;
  color: #c5222d;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
}

.code-button[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.code-button--pressed {
  opacity: 0.82;
}

.button--primary {
  background: #d0121a;
  color: #ffffff;
}

.button[disabled] {
  background: #e7e8eb;
  color: #a3a8b2;
  cursor: not-allowed;
}

.button--pressed {
  opacity: 0.82;
}
</style>

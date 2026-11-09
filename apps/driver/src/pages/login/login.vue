<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { driverApi } from "@/driver-api";
import { isCertificationSkipped, readDriver, saveDriver, type DriverSession } from "@/driver-session";

const dialCode = ref("+86");
const phone = ref("");
const code = ref("");
const notice = ref("");
const error = ref("");
const requesting = ref(false);
const submitting = ref(false);
const canRequest = computed(() => phone.value.trim().length >= 6 && !requesting.value && !submitting.value);
const canSubmit = computed(() => phone.value.trim().length >= 6 && /^\d{6}$/.test(code.value.trim()) && !submitting.value);

function destination(driver: DriverSession) {
  return driver.profileComplete || isCertificationSkipped(driver.id) ? "/pages/home/home" : "/pages/certification/certification";
}

onShow(() => {
  const driver = readDriver();
  if (driver) uni.reLaunch({ url: destination(driver) });
});

async function requestCode() {
  if (!canRequest.value) return;
  notice.value = "";
  error.value = "";
  requesting.value = true;
  try {
    await driverApi.requestVerificationCode(phone.value.trim());
    notice.value = "验证码已打印在运行后端的终端里，5 分钟内有效。";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "验证码发送失败，请稍后重试。";
  } finally {
    requesting.value = false;
  }
}

async function login() {
  if (!canSubmit.value) return;
  error.value = "";
  submitting.value = true;
  try {
    const session = await driverApi.login(phone.value.trim(), code.value.trim());
    saveDriver(session);
    uni.reLaunch({ url: destination(session) });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败，请检查验证码。";
    submitting.value = false;
  }
}
</script>

<template>
  <view class="driver-page login-page">
    <view class="login-brand"><text class="brand-cn">万顺</text><text class="brand-en">OneSoon · 司机端</text></view>
    <view class="login-intro"><text class="driver-eyebrow">司机工作台</text><text class="driver-title">欢迎回来</text><text class="driver-muted">登录后管理听单、行程与每日收入</text></view>
    <view class="login-form">
      <text class="driver-form-label" id="driver-phone-label">手机号</text>
      <view class="phone-row">
        <input
          v-model="dialCode"
          class="driver-input dial-input"
          maxlength="4"
          aria-label="国际区号"
        />
        <input
          v-model="phone"
          class="driver-input phone-input"
          type="tel"
          maxlength="20"
          placeholder="请输入手机号"
          aria-labelledby="driver-phone-label"
          :disabled="requesting || submitting"
        />
      </view>
      <text class="driver-form-label" id="driver-code-label">验证码</text>
      <view class="code-row">
        <input
          v-model="code"
          class="driver-input"
          type="tel"
          maxlength="6"
          inputmode="numeric"
          placeholder="请输入 6 位验证码"
          aria-labelledby="driver-code-label"
          :disabled="submitting"
        />
        <button class="code-button" :disabled="!canRequest" @tap="requestCode">{{ requesting ? "发送中" : "获取验证码" }}</button>
      </view>
      <text v-if="notice" class="login-notice">{{ notice }}</text>
      <text v-if="error" class="login-error" role="alert">{{ error }}</text>
      <button class="driver-primary login-submit" :disabled="!canSubmit" @tap="login">{{ submitting ? "正在登录…" : "登录/注册" }}</button>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.login-page { display: flex; flex-direction: column; padding: 64px 22px 24px; background: #fff; }
.login-brand { display: flex; align-items: baseline; gap: 8px; }
.brand-cn { color: #d0121a; font-size: 36px; font-weight: 800; letter-spacing: -.04em; }
.brand-en { color: #3c4149; font-size: 13px; font-weight: 550; }
.login-intro { margin-top: 70px; }
.login-form { margin-top: 28px; }
.login-form .driver-form-label:first-child { margin-top: 0; }
.phone-row,
.code-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.phone-row .driver-input,
.code-row .driver-input,
.code-button { box-sizing: border-box; }
.phone-row .phone-input,
.code-row .driver-input { flex: 1 1 auto; width: auto; min-width: 0; }
.dial-input { flex: 0 0 68px; width: 68px; padding: 0; text-align: center; }
.phone-row .driver-input:focus,
.code-row .driver-input:focus { border-color: #d0121a; outline: 2px solid #f0c5c8; outline-offset: 1px; }
.code-button { flex: none; height: 48px; margin: 0; padding: 0 11px; border: 1px solid #f0c5c8; border-radius: 11px; background: #fff6f6; color: #c5222d; font-size: 12px; font-weight: 650; }
.code-button::after { border: 0; }
.code-button[disabled] { opacity: .45; }
.login-notice,.login-error { display: block; margin-top: 10px; font-size: 12px; }
.login-notice { color: #198357; }
.login-error { color: #c5222d; }
.login-submit { margin-top: 23px; }
.login-submit[disabled] { background: #e7e8eb; color: #a3a8b2; }
</style>

<script setup lang="ts">
import { computed, ref } from "vue";
import { driverApi } from "@/driver-api";

const phone = ref("");
const code = ref("");
const notice = ref("");
const error = ref("");
const requesting = ref(false);
const submitting = ref(false);
const canRequest = computed(() => phone.value.trim().length >= 6 && !requesting.value && !submitting.value);
const canSubmit = computed(() => phone.value.trim().length >= 6 && /^\d{6}$/.test(code.value) && !submitting.value);

async function requestCode() {
  if (!canRequest.value) return;
  notice.value = ""; error.value = ""; requesting.value = true;
  try {
    const result = await driverApi.requestVerificationCode(phone.value.trim());
    notice.value = result?.demoCode ? `演示验证码：${result.demoCode}` : "验证码已发送，请查看手机或后端终端。";
  } catch {
    error.value = "验证码发送失败，请稍后重试。";
  } finally { requesting.value = false; }
}

async function login() {
  if (!canSubmit.value) return;
  error.value = ""; submitting.value = true;
  try {
    const session = await driverApi.login(phone.value.trim(), code.value.trim());
    if (!session) throw new Error("登录服务暂不可用");
    uni.setStorageSync("onesoon-driver", session);
    uni.showToast({ title: `欢迎，${session.displayName}`, icon: "none" });
    setTimeout(() => uni.redirectTo({ url: "/pages/home/home" }), 450);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败，请检查验证码。";
  } finally { submitting.value = false; }
}

function backHome() { uni.redirectTo({ url: "/pages/home/home" }); }
</script>

<template>
  <view class="driver-page login-page">
    <view class="login-brand"><text class="brand-cn">万顺</text><text class="brand-en">OneSoon · 司机端</text></view>
    <view class="login-intro"><text class="driver-eyebrow">司机工作台</text><text class="driver-title">欢迎回来</text><text class="driver-muted">登录后管理听单、行程与每日收入</text></view>
    <view class="login-form">
      <text class="driver-form-label">手机号</text>
      <input v-model="phone" class="driver-input" type="tel" maxlength="20" placeholder="请输入注册手机号" />
      <text class="driver-form-label">验证码</text>
      <view class="code-row"><input v-model="code" class="driver-input" type="number" maxlength="6" placeholder="请输入 6 位验证码" /><button class="code-button" :disabled="!canRequest" @tap="requestCode">{{ requesting ? "发送中" : "获取验证码" }}</button></view>
      <text v-if="notice" class="login-notice">{{ notice }}</text><text v-if="error" class="login-error">{{ error }}</text>
      <button class="driver-primary login-submit" :disabled="!canSubmit" @tap="login">{{ submitting ? "正在登录…" : "登录" }}</button>
      <text class="login-footnote">演示模式使用模拟验证码，接入后端后将使用服务端验证。</text>
    </view>
    <button class="back-home" @tap="backHome">返回司机首页</button>
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
.code-row { display: flex; align-items: center; gap: 8px; }
.code-row .driver-input { flex: 1; min-width: 0; }
.code-button { flex: none; height: 48px; margin: 0; padding: 0 11px; border: 1px solid #f0c5c8; border-radius: 11px; background: #fff6f6; color: #c5222d; font-size: 12px; font-weight: 650; }
.code-button::after { border: 0; }
.code-button[disabled] { opacity: .45; }
.login-notice,.login-error { display: block; margin-top: 10px; font-size: 12px; }
.login-notice { color: #198357; }
.login-error { color: #c5222d; }
.login-submit { margin-top: 23px; }
.login-submit[disabled] { background: #e7e8eb; color: #a3a8b2; }
.login-footnote { display: block; margin-top: 15px; color: #8a909b; font-size: 11px; line-height: 1.5; }
.back-home { align-self: center; margin: auto 0 0; padding: 10px 15px; border: 0; background: transparent; color: #707784; font-size: 13px; }
.back-home::after { border: 0; }
</style>

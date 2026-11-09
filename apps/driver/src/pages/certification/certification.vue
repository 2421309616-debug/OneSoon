<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onReady, onShow } from "@dcloudio/uni-app";
import gsap from "gsap";
import { apiAsset, driverApi } from "@/driver-api";
import { clearCertificationSkip, readDriver, requireDriver, saveDriver, skipCertification } from "@/driver-session";
import type { DriverSession } from "@/driver-session";

const steps = ["个人资料", "车辆", "证件"];
const vehicleTypes = ["跑车", "轿车"];
const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const name = ref("");
const idNumber = ref("");
const vehicleModel = ref("");
const plate = ref("");
const photo = ref("");
const driverLicense = ref("");
const vehicleLicense = ref("");
const error = ref("");
const submitting = ref(false);
const step = ref(0);
const typeOpen = ref(false);
const section = ref<"" | "personal" | "vehicle" | "documents">("");
const idOnFile = ref(false);
const existingPhotoUrl = ref("");
const profileLoaded = ref(false);

const idReady = computed(() => /^[0-9]{17}[0-9Xx]$/.test(idNumber.value.trim()));
const photoPreview = computed(() => photo.value || existingPhotoUrl.value);
const personalReady = computed(
  () => name.value.trim() !== "" && (idReady.value || (idOnFile.value && idNumber.value.trim() === "")) && photoPreview.value !== "",
);
const vehicleReady = computed(() => vehicleTypes.includes(vehicleModel.value) && plate.value.trim() !== "");
const documentsReady = computed(() => driverLicense.value !== "" && vehicleLicense.value !== "");
const stepReady = computed(() => [personalReady.value, vehicleReady.value, documentsReady.value][step.value]);

async function chooseType(type: string) {
  if (submitting.value || !vehicleTypes.includes(type)) return;
  vehicleModel.value = type;
  typeOpen.value = false;
  const driver = readDriver();
  if (!driver) return;
  try {
    await driverApi.setVehicleType(driver.id, type);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存车型失败";
  }
}

function remember(session: DriverSession) {
  saveDriver(session);
  if (session.profileComplete) clearCertificationSkip(session.id);
}

async function saveCurrent(driverId: string) {
  if (step.value === 0) {
    const payload: Record<string, string> = { name: name.value.trim() };
    if (idNumber.value.trim()) payload.idNumber = idNumber.value.trim().toUpperCase();
    if (photo.value) payload.photo = photo.value;
    return driverApi.savePersonal(driverId, payload);
  }
  if (step.value === 1) {
    return driverApi.saveVehicle(driverId, { vehicleModel: vehicleModel.value, plate: plate.value.trim() });
  }
  return driverApi.saveDocuments(driverId, { driverLicense: driverLicense.value, vehicleLicense: vehicleLicense.value });
}

async function persistStep() {
  const driver = readDriver();
  if (!driver || submitting.value) return false;
  error.value = "";
  submitting.value = true;
  try {
    remember(await saveCurrent(driver.id));
    return true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "保存失败";
    return false;
  } finally {
    submitting.value = false;
  }
}

async function nextStep() {
  if (!stepReady.value || submitting.value || step.value >= 2) return;
  if (await persistStep()) step.value += 1;
}

async function saveAndReturn() {
  if (!stepReady.value || !(await persistStep())) return;
  backToProfile();
}

function backToProfile() {
  if (submitting.value) return;
  if (getCurrentPages().length > 1) uni.navigateBack();
  else uni.redirectTo({ url: "/pages/profile/profile" });
}

function goToStep(target: number) {
  if (submitting.value || target === step.value) return;
  error.value = "";
  step.value = target;
}

function skip() {
  const driver = readDriver();
  if (submitting.value || section.value || !driver) return;
  skipCertification(driver.id);
  uni.reLaunch({ url: "/pages/home/home" });
}

onLoad((query) => {
  const value = query?.section;
  if (value === "personal" || value === "vehicle" || value === "documents") {
    section.value = value;
    step.value = value === "personal" ? 0 : value === "vehicle" ? 1 : 2;
  }
});

onShow(async () => {
  const driver = requireDriver();
  if (!driver) return;
  if (!section.value && driver.profileComplete) {
    uni.reLaunch({ url: "/pages/home/home" });
    return;
  }
  if (profileLoaded.value) return;
  profileLoaded.value = true;
  try {
    const current = await driverApi.getProfile(driver.id);
    if (!name.value) name.value = current.name ?? "";
    if (!vehicleModel.value) vehicleModel.value = current.vehicleModel ?? "";
    if (!plate.value) plate.value = current.plate ?? "";
    idOnFile.value = current.idOnFile;
    existingPhotoUrl.value = current.photoUrl ? apiAsset(current.photoUrl) : "";
  } catch {
    profileLoaded.value = false;
  }
});

onReady(() => {
  if (reduceMotion) return;
  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from(".cert-page", { backgroundColor: "rgba(26, 26, 26, 0)", duration: 0.3 })
    .from(".cert-card", { y: 28, scale: 0.94, autoAlpha: 0, duration: 0.5 }, "<0.05")
    .from(".cert-logo, .cert-title, .cert-body, .cert-footer", { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.06 }, "-=0.25");
});

watch(step, async (to, from) => {
  if (reduceMotion) return;
  await nextTick();
  const offset = to > from ? 28 : -28;
  gsap.fromTo(".cert-title, .cert-body", { x: offset, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.36, stagger: 0.04, ease: "power2.out" });
});

async function choose(target: "photo" | "driverLicense" | "vehicleLicense") {
  error.value = "";
  try {
    const dataUrl = await pickImage();
    if (!dataUrl) return;
    if (target === "photo") photo.value = dataUrl;
    if (target === "driverLicense") driverLicense.value = dataUrl;
    if (target === "vehicleLicense") vehicleLicense.value = dataUrl;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "选择图片失败";
  }
}

async function submit() {
  const driver = requireDriver();
  if (!driver || step.value !== 2 || !documentsReady.value || submitting.value) return;
  if (!personalReady.value || !vehicleReady.value) {
    const missing = personalReady.value ? 1 : 0;
    step.value = missing;
    error.value = `请先补全${steps[missing]}`;
    return;
  }
  error.value = "";
  submitting.value = true;
  try {
    const session = await driverApi.completeProfile(driver.id, {
      name: name.value.trim(),
      idNumber: idNumber.value.trim().toUpperCase(),
      vehicleModel: vehicleModel.value.trim(),
      plate: plate.value.trim(),
      photo: photo.value,
      driverLicense: driverLicense.value,
      vehicleLicense: vehicleLicense.value,
    });
    remember(session);
    uni.reLaunch({ url: "/pages/home/home" });
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "提交失败";
    submitting.value = false;
  }
}

function pickImage(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: async (result) => {
        try {
          const file = firstTempFile(result.tempFiles);
          const blob = file instanceof Blob ? file : file?.file;
          if (!(blob instanceof Blob)) {
            reject(new Error("读取图片失败"));
            return;
          }
          resolve(await fileToDataUrl(blob));
        } catch (cause) {
          reject(cause);
        }
      },
      fail: (failure) => {
        const message = typeof failure?.errMsg === "string" ? failure.errMsg : "";
        if (message.includes("cancel")) resolve(null);
        else reject(new Error("选择图片失败"));
      },
    });
  });
}

function firstTempFile(files: unknown): { file?: Blob } | File | undefined {
  const file = Array.isArray(files) ? files[0] : files;
  if (!file || typeof file !== "object") return undefined;
  return file as { file?: Blob } | File;
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("图片不能超过 5MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(dataUrl)) {
        reject(new Error("请上传 jpg、png 或 webp 图片"));
        return;
      }
      resolve(dataUrl);
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}
</script>

<template>
  <view class="driver-page cert-page">
    <view class="cert-card" role="dialog" aria-modal="true" aria-labelledby="cert-title">
      <view class="cert-logo"><text class="logo-cn">万顺</text><text class="logo-en">OneSoon</text></view>
      <text id="cert-title" class="cert-title">{{ steps[step] }}</text>

      <view class="cert-body">
        <view v-if="step === 0">
          <view class="photo-slot" role="button" tabindex="0" :aria-label="photo ? '重新上传个人照片' : '上传个人照片'" @tap="choose('photo')">
            <image v-if="photoPreview" class="slot-image" :src="photoPreview" mode="aspectFill" alt="个人照片预览" />
            <text v-else class="slot-empty">上传照片</text>
          </view>
          <view class="field-row">
            <text class="field-label" id="driver-name-label">姓名</text>
            <input v-model="name" class="driver-input" maxlength="40" placeholder="请输入姓名" aria-labelledby="driver-name-label" :disabled="submitting" />
          </view>
          <view class="field-row">
            <text class="field-label" id="driver-id-label">身份证号</text>
            <input v-model="idNumber" class="driver-input" maxlength="18" :placeholder="idOnFile ? '已登记，如需修改请重新填写' : '18 位身份证号'" aria-labelledby="driver-id-label" :disabled="submitting" />
          </view>
          <text v-if="idNumber.trim() && !idReady" class="cert-error">身份证号不正确</text>
        </view>

        <view v-else-if="step === 1">
          <view class="field-row">
            <text class="field-label" id="driver-model-label">车型</text>
            <view class="type-select">
              <button
                class="type-trigger"
                :class="{ 'type-trigger--empty': !vehicleModel, 'type-trigger--open': typeOpen }"
                :aria-expanded="typeOpen"
                aria-haspopup="listbox"
                aria-labelledby="driver-model-label"
                :disabled="submitting"
                @tap="typeOpen = !typeOpen"
              >
                <text>{{ vehicleModel || "请选择类型" }}</text>
                <text class="type-chevron" aria-hidden="true" />
              </button>
              <view v-if="typeOpen" class="type-menu" role="listbox" aria-labelledby="driver-model-label">
                <button
                  v-for="type in vehicleTypes"
                  :key="type"
                  class="type-option"
                  role="option"
                  :aria-selected="vehicleModel === type"
                  @tap="chooseType(type)"
                >
                  {{ type }}
                </button>
              </view>
            </view>
          </view>
          <view class="field-row">
            <text class="field-label" id="driver-plate-label">车牌</text>
            <input v-model="plate" class="driver-input" maxlength="12" placeholder="例如 渝F12345" aria-labelledby="driver-plate-label" :disabled="submitting" />
          </view>
        </view>

        <view v-else class="license-row">
          <view class="license-slot" role="button" tabindex="0" :aria-label="driverLicense ? '重新上传驾驶证' : '上传驾驶证'" @tap="choose('driverLicense')">
            <image v-if="driverLicense" class="slot-image" :src="driverLicense" mode="aspectFill" alt="驾驶证预览" />
            <text v-else class="slot-empty">上传驾驶证</text>
          </view>
          <view class="license-slot" role="button" tabindex="0" :aria-label="vehicleLicense ? '重新上传行驶证' : '上传行驶证'" @tap="choose('vehicleLicense')">
            <image v-if="vehicleLicense" class="slot-image" :src="vehicleLicense" mode="aspectFill" alt="行驶证预览" />
            <text v-else class="slot-empty">上传行驶证</text>
          </view>
        </view>

        <text v-if="error" class="cert-error" role="alert">{{ error }}</text>
      </view>

      <view class="cert-footer">
        <view v-if="!section" class="cert-dots">
          <view
            v-for="(label, index) in steps"
            :key="label"
            class="cert-dot"
            :class="{ 'cert-dot--active': index === step }"
            role="button"
            tabindex="0"
            :aria-label="`第 ${index + 1} 步：${label}`"
            :aria-current="index === step ? 'step' : undefined"
            @tap="goToStep(index)"
          />
        </view>
        <view class="cert-actions">
          <button v-if="section" class="cert-skip" :disabled="submitting" @tap="backToProfile">返回</button>
          <button v-else class="cert-skip" :disabled="submitting" @tap="skip">跳过</button>
          <button v-if="section" class="cert-next" :disabled="!stepReady || submitting" @tap="saveAndReturn">
            {{ submitting ? "正在保存…" : "保存" }}
          </button>
          <button v-else-if="step < 2" class="cert-next" :disabled="!stepReady || submitting" @tap="nextStep">下一步</button>
          <button v-else class="cert-next" :disabled="!documentsReady || submitting" @tap="submit">
            {{ submitting ? "正在提交…" : "提交资料" }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";

.cert-page {
  display: flex;
  align-items: center;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  background: #1a1a1a66;
}

.cert-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 312px;
  padding: 18px 20px 16px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(26, 26, 26, 0.18);
  box-sizing: border-box;
}

.cert-logo {
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: #d0121a;
}

.logo-cn {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.logo-en {
  font-size: 11px;
  font-weight: 650;
}

.cert-title {
  display: block;
  margin-top: 10px;
  color: #20212a;
  font-size: 17px;
  font-weight: 750;
  line-height: 1.3;
}

.cert-body {
  margin-top: 12px;
}

.photo-slot,
.license-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px dashed #d9dce2;
  border-radius: 12px;
  background: #f7f7f9;
  cursor: pointer;
  box-sizing: border-box;
}

.photo-slot {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
}

.license-row {
  display: flex;
  gap: 10px;
}

.license-slot {
  flex: 1;
  height: 116px;
}

.photo-slot:focus-visible,
.license-slot:focus-visible,
.cert-dot:focus-visible {
  outline: 2px solid #f0c5c8;
  outline-offset: 2px;
}

.slot-image {
  width: 100%;
  height: 100%;
}

.slot-empty {
  color: #5c6370;
  font-size: 12px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-row + .field-row {
  margin-top: 8px;
}

.field-label {
  flex: 0 0 60px;
  color: #252630;
  font-size: 13px;
  font-weight: 650;
}

.cert-page .driver-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  font-size: 16px;
  box-sizing: border-box;
}

.cert-page .driver-input:focus {
  border-color: #d0121a;
  outline: 2px solid #f0c5c8;
  outline-offset: 1px;
}

.type-select {
  position: relative;
  flex: 1;
  min-width: 0;
}

.type-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px solid #d9dce2;
  border-radius: 11px;
  background: #fff;
  color: #20212a;
  font-size: 16px;
  line-height: 40px;
  text-align: left;
}

.type-trigger::after,
.type-option::after {
  border: 0;
}

.type-trigger--empty {
  color: #a3a8b2;
}

.type-trigger--open,
.type-trigger:focus-visible {
  border-color: #d0121a;
  outline: 2px solid #f0c5c8;
  outline-offset: 1px;
}

.type-trigger[disabled] {
  opacity: 0.6;
}

.type-chevron {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid #5c6370;
  border-bottom: 1.5px solid #5c6370;
  transform: translateY(-2px) rotate(45deg);
}

.type-trigger--open .type-chevron {
  transform: translateY(2px) rotate(225deg);
}

.type-menu {
  position: absolute;
  z-index: 2;
  top: 44px;
  right: 0;
  left: 0;
  padding: 4px;
  border: 1px solid #ece7e7;
  border-radius: 11px;
  background: #fff;
  box-shadow: 0 8px 20px rgba(26, 26, 26, 0.12);
}

.type-option {
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  margin: 0;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #20212a;
  font-size: 15px;
  text-align: left;
}

.type-option[aria-selected="true"] {
  background: #fff6f6;
  color: #d0121a;
  font-weight: 700;
}

.cert-error {
  display: block;
  margin-top: 6px;
  padding-left: 70px;
  color: #d0121a;
  font-size: 12px;
  line-height: 1.4;
}

.license-row + .cert-error {
  padding-left: 0;
}

.cert-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 16px;
}

.cert-dots {
  display: flex;
  align-items: center;
  gap: 5px;
}

.cert-dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: #d9dce2;
  cursor: pointer;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.cert-dot--active {
  width: 18px;
  background: #d0121a;
}

.cert-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
}

.cert-skip {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #5c6370;
  font-size: 13px;
  line-height: 1.4;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cert-next {
  margin: 0;
  padding: 0 18px;
  height: 32px;
  border: 0;
  border-radius: 16px;
  background: #d0121a;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 32px;
}

.cert-skip::after,
.cert-next::after {
  border: 0;
}

.cert-next[disabled] {
  background: #e7e8eb;
  color: #5c6370;
}

@media (prefers-reduced-motion: reduce) {
  .cert-dot {
    transition: none;
  }
}
</style>

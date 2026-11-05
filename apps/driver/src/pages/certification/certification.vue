<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { driverApi } from "@/driver-api";
import { requireDriver, saveDriver } from "@/driver-session";

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

const idReady = computed(() => /^[0-9]{17}[0-9Xx]$/.test(idNumber.value.trim()));
const personalReady = computed(() => name.value.trim() !== "" && idReady.value && photo.value !== "");
const vehicleReady = computed(() => vehicleModel.value.trim() !== "" && plate.value.trim() !== "");
const documentsReady = computed(() => driverLicense.value !== "" && vehicleLicense.value !== "");
const stepReady = computed(() => [personalReady.value, vehicleReady.value, documentsReady.value][step.value]);

function nextStep() {
  if (!stepReady.value || submitting.value || step.value >= 2) return;
  error.value = "";
  step.value += 1;
}

function previousStep() {
  if (step.value === 0 || submitting.value) return;
  error.value = "";
  step.value -= 1;
}

onShow(() => {
  const driver = requireDriver();
  if (driver?.profileComplete) uni.reLaunch({ url: "/pages/home/home" });
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
    saveDriver(session);
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
      <text class="cert-progress">{{ step + 1 }}/3</text>
      <text id="cert-title" class="driver-title">{{ ["个人资料", "车辆", "证件"][step] }}</text>

      <view v-if="step === 0">
        <view class="upload-row">
          <view class="preview">
            <image v-if="photo" class="preview-image" :src="photo" mode="aspectFill" alt="个人照片预览" />
            <text v-else class="preview-empty">照片</text>
          </view>
          <button class="driver-secondary upload-button" @tap="choose('photo')">
            {{ photo ? "重新上传个人照片" : "上传个人照片" }}
          </button>
        </view>
        <text class="driver-form-label" id="driver-name-label">姓名</text>
        <input v-model="name" class="driver-input" maxlength="40" placeholder="请输入姓名" aria-labelledby="driver-name-label" :disabled="submitting" />
        <text class="driver-form-label" id="driver-id-label">身份证号</text>
        <input v-model="idNumber" class="driver-input" maxlength="18" placeholder="请输入 18 位身份证号" aria-labelledby="driver-id-label" :disabled="submitting" />
        <text v-if="idNumber.trim() && !idReady" class="cert-error">身份证号不正确</text>
      </view>

      <view v-else-if="step === 1">
        <text class="driver-form-label" id="driver-model-label">车型</text>
        <input v-model="vehicleModel" class="driver-input" maxlength="40" placeholder="例如 丰田卡罗拉" aria-labelledby="driver-model-label" :disabled="submitting" />
        <text class="driver-form-label" id="driver-plate-label">车牌</text>
        <input v-model="plate" class="driver-input" maxlength="12" placeholder="例如 渝F12345" aria-labelledby="driver-plate-label" :disabled="submitting" />
      </view>

      <view v-else>
        <view class="upload-row">
          <view class="preview">
            <image v-if="driverLicense" class="preview-image" :src="driverLicense" mode="aspectFill" alt="驾驶证预览" />
            <text v-else class="preview-empty">驾驶证</text>
          </view>
          <button class="driver-secondary upload-button" @tap="choose('driverLicense')">
            {{ driverLicense ? "重新上传驾驶证" : "上传驾驶证" }}
          </button>
        </view>
        <view class="upload-row">
          <view class="preview">
            <image v-if="vehicleLicense" class="preview-image" :src="vehicleLicense" mode="aspectFill" alt="行驶证预览" />
            <text v-else class="preview-empty">行驶证</text>
          </view>
          <button class="driver-secondary upload-button" @tap="choose('vehicleLicense')">
            {{ vehicleLicense ? "重新上传行驶证" : "上传行驶证" }}
          </button>
        </view>
      </view>

      <text v-if="error" class="cert-error" role="alert">{{ error }}</text>
      <view class="cert-actions">
        <button v-if="step > 0" class="driver-secondary cert-action" :disabled="submitting" @tap="previousStep">上一步</button>
        <button v-if="step < 2" class="driver-primary cert-action" :disabled="!stepReady" @tap="nextStep">下一步</button>
        <button v-else class="driver-primary cert-action" :disabled="!documentsReady || submitting" @tap="submit">
          {{ submitting ? "正在提交…" : "提交资料" }}
        </button>
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
  width: 100%;
  padding: 20px 16px 16px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(26, 26, 26, 0.18);
}

.cert-progress {
  display: block;
  color: #3c4149;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
}

.driver-title {
  margin-top: 4px;
}

.cert-page .driver-form-label {
  margin-top: 16px;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 650;
}

.cert-page .driver-input {
  box-sizing: border-box;
  font-size: 16px;
}

.cert-page .driver-input:focus {
  border-color: #d0121a;
  outline: 2px solid #f0c5c8;
  outline-offset: 1px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.preview {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border: 1px solid #ece7e7;
  border-radius: 12px;
  background: #f2f3f5;
}

.preview-image {
  width: 72px;
  height: 72px;
}

.preview-empty {
  color: #3c4149;
  font-size: 16px;
}

.upload-button {
  flex: 1;
  min-height: 48px;
}

.cert-error {
  display: block;
  margin-top: 16px;
  color: #d0121a;
  font-size: 16px;
  line-height: 1.5;
}

.cert-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.cert-action {
  flex: 1;
  width: auto;
  min-height: 48px;
}

.cert-action[disabled] {
  background: #e7e8eb;
  color: #5c6370;
}
</style>

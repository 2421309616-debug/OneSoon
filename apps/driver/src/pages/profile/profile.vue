<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import DriverPageHeader from "@/components/DriverPageHeader.vue";
import { apiAsset, driverApi, type DriverProfile } from "@/driver-api";
import { requireDriver } from "@/driver-session";

const profile = ref<DriverProfile | null>(null);
const error = ref("");
const entries = computed(() => [
  { section: "personal", label: "个人资料", done: profile.value?.personalComplete === true },
  { section: "vehicle", label: "车辆", done: profile.value?.vehicleComplete === true },
  { section: "documents", label: "证件", done: profile.value?.documentsComplete === true },
]);

function openSection(section: string) {
  uni.navigateTo({ url: `/pages/certification/certification?section=${section}` });
}

onShow(async () => {
  const driver = requireDriver();
  if (!driver) return;
  error.value = "";
  try {
    profile.value = await driverApi.getProfile(driver.id);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "读取资料失败";
  }
});
</script>

<template>
  <view class="driver-page driver-page--scroll profile-page">
    <DriverPageHeader title="个人中心" back-to="/pages/home/home" />
    <view class="driver-page-body">
      <text v-if="error" class="profile-error" role="alert">{{ error }}</text>
      <template v-else-if="profile">
        <view class="profile-identity">
          <view class="avatar">
            <image v-if="profile.photoUrl" class="avatar-image" :src="apiAsset(profile.photoUrl)" mode="aspectFill" alt="个人照片" />
            <image v-else class="avatar-placeholder" src="/static/icons/person.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <text class="profile-name">{{ profile.name ?? "未填写姓名" }}</text>
          <text class="profile-phone">{{ profile.phone }}</text>
          <text class="profile-model">{{ profile.vehicleModel ?? "未填写车型" }}</text>
          <view v-if="profile.vehicleImageUrl" class="profile-car-wrap">
            <image class="profile-car" :src="apiAsset(profile.vehicleImageUrl)" mode="aspectFit" alt="车辆示意图" />
          </view>
          <text class="profile-plate" :class="{ 'profile-plate--empty': !profile.plate }">{{ profile.plate ?? "未填写车牌" }}</text>
        </view>
        <view class="profile-entries">
          <button v-for="entry in entries" :key="entry.section" class="profile-entry" @tap="openSection(entry.section)">
            <text class="profile-entry-label">{{ entry.label }}</text>
            <view class="profile-entry-aside">
              <text class="profile-entry-state" :class="{ 'profile-entry-state--done': entry.done }">{{ entry.done ? "已完善" : "去补充" }}</text>
              <view class="profile-entry-chevron" aria-hidden="true" />
            </view>
          </button>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";

.profile-page .driver-page-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  min-height: 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  overflow: auto;
}

.profile-identity,
.profile-entries {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #eceef1;
  border-radius: 16px;
  background: #ffffff;
}

.profile-identity {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px 16px 18px;
}

.profile-entries {
  flex: none;
  overflow: hidden;
}

.profile-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 52px;
  margin: 0;
  padding: 0 16px;
  border: 0;
  background: transparent;
  text-align: left;
}

.profile-entry:not(:last-child) {
  border-bottom: 1px solid #eceef1;
}

.profile-entry::after {
  border: 0;
}

.profile-entry:active {
  background: #f6f7f8;
}

.profile-entry:focus-visible {
  outline: 2px solid #20212a;
  outline-offset: -2px;
}

.profile-entry-label {
  color: #20212a;
  font-size: 16px;
  font-weight: 650;
}

.profile-entry-aside {
  display: flex;
  align-items: center;
  gap: 8px;
}

.profile-entry-state {
  color: #d0121a;
  font-size: 15px;
  font-weight: 650;
}

.profile-entry-state--done {
  color: #5c6370;
  font-weight: 600;
}

.profile-entry-chevron {
  width: 7px;
  height: 7px;
  border-top: 1.5px solid #b0b6bf;
  border-right: 1.5px solid #b0b6bf;
  transform: rotate(45deg);
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  overflow: hidden;
  border: 1px solid #e6e8ec;
  border-radius: 50%;
  background: #c9ccd3;
}

.avatar-image {
  width: 88px;
  height: 88px;
}

.avatar-placeholder {
  width: 52px;
  height: 52px;
}

.profile-name,
.profile-phone,
.profile-model,
.profile-plate {
  margin: 0;
}

.profile-name {
  color: #20212a;
  font-size: 22px;
  font-weight: 750;
  line-height: 1.3;
}

.profile-phone,
.profile-model {
  color: #5c6370;
  font-size: 15px;
  line-height: 1.4;
}

.profile-car-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 112px;
}

.profile-car {
  width: 100%;
  height: 112px;
}

.profile-plate {
  padding: 8px 16px;
  border: 1px solid #d9dce2;
  border-radius: 10px;
  color: #20212a;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
}

.profile-plate--empty {
  border-style: dashed;
  color: #5c6370;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

.profile-error {
  margin: 0;
  color: #c5222d;
  font-size: 13px;
}
</style>

<script setup lang="ts">
import DriverPageHeader from "@/components/DriverPageHeader.vue";

const sections = [
  {
    title: "出车前准备",
    items: [
      "检查车辆状况、燃油或电量，确认车辆适合安全行驶。",
      "确认驾驶证、行驶证等证件齐全有效，手机电量和网络正常。",
      "熟悉车辆周边路况，出车前设置好导航。",
    ],
  },
  {
    title: "接单与接驾",
    items: [
      "接单后先核对乘客、上车点和目的地信息。",
      "按平台导航前往上车点；如暂时联系不上乘客，请使用订单内的联系功能。",
      "到达上车点后，在安全位置停车并在页面确认到达。",
    ],
  },
  {
    title: "行程中",
    items: [
      "遵守交通法规，按导航和道路情况安全驾驶。",
      "车辆行驶时不要操作手机；需要查看信息时，请先在安全地点停车。",
      "上车后与乘客确认目的地，有路线变化时及时沟通。",
    ],
  },
  {
    title: "结束行程与突发情况",
    items: [
      "到达目的地后，在页面结束行程并核对订单信息。",
      "遇到车辆故障或突发情况，先确保人身安全并停靠在安全位置。",
      "需要平台协助时使用安全求助；遇到紧急危险时及时联系当地紧急救援。",
    ],
  },
];
</script>

<template>
  <view class="driver-page driver-page--scroll manual-page">
    <DriverPageHeader title="司机手册" back-to="/pages/home/home" />
    <scroll-view class="manual-scroll" scroll-y>
      <view class="driver-page-body">
        <view class="manual-intro">
          <text class="driver-eyebrow">安全出行</text>
          <text class="driver-title">每一程，都平安抵达</text>
          <text class="driver-muted">出车前、接单中和行程结束后，请留意以下事项。</text>
        </view>
        <view v-for="(section, sectionIndex) in sections" :key="section.title" class="driver-card manual-card">
          <view class="manual-heading"><text class="manual-index">0{{ sectionIndex + 1 }}</text><text class="driver-section-title">{{ section.title }}</text></view>
          <view v-for="(item, itemIndex) in section.items" :key="item" class="manual-item">
            <text class="manual-bullet">{{ itemIndex + 1 }}</text>
            <text class="manual-copy">{{ item }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
@import "@/styles/driver-pages.css";
.manual-scroll { flex: 1; min-height: 0; }
.manual-intro { margin-bottom: 12px; }
.manual-card { padding: 15px; }
.manual-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 10px; }
.manual-index { display: grid; place-items: center; flex: none; width: 25px; height: 25px; border-radius: 8px; background: #fcebed; color: #bd202b; font-size: 11px; font-weight: 750; }
.manual-item { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-top: 1px solid #f0f1f3; }
.manual-bullet { display: grid; place-items: center; flex: none; width: 18px; height: 18px; border-radius: 50%; background: #f2f3f5; color: #737987; font-size: 10px; font-weight: 650; }
.manual-copy { flex: 1; color: #4c515c; font-size: 12px; line-height: 1.55; }
</style>

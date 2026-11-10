<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BottomNav from "@/components/BottomNav.vue";
import { cancelOrder, listPassengerOrders, listUpcomingOrders, type TripOrder } from "@/passenger-api";
import { requirePassenger } from "@/passenger-session";

const props = defineProps<{ upcoming?: boolean }>();
const orders = ref<TripOrder[]>([]);
const loading = ref(false);
const error = ref("");
const cancellingId = ref("");
const activeFilter = ref<"all" | "personal" | "appointment" | "someone">("all");
const filters = [
  { id: "all", label: "全部" },
  { id: "personal", label: "个人" },
  { id: "appointment", label: "预约" },
  { id: "someone", label: "帮人叫车" },
] as const;
const filteredOrders = computed(() => orders.value.filter((order) => {
  if (props.upcoming || activeFilter.value === "all") return true;
  if (activeFilter.value === "appointment") return !!order.scheduledAt;
  // API returns the actual rider as passengerName for display, so riderName is the reliable indicator.
  const isSomeone = !!order.riderName;
  if (activeFilter.value === "someone") return isSomeone;
  return !order.scheduledAt && !isSomeone;
}));
const filterEmptyTitle = computed(() => `暂无${filters.find((filter) => filter.id === activeFilter.value)?.label ?? ""}订单`);

onMounted(() => { void refresh(); });

async function refresh() {
  const passenger = requirePassenger();
  if (!passenger) return;
  loading.value = true;
  error.value = "";
  try {
    const result = props.upcoming
      ? await listUpcomingOrders(passenger.id)
      : await listPassengerOrders(passenger.id);
    orders.value = result.orders;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "订单加载失败，请稍后重试";
  } finally {
    loading.value = false;
  }
}

function statusText(order: TripOrder) {
  if (order.status === "cancelled") return "已取消";
  if (order.status === "accepted") return "司机已接单";
  if (order.scheduledAt && Date.parse(order.scheduledAt) > Date.now()) return "预约待出发";
  return "等待接单";
}

function dateText(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function fareText(order: TripOrder) {
  return (order.fareCents / 100).toFixed(2);
}

function goBack() {
  uni.reLaunch({ url: "/pages/profile/profile" });
}

function goHome() {
  uni.reLaunch({ url: "/pages/home/home" });
}

function openDetails(order: TripOrder) {
  const lines = [
    `订单编号：${order.id}`,
    `上车点：${order.pickup.name}`,
    `目的地：${order.destination.name}`,
    `乘车人：${order.riderName || order.passengerName}`,
    order.scheduledAt ? `预约时间：${dateText(order.scheduledAt)}` : "即时用车",
    `预估费用：¥${fareText(order)}`,
  ];
  uni.showModal({ title: "订单详情", content: lines.join("\n"), showCancel: false, confirmText: "知道了" });
}

function askCancel(order: TripOrder) {
  const passenger = requirePassenger();
  if (!passenger || cancellingId.value) return;
  uni.showModal({
    title: "取消订单",
    content: "确定取消这笔行程吗？",
    cancelText: "再想想",
    confirmText: "确认取消",
    confirmColor: "#d0121a",
    success: async ({ confirm }) => {
      if (!confirm) return;
      cancellingId.value = order.id;
      try {
        await cancelOrder(passenger.id, order.id);
        uni.showToast({ title: "订单已取消", icon: "success" });
        await refresh();
      } catch (cause) {
        uni.showToast({ title: cause instanceof Error ? cause.message : "取消失败", icon: "none" });
      } finally {
        cancellingId.value = "";
      }
    },
  });
}
</script>

<template>
  <view class="app-page screen">
    <view class="topbar">
      <button class="back" aria-label="返回" @tap="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
      </button>
      <text class="topbar-title">{{ upcoming ? "待出发" : "全部订单" }}</text>
    </view>

    <scroll-view class="content app-content--with-nav" scroll-y refresher-enabled @refresherrefresh="refresh">
      <view v-if="!upcoming" class="filter-tabs" role="tablist" aria-label="订单分类">
        <view
          v-for="filter in filters"
          :key="filter.id"
          class="filter-tab"
          :class="{ 'filter-tab--active': activeFilter === filter.id }"
          role="tab"
          :aria-selected="activeFilter === filter.id"
          @tap="activeFilter = filter.id"
        >{{ filter.label }}</view>
      </view>
      <view class="intro">
        <text class="heading">{{ upcoming ? "预约行程" : "出行记录" }}</text>
        <text class="subheading">{{ upcoming ? "这里展示已预约且尚未出发的订单。" : "查看您的叫车订单及行程状态。" }}</text>
      </view>

      <view v-if="error" class="state-card">
        <text>{{ error }}</text>
        <button class="retry" @tap="refresh">重新加载</button>
      </view>
      <view v-else-if="loading && !orders.length" class="state-card">正在加载订单…</view>
      <view v-else-if="!orders.length" class="state-card empty">
        <image class="empty-icon" src="/static/icons/entry-orders.svg" mode="aspectFit" aria-hidden="true" />
        <text class="empty-title">{{ upcoming ? "还没有待出发的预约" : "还没有出行订单" }}</text>
        <text class="empty-copy">{{ upcoming ? "预约用车后，订单会显示在这里。" : "完成一次叫车后，订单会显示在这里。" }}</text>
        <button class="primary" @tap="goHome">去叫车</button>
      </view>
      <view v-else-if="!filteredOrders.length" class="state-card empty-filter">
        <text class="empty-title">{{ filterEmptyTitle }}</text>
        <text class="empty-copy">这个分类下还没有订单。</text>
      </view>
      <view v-else class="order-list">
        <view v-for="order in filteredOrders" :key="order.id" class="order-card">
          <view class="order-head">
            <view class="status-mark" :class="{ 'status-mark--muted': order.status === 'cancelled' }"></view>
            <text class="status-text">{{ statusText(order) }}</text>
            <text class="date">{{ dateText(order.createdAt) }}</text>
          </view>
          <view class="route" role="button" @tap="openDetails(order)">
            <view class="route-line"><text class="route-dot route-dot--start"></text><text class="route-label">上车点</text><text class="route-name">{{ order.pickup.name }}</text></view>
            <view class="route-line"><text class="route-dot route-dot--end"></text><text class="route-label">目的地</text><text class="route-name">{{ order.destination.name }}</text></view>
          </view>
          <view v-if="order.scheduledAt || order.riderName" class="meta-row">
            <text v-if="order.scheduledAt">预约 {{ dateText(order.scheduledAt) }}</text>
            <text v-if="order.riderName">乘车人 {{ order.riderName }}</text>
          </view>
          <view v-if="order.preferences && (order.preferences.quietRide || order.preferences.smokeFree || order.preferences.trunkNeeded || order.preferences.note)" class="preference-tags">
            <text v-if="order.preferences.quietRide">安静出行</text>
            <text v-if="order.preferences.smokeFree">无烟车辆</text>
            <text v-if="order.preferences.trunkNeeded">需要后备箱</text>
            <text v-if="order.preferences.note">备注：{{ order.preferences.note }}</text>
          </view>
          <view class="order-foot">
            <text class="fare">¥{{ fareText(order) }}</text>
            <view class="buttons">
              <button class="detail-button" @tap="openDetails(order)">订单详情</button>
              <button v-if="order.status === 'waiting' || order.status === 'accepted'" class="cancel-button" :disabled="cancellingId === order.id" @tap="askCancel(order)">
                {{ cancellingId === order.id ? "取消中" : "取消订单" }}
              </button>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
    <BottomNav current="profile" />
  </view>
</template>

<style scoped>
.screen { min-height: var(--app-viewport-height); background: #f2f3f5; }
.topbar { position: relative; display: flex; align-items: center; height: 52px; padding: 0 16px; background: #fff; }
.back { position: absolute; left: 8px; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin: 0; padding: 0; border: 0; background: transparent; color: #252630; }
.back::after { border: 0; }
.back svg { width: 22px; height: 22px; }
.topbar-title { width: 100%; color: #252630; font-size: 17px; font-weight: 700; text-align: center; }
.content { height: calc(var(--app-viewport-height) - 52px); padding: 18px 14px calc(var(--app-nav-height) + 18px); box-sizing: border-box; }
.content { scrollbar-width: none; -ms-overflow-style: none; }
.content::-webkit-scrollbar, :deep(.uni-scroll-view::-webkit-scrollbar) { display: none; width: 0; height: 0; }
.filter-tabs { display: flex; gap: 4px; margin: 0 0 14px; padding: 4px; border-radius: 12px; background: #fff; }
.filter-tab { display: flex; flex: 1; align-items: center; justify-content: center; min-width: 0; height: 34px; border-radius: 9px; color: #687385; font-size: 12px; white-space: nowrap; }
.filter-tab--active { background: #d0121a; color: #fff; font-weight: 700; }
.intro { margin: 4px 2px 16px; }
.heading { display: block; color: #252630; font-size: 22px; font-weight: 750; }
.subheading { display: block; margin-top: 4px; color: #737b89; font-size: 13px; }
.order-list { display: flex; flex-direction: column; gap: 10px; }
.order-card, .state-card { padding: 15px; border-radius: 14px; background: #fff; box-shadow: 0 4px 16px rgba(30, 35, 45, .04); }
.order-head { display: flex; align-items: center; gap: 7px; }
.status-mark { width: 8px; height: 8px; border-radius: 50%; background: #d0121a; }
.status-mark--muted { background: #a2a8b2; }
.status-text { color: #252630; font-size: 14px; font-weight: 700; }
.date { margin-left: auto; color: #8a9099; font-size: 11px; }
.route { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; padding: 12px; border-radius: 10px; background: #f5f6f8; }
.route-line { display: grid; grid-template-columns: 8px 48px minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; }
.route-dot { width: 7px; height: 7px; border-radius: 50%; }
.route-dot--start { background: #d0121a; }
.route-dot--end { background: #2db878; }
.route-label { color: #8a9099; font-size: 11px; }
.route-name { overflow: hidden; color: #252630; font-size: 13px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.meta-row { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; color: #737b89; font-size: 12px; }
.preference-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; color: #737b89; font-size: 11px; }
.order-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.fare { color: #d0121a; font-size: 17px; font-weight: 750; }
.buttons { display: flex; gap: 8px; }
.detail-button, .cancel-button, .retry { height: 34px; margin: 0; padding: 0 12px; border: 1px solid #e0e2e7; border-radius: 17px; background: #fff; color: #555d69; font-size: 12px; line-height: 32px; }
.cancel-button { border-color: #f0c5c8; color: #c5222d; }
.detail-button::after, .cancel-button::after, .retry::after, .primary::after { border: 0; }
.state-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 28px 18px; color: #737b89; font-size: 13px; text-align: center; }
.empty-filter { padding: 24px 18px; }
.empty-icon { width: 42px; height: 42px; opacity: .65; }
.empty-title { color: #252630; font-size: 16px; font-weight: 700; }
.empty-copy { font-size: 12px; }
.primary { width: 100%; height: 44px; margin-top: 12px; border: 0; border-radius: 22px; background: #d0121a; color: #fff; font-size: 14px; font-weight: 700; line-height: 44px; }
</style>

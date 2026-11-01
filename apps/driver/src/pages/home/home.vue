<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed } from "vue";
import BottomNav from "../../components/BottomNav.vue";
import ListeningPanel from "../../components/ListeningPanel.vue";
import OfflinePanel from "../../components/OfflinePanel.vue";
import OrderOffer from "../../components/OrderOffer.vue";
import {
  acceptOffer,
  bindDriver,
  cancelOffer,
  driverState,
  goOffline,
  goOnline,
  MAX_ACTIVE_ORDERS,
  openOrder,
  todayIncomeText,
  todayOnlineText,
} from "../../driver-state";
import { MOCK_NOTICES, type TripOrder } from "../../mock-orders";
import { requireDriver } from "../../driver-session";

const income = computed(() => todayIncomeText());
const onlineText = computed(() => todayOnlineText());
const offerOrder = computed(() => driverState.order);

async function handleOnline() {
  const ok = await goOnline();
  if (!ok) {
    uni.showToast({ title: driverState.lastError || "出车失败", icon: "none" });
  }
}

async function handleOffline() {
  const ok = await goOffline();
  if (!ok) {
    uni.showToast({ title: driverState.lastError || "请先完成手上订单", icon: "none" });
  }
}

function handleOpen(order: TripOrder) {
  if (!openOrder(order)) {
    uni.showToast({ title: `最多同时持有 ${MAX_ACTIVE_ORDERS} 单`, icon: "none" });
  }
}

async function handleAccept() {
  // 接单后留在听单页，这一单出现在上方「进行中」区
  const active = await acceptOffer();
  if (!active) {
    uni.showToast({ title: driverState.lastError || "接单失败", icon: "none" });
  }
}

function handleReject() {
  cancelOffer();
}

function openTrip(orderId: string) {
  const url = `/pages/trip/trip?id=${orderId}`;
  uni.navigateTo({
    url,
    fail: () => {
      uni.redirectTo({ url });
    },
  });
}

onShow(() => {
  const session = requireDriver();
  if (session) {
    void bindDriver(session);
  }
});
</script>

<template>
  <view class="screen">
    <OfflinePanel
      v-if="driverState.phase === 'offline'"
      :income="income"
      :online-text="onlineText"
      :order-count="driverState.stats.orders"
      :notices="MOCK_NOTICES"
      @online="handleOnline"
    />

    <ListeningPanel
      v-else
      :income="income"
      :online-text="onlineText"
      :order-count="driverState.stats.orders"
      :orders="driverState.orders"
      :pool="driverState.pool"
      @offline="handleOffline"
      @open="handleOpen"
      @resume="openTrip"
    />

    <OrderOffer
      v-if="driverState.phase === 'offering' && offerOrder"
      :order="offerOrder"
      :seconds="driverState.offerSeconds"
      :total="60"
      @accept="handleAccept"
      @reject="handleReject"
    />

    <BottomNav current="home" />
  </view>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #2a2a34;
}
</style>

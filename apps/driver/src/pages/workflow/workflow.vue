<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { driverApi, type DriverNavigationRoute, type NavigationTarget, type OrderOffer, type PassengerContact } from "@/driver-api";

type DriverPhase = "off-duty" | "online" | "offer" | "pickup" | "waiting" | "in-trip" | "completed";

const phase = ref<DriverPhase>("off-duty");
const driverName = ref("王师傅");
const serviceScore = ref(98);
const mode = ref("普通接单");
const order = ref<OrderOffer>({
  id: "demo-order-2048",
  passengerName: "林女士",
  pickup: "丰都县人民医院（门诊部）",
  destination: "丰都高铁站",
  pickupDistanceKm: 1.2,
  tripDistanceKm: 8.6,
  estimatedMinutes: 22,
  estimatedFare: 36.8,
});
const secondsLeft = ref(20);
const todayOrders = ref(23);
const todayIncome = ref(657);
const tripNumber = ref(0);
const completedFare = ref(36.8);
const navigationRoute = ref<DriverNavigationRoute | null>(null);
const passengerContact = ref<PassengerContact | null>(null);
const contactDialogVisible = ref(false);
const recentTrips = ref([
  { time: "09:42", route: "龙河新城 → 丰都汽车站", fare: "24.00" },
  { time: "08:15", route: "宏声文化广场 → 丰都县人民医院", fare: "18.50" },
]);
const homeNotices = ref([
  {
    title: "万顺播报",
    time: "10.27 08:30",
    body: "各位司机请注意，今日城区短途订单较多。出车前请核对上车点，遇到拥堵或暂时联系不上乘客，先在订单里留言，再按导航前往。",
  },
  {
    title: "五星老司机推荐",
    time: "10.27 09:20",
    body: "保持准点到达，上车后主动确认目的地。服务稳定，更容易拿到五星好评。",
    image: "/static/promo/star-driver.jpg",
  },
  {
    title: "丰都热报",
    time: "10.27 16:40",
    body: "丰都城区晚间订单明显增多，热门路段容易缓行。建议提前十五分钟出发，避开窄路和临停点，按导航前往约定地点。",
  },
]);
let offerTimer: ReturnType<typeof setInterval> | undefined;

async function syncApi<T>(task: () => Promise<T | null>): Promise<T | null> {
  try {
    return await task();
  } catch {
    uni.showToast({ title: "后端暂不可用，当前按演示流程运行", icon: "none" });
    return null;
  }
}

async function loadNavigationRoute(target: NavigationTarget) {
  navigationRoute.value = await syncApi(() => driverApi.getNavigationRoute(order.value.id, target));
}

watch(phase, (nextPhase) => {
  if (nextPhase === "pickup") void loadNavigationRoute("pickup");
  else if (nextPhase === "in-trip") void loadNavigationRoute("destination");
  else if (nextPhase === "off-duty" || nextPhase === "online" || nextPhase === "completed") navigationRoute.value = null;
});

onMounted(async () => {
  const dashboard = await syncApi(() => driverApi.getDashboard());
  if (!dashboard) return;
  driverName.value = dashboard.displayName;
  serviceScore.value = dashboard.serviceScore;
  todayOrders.value = dashboard.todayOrders;
  todayIncome.value = dashboard.todayIncome;
  phase.value = dashboard.online ? "online" : "off-duty";
});

function goOnline() {
  phase.value = "online";
  void syncApi(() => driverApi.setAvailability(true));
  uni.showToast({ title: "已出车，开始接单", icon: "none" });
}

function goOffline() {
  uni.showModal({
    title: "确认收车",
    content: "收车后将暂停接收新订单。",
    success: ({ confirm }) => {
      if (!confirm) return;
      clearOfferTimer();
      phase.value = "off-duty";
      void syncApi(() => driverApi.setAvailability(false));
    },
  });
}

function simulateOffer() {
  if (phase.value !== "online") return;
  void showOffer();
}

async function showOffer() {
  const currentOffer = await syncApi(() => driverApi.getCurrentOffer());
  if (currentOffer) order.value = currentOffer;
  phase.value = "offer";
  secondsLeft.value = 20;
  clearOfferTimer();
  offerTimer = setInterval(() => {
    secondsLeft.value -= 1;
    if (secondsLeft.value <= 0) declineOffer(true);
  }, 1000);
}

function clearOfferTimer() {
  if (offerTimer) clearInterval(offerTimer);
  offerTimer = undefined;
}

function acceptOffer() {
  clearOfferTimer();
  void syncApi(() => driverApi.acceptOffer(order.value.id));
  phase.value = "pickup";
}

function declineOffer(expired = false) {
  clearOfferTimer();
  void syncApi(() => driverApi.declineOffer(order.value.id));
  phase.value = "online";
  if (expired) uni.showToast({ title: "订单已超时，继续为你听单", icon: "none" });
}

function arrivedAtPickup() {
  void syncApi(() => driverApi.updateTrip(order.value.id, "arrived"));
  phase.value = "waiting";
  uni.showToast({ title: "已到达上车点，请等待乘客上车", icon: "none" });
}

function startTrip() {
  void syncApi(() => driverApi.updateTrip(order.value.id, "started"));
  phase.value = "in-trip";
}

function cancelTrip() {
  uni.showModal({
    title: "取消本次订单",
    content: "如乘客未出现或遇到特殊情况，请先与乘客联系。确认取消？",
    success: ({ confirm }) => {
      if (!confirm) return;
      void syncApi(() => driverApi.updateTrip(order.value.id, "cancelled"));
      phase.value = "online";
    },
  });
}

function finishTrip() {
  void syncApi(() => driverApi.updateTrip(order.value.id, "completed"));
  phase.value = "completed";
  completedFare.value = order.value.estimatedFare;
  todayOrders.value += 1;
  todayIncome.value += completedFare.value;
  tripNumber.value += 1;
  recentTrips.value.unshift({ time: "刚刚", route: `${order.value.pickup} → ${order.value.destination}`, fare: completedFare.value.toFixed(2) });
}

function returnToListening() {
  phase.value = "online";
}

function selectMode() {
  uni.showActionSheet({
    itemList: ["普通接单", "预约优先", "顺路单优先"],
    success: ({ tapIndex }) => {
      mode.value = ["普通接单", "预约优先", "顺路单优先"][tapIndex] ?? mode.value;
    },
  });
}

async function contactPassenger() {
  passengerContact.value = await syncApi(() => driverApi.getPassengerContact(order.value.id));
  if (passengerContact.value) contactDialogVisible.value = true;
}

async function requestPassengerCall() {
  const result = await syncApi(() => driverApi.requestPassengerCall(order.value.id));
  if (result?.accepted) {
    uni.showToast({ title: result.demo ? "模拟通话请求已记录" : "已发起乘客联系", icon: "none" });
    contactDialogVisible.value = false;
  }
}

async function sendArrivalMessage() {
  const result = await syncApi(() => driverApi.sendPassengerMessage(order.value.id, "您好，我已到达上车点，请您留意。"));
  if (result?.sent) {
    uni.showToast({ title: result.demo ? "模拟消息已发送" : "消息已发送", icon: "none" });
    contactDialogVisible.value = false;
  }
}

function showTripHistory() {
  void syncApi(() => driverApi.getTodayTrips());
  uni.showModal({
    title: "今日行程",
    content: recentTrips.value.map((trip) => `${trip.time}  ${trip.route}  ¥${trip.fare}`).join("\n\n"),
    showCancel: false,
  });
}

function removeHomeNotice(title: string) {
  homeNotices.value = homeNotices.value.filter((notice) => notice.title !== title);
}

function showRewards() {
  uni.showModal({ title: "司机奖励", content: "查看平台奖励活动与完成进度。", showCancel: false });
}

function openSafety() {
  uni.showActionSheet({
    itemList: ["安全中心", "紧急求助"],
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        uni.showModal({ title: "安全中心", content: "行程中请遵守交通法规。如遇紧急情况，可使用紧急求助。", showCancel: false });
        return;
      }
      uni.showModal({
        title: "发送紧急求助？",
        content: "将向平台发送你的求助请求。",
        success: ({ confirm }) => {
          if (confirm) {
            void syncApi(() => driverApi.sendSafetyAlert());
            uni.showToast({ title: "演示求助已记录", icon: "none" });
          }
        },
      });
    },
  });
}

onUnmounted(() => {
  clearOfferTimer();
});
</script>

<template>
  <view class="screen" :class="{ 'screen--home': phase === 'off-duty', 'screen--online': phase === 'online', 'screen--journey': ['pickup', 'waiting', 'in-trip'].includes(phase) }">
    <view class="titlebar">
      <button class="account" aria-label="安全与帮助" @click="openSafety">
        <image class="account-icon" src="/static/icons/person.svg" mode="aspectFit" aria-hidden="true" />
      </button>
      <view class="brand">
        <text class="brand-name">万顺</text>
        <text class="brand-en">OneSoon</text>
      </view>
    </view>

    <scroll-view class="content" scroll-y>
      <template v-if="phase === 'off-duty'">
        <view class="home-summary">
          <view class="home-score">
            <view class="home-score-value"><text>{{ serviceScore }}</text><text class="home-score-unit">分</text></view>
            <text class="home-score-label">服务评分</text>
          </view>
          <view class="home-stats-row">
            <view class="home-stat"><view class="home-stat-value"><text>{{ todayOrders }}</text><text class="home-stat-unit">单</text></view><text class="home-stat-label">今日接单</text></view>
            <view class="home-stat-divider" />
            <view class="home-stat"><view class="home-stat-value"><text>{{ todayIncome.toFixed(0) }}</text><text class="home-stat-unit">元</text></view><text class="home-stat-label">今日收益</text></view>
          </view>
          <view class="home-tools">
            <button class="home-tool" @click="openSafety"><image src="/static/icons/manual.svg" mode="aspectFit" /><text>手册</text></button>
            <button class="home-tool" @click="showRewards"><image src="/static/icons/reward.svg" mode="aspectFit" /><text>奖励</text></button>
            <button class="home-tool" @click="showTripHistory"><image src="/static/icons/order.svg" mode="aspectFit" /><text>订单详情</text></button>
          </view>
        </view>
        <scroll-view class="home-notices" scroll-y>
          <view v-for="notice in homeNotices" :key="notice.title" class="home-notice">
            <view class="home-notice-header"><text class="home-notice-title">{{ notice.title }}</text><text class="home-notice-time">{{ notice.time }}</text></view>
            <button class="home-notice-close" :aria-label="`删除${notice.title}`" @click="removeHomeNotice(notice.title)"><image src="/static/icons/close.svg" mode="aspectFit" /></button>
            <text class="home-notice-body">{{ notice.body }}</text>
            <image v-if="notice.image" class="home-notice-image" :src="notice.image" mode="aspectFill" />
          </view>
        </scroll-view>
      </template>

      <template v-else-if="phase === 'online'">
        <view class="online-canvas">
          <view class="map-grid online-map-grid">
            <view class="road road-a" /><view class="road road-b" /><view class="road road-c" />
            <view class="route-line" />
            <view class="map-pin map-pin--driver">车</view>
            <view class="map-pin map-pin--hot">热</view>
            <view class="map-pin map-pin--station">站</view>
            <view class="hotspot hotspot-a">人民医院</view><view class="hotspot hotspot-b">高铁站</view>
          </view>
          <view class="welcome-block welcome-block--compact online-welcome">
            <view class="online-indicator"><view class="map-live-dot" /><text>正在为你听单</text></view>
            <text class="page-title">保持在线，安心接单</text>
            <text class="muted">{{ mode }} · 今日已完成 {{ todayOrders }} 单</text>
          </view>
          <view class="online-map-caption"><text>丰都 · 实时热区示意</text><text>演示地图</text></view>
          <view class="hint-card online-hint"><text class="hint-icon">i</text><text>接单后先确认上车点，行驶中请注意安全。</text></view>
          <button class="demo-order" @click="simulateOffer">模拟新订单 <text>体验接单流程</text></button>
          <view class="online-stats">
            <view><text class="online-value">{{ todayIncome.toFixed(2) }}</text><text class="online-label">今日流水（元）</text></view>
            <view><text class="online-value">{{ todayOrders }}</text><text class="online-label">今日完成（单）</text></view>
            <button class="mode-chip" @click="selectMode"><text>{{ mode }}</text><view class="mode-arrow" /></button>
          </view>
        </view>
      </template>

      <template v-else-if="phase === 'offer'">
        <view class="welcome-block welcome-block--compact"><text class="eyebrow eyebrow--red">新订单 · {{ secondsLeft }} 秒</text><text class="page-title">附近乘客正在等你</text></view>
        <view class="offer-card">
          <view class="offer-top"><view><text class="offer-type">即时订单</text><text class="offer-id">订单 {{ order.id }}</text></view><view class="fare"><text>预估收入</text><strong>¥{{ order.estimatedFare.toFixed(2) }}</strong></view></view>
          <view class="route-row"><view class="route-marker route-marker--start">上</view><view class="route-text"><text class="route-caption">接乘客 · {{ order.pickupDistanceKm }} km</text><text class="route-address">{{ order.pickup }}</text></view></view>
          <view class="route-connector" />
          <view class="route-row"><view class="route-marker route-marker--end">终</view><view class="route-text"><text class="route-caption">目的地 · {{ order.tripDistanceKm }} km / {{ order.estimatedMinutes }} 分钟</text><text class="route-address">{{ order.destination }}</text></view></view>
          <view class="passenger-line"><text class="passenger-avatar">林</text><text class="passenger-name">{{ order.passengerName }}</text><text class="passenger-rating">★ 4.9</text></view>
          <view class="offer-actions"><button class="secondary-button" @click="declineOffer()">暂不接</button><button class="primary-button" @click="acceptOffer">接单出发</button></view>
        </view>
      </template>

      <template v-else-if="phase === 'pickup' || phase === 'waiting' || phase === 'in-trip'">
        <view class="journey-canvas">
          <view class="map-grid map-grid--route"><view class="road road-a" /><view class="road road-b" /><view class="road road-c" /><view class="journey-path" /><view class="map-pin map-pin--driver">车</view><view class="map-pin map-pin--hot">{{ phase === 'in-trip' ? '终' : '上' }}</view><view class="map-pin map-pin--station">站</view></view>
          <view class="journey-banner" :class="{ 'journey-banner--trip': phase === 'in-trip' }">
            <view class="nav-guidance">
              <view class="nav-turn">{{ phase === 'waiting' ? '✓' : '↑' }}</view>
              <view class="nav-guidance-copy">
                <text class="nav-guidance-title">{{ phase === 'pickup' ? '前往上车点' : phase === 'waiting' ? '已到达上车点' : '前往行程目的地' }}</text>
                <text class="nav-guidance-detail">{{ phase === 'pickup' ? `约 ${navigationRoute?.durationMinutes ?? 4} 分钟 · ${navigationRoute?.distanceKm ?? order.pickupDistanceKm} km` : phase === 'waiting' ? '请在安全地点停车，等待乘客上车' : `${navigationRoute?.durationMinutes ?? order.estimatedMinutes} 分钟 · ${navigationRoute?.distanceKm ?? order.tripDistanceKm} km` }}</text>
              </view>
              <view class="nav-stage">{{ phase === 'pickup' ? '接驾' : phase === 'waiting' ? '候客' : '行程中' }}</view>
            </view>
            <text class="nav-order-note">{{ phase === 'pickup' ? `乘客上车点：${order.pickup}` : phase === 'waiting' ? `乘客：${order.passengerName} · 上车后点击开始行程` : `目的地：${order.destination}` }}</text>
          </view>
          <view class="destination-strip destination-float"><text class="destination-icon">{{ phase === 'in-trip' ? '终' : '上' }}</text><view><text class="route-caption">{{ phase === 'in-trip' ? '行程目的地' : '乘客上车点' }}</text><text class="route-address">{{ phase === 'in-trip' ? order.destination : order.pickup }}</text></view></view>
          <view class="passenger-card passenger-float"><view class="passenger-line"><text class="passenger-avatar">林</text><view class="passenger-copy"><text class="check-title">{{ order.passengerName }}</text><text class="check-sub">乘客评分 4.9 · {{ phase === 'pickup' ? '请按导航前往上车点' : '请按导航安全驾驶' }}</text></view><button class="contact-button" @click="contactPassenger">联系</button></view><view class="tip-line">请在安全停车后操作手机</view></view>
        </view>
      </template>

      <template v-else>
        <view class="complete-hero"><view class="complete-check">✓</view><text class="eyebrow eyebrow--green">行程已完成</text><text class="complete-fare">¥{{ completedFare.toFixed(2) }}</text><text class="muted">本次行程收入已计入今日流水</text></view>
        <view class="receipt-card"><view class="receipt-row"><text>行程距离</text><strong>{{ order.tripDistanceKm }} km</strong></view><view class="receipt-row"><text>行程时长</text><strong>{{ order.estimatedMinutes }} 分钟</strong></view><view class="receipt-row"><text>起点</text><strong>{{ order.pickup }}</strong></view><view class="receipt-row"><text>终点</text><strong>{{ order.destination }}</strong></view><view class="receipt-row receipt-row--total"><text>司机收入</text><strong>¥{{ completedFare.toFixed(2) }}</strong></view></view>
        <view class="rating-card"><text class="check-title">服务评价</text><text class="stars">★★★★★</text><text class="check-sub">保持优质服务，收获更多好评</text></view>
        <button class="primary-button primary-button--wide" @click="returnToListening">返回接单首页</button>
        <button class="text-button" @click="showTripHistory">查看今日行程</button>
      </template>
    </scroll-view>

    <view v-if="contactDialogVisible && passengerContact" class="contact-overlay" @click.self="contactDialogVisible = false">
      <view class="contact-dialog">
        <text class="contact-dialog-title">联系乘客</text>
        <text class="contact-dialog-name">{{ passengerContact.name }}</text>
        <text class="contact-dialog-phone">{{ passengerContact.maskedPhone }}</text>
        <text class="contact-dialog-note">演示数据 · 接入后端后可使用真实隐私号联系</text>
        <button class="contact-dialog-action" @click="requestPassengerCall">拨打乘客</button>
        <button class="contact-dialog-action contact-dialog-action--secondary" @click="sendArrivalMessage">发送到达提醒</button>
        <button class="contact-dialog-cancel" @click="contactDialogVisible = false">取消</button>
      </view>
    </view>

    <view v-if="phase === 'off-duty'" class="action-bar"><button class="action-side" @click="selectMode"><image src="/static/icons/gear.svg" mode="aspectFit" /><text>模式</text></button><button class="action-main" @click="goOnline">点击出车</button></view>
    <view v-else-if="phase === 'online'" class="action-bar"><button class="action-side" @click="openSafety"><image src="/static/icons/manual.svg" mode="aspectFit" /><text>安全帮助</text></button><button class="action-main" @click="goOffline">收车休息</button></view>
    <view v-else-if="phase === 'pickup'" class="action-bar"><button class="action-side" @click="cancelTrip"><image src="/static/icons/close.svg" mode="aspectFit" /><text>取消订单</text></button><button class="action-main" @click="arrivedAtPickup">已到达上车点</button></view>
    <view v-else-if="phase === 'waiting'" class="action-bar"><button class="action-side" @click="contactPassenger"><image src="/static/icons/person.svg" mode="aspectFit" /><text>联系乘客</text></button><button class="action-main" @click="startTrip">乘客已上车，开始行程</button></view>
    <view v-else-if="phase === 'in-trip'" class="action-bar"><button class="action-side" @click="openSafety"><image src="/static/icons/gear.svg" mode="aspectFit" /><text>安全中心</text></button><button class="action-main" @click="finishTrip">结束行程</button></view>
    <view v-else-if="phase === 'offer'" class="offer-countdown"><view class="countdown-track"><view class="countdown-progress" :style="{ width: `${secondsLeft * 5}%` }" /></view><text>请确认是否接单</text></view>
  </view>
</template>

<style scoped>
.screen{display:flex;flex-direction:column;width:100%;max-width:375px;height:100vh;height:100dvh;margin:0 auto;overflow:hidden;background:#272733;color:#fff;box-sizing:border-box;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.titlebar{position:relative;flex:none;height:76px;padding:env(safe-area-inset-top) 18px 0;background:#2a2a34;box-sizing:content-box}
.account{position:absolute;top:calc(7px + env(safe-area-inset-top));left:8px;display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:14px;background:#41414e}
.account::after,.action-side::after,.action-main::after,.shortcut::after,.primary-button::after,.secondary-button::after,.contact-button::after,.demo-order::after{border:0}
.account-icon{display:block;flex:none;width:24px;height:24px;margin:0;object-fit:contain;object-position:center;filter:brightness(0) invert(1)}
.brand{position:absolute;top:calc(19px + env(safe-area-inset-top));right:18px;display:flex;align-items:baseline;gap:8px}
.brand-name{color:#d0121a;font-size:26px;font-weight:800;line-height:1}.brand-en{color:#e8eaed;font-size:13px;letter-spacing:.04em}
.content{flex:1;min-height:0;padding:30px 16px 24px;box-sizing:border-box}
.welcome-block{display:flex;flex-direction:column;gap:8px;padding:12px 4px 22px}.welcome-block--compact{padding-top:4px;padding-bottom:18px}
.eyebrow{color:#d3a4a7;font-size:12px;font-weight:700;letter-spacing:.04em}.eyebrow--green{color:#75d9a5}.eyebrow--red{color:#ff8b91}
.page-title{color:#fff;font-size:22px;font-weight:750;line-height:1.35}.muted{color:#a3a8b2;font-size:12px;line-height:1.6}
.score-card,.check-card,.map-card,.offer-card,.passenger-card,.receipt-card,.rating-card{border:1px solid #464752;border-radius:18px;background:#31313b;box-shadow:0 8px 24px #11121a33}
.score-card{display:flex;align-items:center;justify-content:space-around;padding:18px 10px;margin-bottom:24px}.score-main,.stat{display:flex;flex-direction:column;align-items:center;gap:4px}.score-main{min-width:75px}.score-number{font-size:34px;font-weight:800;line-height:1}.score-unit{margin-top:-25px;margin-left:53px;color:#d0121a;font-size:13px}.score-label,.stat-label{color:#a3a8b2;font-size:11px}.stat-number{font-size:22px;font-weight:750}.score-divider{width:1px;height:40px;background:#555762}
.section-heading{display:flex;align-items:center;justify-content:space-between;margin:18px 4px 12px;color:#f5f5f7;font-size:15px;font-weight:700}.section-note{color:#9298a5;font-size:11px;font-weight:500}
.check-card{padding:4px 14px}.check-row{display:flex;align-items:center;gap:11px;padding:14px 0;border-bottom:1px solid #464752}.check-row:last-child{border-bottom:0}.check-mark{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:10px;background:#1e5945;color:#82e2b2;font-weight:800}.check-mark--soft{background:#51452e;color:#f3ca75}.check-copy,.passenger-copy{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}.check-title{color:#f0f1f3;font-size:13px;font-weight:650}.check-sub{color:#9ba1ad;font-size:11px;line-height:1.45}.check-tag{color:#848b98;font-size:10px}
.shortcut-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.shortcut{display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 6px;border:1px solid #454651;border-radius:15px;background:#31313b;color:#e9eaed;font-size:11px}.shortcut image{width:24px;height:24px}
.map-card{overflow:hidden;margin-bottom:14px;background:#30333c}.map-label{display:flex;align-items:center;gap:7px;padding:13px 14px;color:#e6e8eb;font-size:12px;font-weight:650}.map-live-dot{width:7px;height:7px;border-radius:50%;background:#55d694}.map-demo{margin-left:auto;color:#929aa8;font-size:10px;font-weight:400}.map-grid{position:relative;height:210px;overflow:hidden;background-color:#3b4149;background-image:linear-gradient(28deg,transparent 48%,#77808a45 49%,#77808a45 51%,transparent 52%),linear-gradient(145deg,transparent 46%,#77808a35 47%,#77808a35 49%,transparent 50%),linear-gradient(90deg,#ffffff08 1px,transparent 1px),linear-gradient(#ffffff08 1px,transparent 1px);background-size:100% 100%,100% 100%,38px 38px,38px 38px}
.road{position:absolute;height:7px;border:1px solid #aab0b044;border-left:0;border-right:0;background:#5b626b}.road-a{top:44%;left:-8%;width:118%;transform:rotate(-19deg)}.road-b{top:70%;left:-12%;width:126%;transform:rotate(14deg)}.road-c{top:40%;left:33%;width:75%;transform:rotate(72deg)}.route-line,.journey-path{position:absolute;left:22%;top:53%;width:52%;height:4px;border-radius:9px;background:#df313c;transform:rotate(-23deg);box-shadow:0 0 8px #e3474e77}.journey-path{left:23%;top:50%;width:55%;transform:rotate(18deg)}
.map-pin{position:absolute;display:grid;place-items:center;width:28px;height:28px;border:2px solid #fff;border-radius:50% 50% 50% 6px;background:#d0121a;color:#fff;font-size:10px;font-weight:800;transform:rotate(-45deg);box-shadow:0 4px 10px #10111766}.map-pin::first-letter{transform:rotate(45deg)}.map-pin--driver{left:24%;top:56%;background:#2675c5}.map-pin--hot{right:24%;top:28%}.map-pin--station{right:16%;bottom:17%;background:#5c6470}.hotspot{position:absolute;padding:4px 7px;border:1px solid #ffffff22;border-radius:7px;background:#292c33d9;color:#e1e4e9;font-size:9px}.hotspot-a{left:9%;top:19%}.hotspot-b{right:9%;bottom:12%}.map-footer{display:flex;justify-content:space-between;padding:10px 14px;color:#9da4af;font-size:10px}
.online-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:6px;padding:16px 10px;border:1px solid #464752;border-radius:16px;background:#31313b}.online-stats>view{display:flex;min-width:0;flex-direction:column;align-items:center;gap:4px;text-align:center}.online-value{color:#fff;font-size:20px;font-weight:750;white-space:nowrap}.online-label{color:#a3a8b2;font-size:10px;white-space:nowrap}.mode-chip{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-width:0;min-height:36px;margin:0;padding:0 5px;border:1px solid #555762;border-radius:999px;background:#3c3d48;color:#e7e9ed;font-size:12px;font-weight:650;line-height:1;white-space:nowrap}.mode-arrow{flex:none;width:6px;height:6px;margin-top:-3px;border-right:1.5px solid #b8bdc6;border-bottom:1.5px solid #b8bdc6;transform:rotate(45deg)}.hint-card{display:flex;gap:9px;align-items:flex-start;margin-top:14px;padding:12px;border-radius:13px;background:#353640;color:#aab0ba;font-size:11px;line-height:1.55}.hint-icon{display:grid;place-items:center;flex:none;width:17px;height:17px;border-radius:50%;background:#4a4d58;color:#eceef0;font-weight:700}.demo-order{display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;margin-top:18px;padding:12px;border:1px dashed #696b77;border-radius:14px;background:transparent;color:#e9eaee;font-size:13px;font-weight:700}.demo-order text{color:#9197a3;font-size:10px;font-weight:400}
.offer-card{padding:16px}.offer-top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:14px;border-bottom:1px solid #484a55}.offer-type{display:block;color:#fff;font-size:15px;font-weight:750}.offer-id{display:block;margin-top:5px;color:#989eaa;font-size:10px}.fare{text-align:right;color:#a5aab4;font-size:10px}.fare strong{display:block;margin-top:2px;color:#ff777e;font-size:23px}.route-row{display:flex;align-items:center;gap:12px;padding:15px 0}.route-marker{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;color:#fff;font-size:11px;font-weight:800}.route-marker--start{background:#d0121a}.route-marker--end{background:#525865}.route-text{display:flex;flex-direction:column;gap:5px}.route-caption{color:#9fa5b0;font-size:10px}.route-address{color:#f1f2f4;font-size:13px;font-weight:650}.route-connector{height:16px;margin:-10px 0 -10px 13px;border-left:1px dashed #626572}.passenger-line{display:flex;align-items:center;gap:9px;padding:12px 0;border-top:1px solid #484a55;color:#eceef1;font-size:12px}.passenger-avatar{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#574146;color:#ffc5c8;font-weight:750}.passenger-rating{margin-left:auto;color:#f1c46b}.offer-actions{display:flex;gap:10px;margin-top:7px}.primary-button,.secondary-button{flex:1;height:48px;margin:0;border:0;border-radius:13px;font-size:14px;font-weight:750}.primary-button{background:#d0121a;color:#fff}.primary-button--wide{width:100%;margin-top:14px}.secondary-button{border:1px solid #565964;background:#3c3d47;color:#d1d4da}.countdown-track{width:100%;height:3px;overflow:hidden;border-radius:2px;background:#42434e}.countdown-progress{height:100%;background:#d0121a;transition:width 1s linear}.offer-countdown{display:flex;flex-direction:column;align-items:center;gap:7px;padding:0 22px 14px;color:#969ca8;font-size:10px}
.journey-banner{display:flex;flex-direction:column;gap:7px;padding:8px 4px 17px}.journey-banner--trip .eyebrow{color:#ff8b91}.map-card--journey{margin-bottom:13px}.map-grid--route{height:160px}.destination-strip{display:flex;align-items:center;gap:11px;padding:12px 14px}.destination-icon{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#50535f;color:#fff;font-size:10px}.passenger-card{padding:12px 14px}.contact-button{padding:7px 13px;border:1px solid #656874;border-radius:999px;background:transparent;color:#fff;font-size:11px}.tip-line{margin-top:10px;padding-top:9px;border-top:1px solid #464752;color:#e1bd72;font-size:10px;text-align:center}
.complete-hero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 0 22px}.complete-check{display:grid;place-items:center;width:54px;height:54px;margin-bottom:4px;border-radius:50%;background:#1e5945;color:#83e2b3;font-size:26px;font-weight:800}.complete-fare{color:#fff;font-size:38px;font-weight:800}.receipt-card{padding:4px 15px}.receipt-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid #464752;color:#a4aab5;font-size:11px}.receipt-row strong{max-width:70%;color:#f1f2f4;font-size:11px;text-align:right}.receipt-row--total{border:0}.receipt-row--total strong{color:#ff8186;font-size:17px}.rating-card{display:flex;flex-direction:column;align-items:center;gap:7px;margin-top:14px;padding:15px}.stars{color:#f2c257;font-size:20px;letter-spacing:3px}.text-button{display:block;margin:9px auto 4px;padding:9px 16px;border:0;background:transparent;color:#c8cbd1;font-size:12px}
.action-bar{display:flex;flex:none;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #41424c;background:#292a34}.action-side{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:76px;height:52px;margin:0;border:1px solid #4a4b56;border-radius:13px;background:#353640;color:#d4d6db;font-size:9px}.action-side image{width:19px;height:19px;filter:brightness(0) invert(1)}.action-main{flex:1;height:52px;margin:0;border:0;border-radius:14px;background:#d0121a;color:#fff;font-size:16px;font-weight:800;letter-spacing:.03em}.action-main:active,.primary-button:active{background:#ac1018}
/* Keep symbols legible and align each label with its icon, following road-sign clarity. */
.shortcut{min-height:78px;justify-content:center;line-height:1.25}
.shortcut image{display:block;flex:none}
.check-mark,.route-marker,.destination-icon,.complete-check,.hint-icon{display:grid;place-items:center;flex:none;line-height:1}
.check-row,.route-row,.destination-strip,.passenger-line{align-items:center}
.check-copy,.passenger-copy,.route-text{min-width:0}
.route-address{line-height:1.45;overflow-wrap:anywhere}
.check-tag{flex:none;text-align:right}
.map-pin{border-radius:50%;transform:none;line-height:1;text-align:center}
.map-label,.map-footer{align-items:center;line-height:1.35}
.action-side image{display:block;flex:none}
.action-side text{line-height:1.2;text-align:center}
.action-main{display:flex;align-items:center;justify-content:center;line-height:1.2}
.contact-overlay{position:fixed;z-index:30;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:#101117a8;box-sizing:border-box}
.contact-dialog{display:flex;flex-direction:column;align-items:center;width:100%;max-width:335px;padding:24px 20px 16px;border:1px solid #484955;border-radius:18px;background:#30303b;box-sizing:border-box;text-align:center}
.contact-dialog-title{margin-bottom:16px;color:#fff;font-size:20px;font-weight:700}
.contact-dialog-name{color:#f4f5f7;font-size:16px;font-weight:650}
.contact-dialog-phone{margin-top:8px;color:#fff;font-size:22px;font-weight:700;letter-spacing:.04em}
.contact-dialog-note{margin:10px 0 18px;color:#a3a8b2;font-size:11px;line-height:1.5}
.contact-dialog-action,.contact-dialog-cancel{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin:0 0 10px;border:0;border-radius:12px;background:#d0121a;color:white;font-size:14px;font-weight:650;line-height:1.2}
.contact-dialog-action::after,.contact-dialog-cancel::after{border:0}
.contact-dialog-action--secondary{border:1px solid #535460;background:#3c3d48;color:#f4f5f7}
.contact-dialog-cancel{min-height:38px;margin:0;background:transparent;color:#a3a8b2;font-size:13px;font-weight:500}
.passenger-line{min-height:56px}
.passenger-avatar{display:flex;align-items:center;justify-content:center;flex:none;line-height:1}
.passenger-name,.passenger-rating{display:flex;align-items:center;min-height:32px;line-height:1.2}
.passenger-rating{margin-left:auto;white-space:nowrap}

/* Light content palette; header and bottom action bar keep their dark theme. */
.content{background:#f3f4f6;color:#252630}
.welcome-block .eyebrow,.journey-banner .eyebrow{color:#bb2430}
.page-title{color:#20212a}
.muted{color:#707784}
.score-card,.check-card,.map-card,.offer-card,.passenger-card,.receipt-card,.rating-card{border-color:#e0e2e7;background:#fff;box-shadow:0 5px 16px #20232d0d}
.score-label,.stat-label,.check-sub,.check-tag,.route-caption,.offer-id,.fare,.receipt-row{color:#737987}
.score-divider{background:#d9dce2}
.section-heading,.check-title,.offer-type,.route-address,.passenger-line,.receipt-row strong{color:#252630}
.check-row,.offer-top,.passenger-line,.receipt-row{border-color:#e7e9ed}
.check-mark{background:#e0f4eb;color:#198357}
.check-mark--soft{background:#fff2d6;color:#a96b00}
.map-card{overflow:hidden}
.map-label,.destination-strip{background:#fff;color:#252630}
.map-demo,.map-footer{color:#737987}
.online-stats{border-color:#e0e2e7;background:#fff}
.online-value{color:#252630}
.online-label{color:#737987}
.mode-chip{border-color:#d5d8df;background:#f5f6f8;color:#333641}
.mode-arrow{border-color:#737987}
.hint-card{background:#e9ebef;color:#626977}
.hint-icon{background:#d9dde4;color:#525967}
.demo-order{border-color:#bdc2cc;color:#30333d}
.demo-order text{color:#737987}
.offer-type{color:#252630}
.fare strong,.receipt-row--total strong{color:#c5222d}
.route-address{color:#292b35}
.route-connector{border-color:#c7cbd3}
.passenger-avatar{background:#f8e8e9;color:#b4232e}
.secondary-button{border-color:#d5d8df;background:#f1f2f5;color:#424650}
.offer-countdown{color:#737987}
.journey-banner .muted{color:#707784}
.destination-icon{background:#e8eaf0;color:#434854}
.contact-button{border-color:#c8ccd4;color:#353943}
.tip-line{border-color:#e7e9ed;color:#8a650d}
.complete-fare{color:#252630}
.complete-check{background:#e0f4eb;color:#198357}
.text-button{color:#5c6471}
.screen--home{background:#f3f4f6}
.screen--home .content{background:#f3f4f6}
.home-summary{background:#fff;border-bottom:1px solid #e4e6eb}
.home-score-value,.home-stat-value{color:#252630}
.home-score-label,.home-stat-label{color:#737987}
.home-stat-divider{background:#d9dce2}
.home-tool{background:#f0f1f4;color:#343741}
.home-tool image{filter:brightness(0) saturate(100%) invert(16%) sepia(8%) saturate(732%) hue-rotate(193deg) brightness(94%) contrast(88%)}
.home-notices{background:#f3f4f6}
.offer-actions{align-items:stretch}
.offer-actions>.primary-button,.offer-actions>.secondary-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:0;height:48px;padding:0 8px;line-height:1;white-space:nowrap;text-align:center;vertical-align:middle}
.offer-actions>.primary-button text,.offer-actions>.secondary-button text{line-height:1}
.primary-button,.secondary-button,.contact-button,.mode-chip,.shortcut,.action-side,.action-main,.text-button,.demo-order{display:flex;align-items:center;justify-content:center;box-sizing:border-box;line-height:1.2}
.primary-button,.secondary-button{padding:0 10px;text-align:center}
.primary-button--wide{width:100%;min-height:48px;height:48px;margin-top:14px}
.text-button{min-height:44px;margin:8px auto 4px;padding:0 16px;text-align:center;white-space:nowrap}
.text-button::after{border:0}
.contact-button{min-height:36px;white-space:nowrap}
.shortcut{flex-direction:column}
.action-side{flex-direction:column}
.demo-order{flex-direction:column}
.screen--home{max-width:375px;background:#d8dbe1}
.screen--home .titlebar{height:60px;padding:0}
.screen--home .account{top:calc(7px + env(safe-area-inset-top));left:8px;width:44px;height:44px;border-radius:14px;background:#41414e}
.screen--home .brand{top:18px;right:18px;gap:7px}
.screen--home .content{display:flex;flex-direction:column;min-height:0;padding:0;background:#d8dbe1}
.home-summary{display:flex;flex:none;flex-direction:column;height:326px;padding:0 10px 8px;box-sizing:border-box;background:#2a2a34}
.home-score{display:flex;flex-direction:column;align-items:center;padding-top:58px}
.home-score-value,.home-stat-value{display:flex;align-items:baseline;color:#fff;font-weight:800;line-height:1}
.home-score-value{font-size:58px;letter-spacing:-1px}
.home-score-unit{margin-left:2px;font-size:20px;letter-spacing:0}
.home-score-label,.home-stat-label{color:#a6b6cc;font-size:13px;line-height:1.45}
.home-stats-row{display:flex;align-items:center;height:64px;margin-top:26px}
.home-stat{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0}
.home-stat-value{font-size:40px;letter-spacing:-1px}
.home-stat-unit{margin-left:2px;font-size:15px;letter-spacing:0}
.home-stat-divider{flex:none;width:1px;height:32px;background:#626573}
.home-tools{display:flex;gap:14px;margin-top:auto}
.home-tool{display:flex;flex:1;align-items:center;justify-content:center;gap:8px;min-width:0;height:56px;margin:0;padding:0 5px;border:0;border-radius:8px;background:#40414c;color:#fff;font-size:13px;font-weight:650;line-height:1.2;white-space:nowrap}
.home-tool::after{border:0}
.home-tool image{display:block;flex:none;width:19px;height:19px;filter:brightness(0) invert(1)}
.home-notices{flex:1;min-height:0;padding:10px 8px;box-sizing:border-box;background:#d8dbe1}
.home-notice{position:relative;display:flex;flex-direction:column;margin-bottom:10px;padding:15px 14px 16px;background:#fff;color:#17181b}
.home-notice-header{display:flex;align-items:baseline;gap:8px;min-height:22px;padding-right:28px}
.home-notice-title{font-size:15px;font-weight:750;line-height:1.4}
.home-notice-time{color:#24262c;font-size:12px;line-height:1.4;white-space:nowrap}
.home-notice-close{position:absolute;top:11px;right:9px;display:grid;place-items:center;width:26px;height:26px;margin:0;padding:0;border:0;background:transparent}
.home-notice-close::after{border:0}
.home-notice-close image{display:block;width:15px;height:15px}
.home-notice-body{margin-top:10px;color:#151619;font-size:14px;line-height:1.62}
.home-notice-image{display:block;width:100%;height:140px;margin-top:12px;object-fit:cover}
.screen--online .content{padding:12px 12px 14px}
.screen--online .welcome-block{gap:4px;padding:2px 4px 9px}
.screen--online .eyebrow--green{color:#198357}
.screen--online .page-title{font-size:19px}
.screen--online .welcome-block .muted{font-size:11px}
.screen--online .map-card--online{margin-bottom:9px}
.screen--online .map-card--online .map-grid{height:clamp(240px,42vh,360px)}
.screen--online .map-card--online .map-label{padding:10px 12px}
.screen--online .map-card--online .map-footer{padding:8px 12px}
.screen--online .online-stats{padding:10px 8px}
.screen--online .online-value{font-size:17px}
.screen--online .online-label{font-size:9px}
.screen--online .mode-chip{min-height:32px;font-size:11px}
.screen--online .hint-card{gap:7px;margin-top:9px;padding:9px;font-size:10px}
.screen--online .demo-order{gap:2px;margin-top:10px;padding:8px;font-size:12px}
.screen--online .demo-order text{font-size:9px}
.screen--journey .content{padding:10px 10px 12px}
.screen--journey .journey-banner{gap:3px;padding:0 3px 8px}
.screen--journey .journey-banner .eyebrow{font-size:10px}
.screen--journey .journey-banner .page-title{font-size:17px;line-height:1.25}
.screen--journey .journey-banner .muted{font-size:10px;line-height:1.35}
.screen--journey .map-card--journey{margin-bottom:8px}
.screen--journey .map-card--journey .map-label{padding:9px 12px}
.screen--journey .map-grid--route{height:clamp(280px,46vh,390px)}
.screen--journey .destination-strip{gap:8px;padding:8px 12px}
.screen--journey .destination-icon{width:24px;height:24px;font-size:9px}
.screen--journey .passenger-card{padding:8px 12px}
.screen--journey .passenger-line{min-height:42px;padding:6px 0}
.screen--journey .passenger-avatar{width:28px;height:28px}
.screen--journey .tip-line{margin-top:6px;padding-top:6px;font-size:9px}
.screen--journey .journey-banner{gap:7px;padding:9px 11px;margin-bottom:8px;border:1px solid #e0e2e7;border-radius:14px;background:#fff;box-shadow:0 4px 12px #20232d0a}
.nav-guidance{display:flex;align-items:center;gap:10px;min-width:0}
.nav-turn{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;background:#d0121a;color:#fff;font-size:22px;font-weight:750;line-height:1}
.nav-guidance-copy{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
.nav-guidance-title{overflow:hidden;color:#252630;font-size:15px;font-weight:750;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.nav-guidance-detail{color:#69717e;font-size:11px;line-height:1.3}
.nav-stage{flex:none;padding:5px 8px;border-radius:999px;background:#f9e8e9;color:#b51c27;font-size:10px;font-weight:650}
.nav-order-note{overflow:hidden;color:#747b87;font-size:10px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
.screen--journey .map-grid--route,.screen--online .map-grid{background-color:#e8eeeb;background-image:linear-gradient(28deg,transparent 48%,#ffffffc9 49%,#ffffffc9 51%,transparent 52%),linear-gradient(145deg,transparent 46%,#ffffffbd 47%,#ffffffbd 49%,transparent 50%),linear-gradient(90deg,#76847712 1px,transparent 1px),linear-gradient(#76847712 1px,transparent 1px)}
.screen--journey .road,.screen--online .road{height:9px;border-color:#ffffffd9;background:#c3ccca}
.screen--journey .hotspot,.screen--online .hotspot{border-color:#e1e4e7;background:#fff;color:#49515c;box-shadow:0 2px 5px #24283016}
.screen--journey .map-footer,.screen--online .map-footer{background:#fff}
.screen--journey{position:relative}
.screen--journey .titlebar{position:relative;z-index:4}
.screen--journey .content{position:absolute;z-index:1;inset:0;width:100%;height:100%;padding:0;flex:none;background:transparent}
.journey-canvas{position:relative;width:100%;height:100%;min-height:100%;overflow:hidden;background:#e8eeeb}
.journey-canvas>.map-grid--route{position:absolute;inset:0;width:100%;height:100%;background-color:#e8eeeb}
.screen--journey .map-grid--route .road{height:12px}
.journey-canvas .journey-path{height:6px}
.screen--journey .journey-banner{position:absolute;z-index:2;top:calc(82px + env(safe-area-inset-top));right:12px;left:12px;margin:0;padding:10px 12px;border-color:#e2e4e8;border-radius:16px}
.destination-float{position:absolute;z-index:2;right:12px;bottom:calc(172px + env(safe-area-inset-bottom));max-width:78%;border:1px solid #e0e2e7;border-radius:14px;background:#fff;box-shadow:0 5px 16px #20232d1a}
.passenger-float{position:absolute;z-index:2;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));left:12px;border:1px solid #e0e2e7;border-radius:16px;background:#fff;box-shadow:0 5px 18px #20232d1a}
.screen--journey .action-bar{position:absolute;z-index:4;right:0;bottom:0;left:0;box-sizing:border-box;border-top:1px solid #ffffff38;background:#292a34f2}
.screen--online{position:relative}
.screen--online .titlebar{position:relative;z-index:4}
.screen--online .content{position:absolute;z-index:1;inset:0;width:100%;height:100%;padding:0;flex:none;background:transparent}
.online-canvas{position:relative;width:100%;height:100%;min-height:100%;overflow:hidden;background:#e8eeeb}
.online-map-grid{position:absolute;inset:0;width:100%;height:100%;background-color:#e8eeeb}
.screen--online .online-welcome{position:absolute;z-index:2;top:calc(82px + env(safe-area-inset-top));right:12px;left:12px;gap:4px;margin:0;padding:10px 12px;border:1px solid #e0e2e7;border-radius:16px;background:#ffffffed;box-shadow:0 5px 18px #20232d18}
.online-indicator{display:flex;align-items:center;gap:6px;color:#198357;font-size:11px;font-weight:700}
.screen--online .online-map-caption{position:absolute;z-index:2;top:52%;left:12px;display:flex;flex-direction:column;gap:3px;padding:7px 10px;border:1px solid #e0e2e7;border-radius:10px;background:#ffffffed;color:#424955;font-size:10px;box-shadow:0 3px 10px #20232d12}
.screen--online .online-map-caption text+text{color:#858b96;font-size:9px}
.screen--online .online-hint{position:absolute;z-index:2;right:12px;bottom:calc(178px + env(safe-area-inset-bottom));left:12px;margin:0;padding:8px 10px;background:#fffffff0;box-shadow:0 3px 12px #20232d12}
.screen--online .online-hint .hint-icon{background:#e6e9ef;color:#525967}
.screen--online .demo-order{position:absolute;z-index:2;right:12px;bottom:calc(258px + env(safe-area-inset-bottom));width:auto;margin:0;padding:7px 12px;border:1px solid #e0e2e7;border-radius:12px;background:#fffffff0;color:#333741;box-shadow:0 3px 12px #20232d12}
.screen--online .online-stats{position:absolute;z-index:2;right:12px;bottom:calc(91px + env(safe-area-inset-bottom));left:12px;margin:0;box-shadow:0 5px 18px #20232d1a}
.screen--online .action-bar{position:absolute;z-index:4;right:0;bottom:0;left:0;box-sizing:border-box}
</style>

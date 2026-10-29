<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { listPlaceSearches, recordPlaceSearch, type PlaceSearch } from "@/passenger-api";
import { saveChosenDestination } from "@/chosen-destination";
import { fengduPlaces } from "@/fengdu-places";
import { searchPlaceTips, type PlaceTip } from "@/passenger-places";
import { requirePassenger } from "@/passenger-session";

const query = ref("");
const places = ref<PlaceSearch[]>([]);
const tips = ref<PlaceTip[]>([]);
const passengerId = ref("");
let searchTicket = 0;
let searchTimer = 0;
let chosenName = "";

onShow(() => {
  const passenger = requirePassenger();
  if (!passenger) return;
  passengerId.value = passenger.id;
  refreshPlaces(passenger.id);
});

watch(query, (value) => {
  if (value === chosenName) return;
  chosenName = "";
  window.clearTimeout(searchTimer);
  const keyword = value.trim();
  const ticket = ++searchTicket;
  if (!keyword) {
    tips.value = [];
    return;
  }
  searchTimer = window.setTimeout(() => {
    searchPlaceTips(keyword)
      .then((found) => {
        if (ticket === searchTicket) tips.value = found;
      })
      .catch(() => {
        if (ticket === searchTicket) tips.value = [];
      });
  }, 300);
});

onUnmounted(() => {
  window.clearTimeout(searchTimer);
});

function refreshPlaces(id: string) {
  listPlaceSearches(id)
    .then((result) => {
      places.value = result.places.slice(0, 3);
    })
    .catch(() => {
      places.value = [];
    });
}

function chooseTip(tip: PlaceTip) {
  chosenName = tip.name;
  query.value = tip.name;
  tips.value = [];
  searchTicket += 1;
  const id = passengerId.value;
  if (tip.longitude === null || tip.latitude === null) return;
  saveChosenDestination({
    name: tip.name,
    longitude: tip.longitude,
    latitude: tip.latitude,
  });
  if (id && tip.placeId) {
    recordPlaceSearch(id, {
      placeId: tip.placeId,
      name: tip.name,
      address: tip.address,
      longitude: tip.longitude,
      latitude: tip.latitude,
    }).catch(() => undefined);
  }
  uni.navigateBack({
    fail() {
      uni.reLaunch({ url: "/pages/home/home" });
    },
  });
}

function backHome() {
  uni.navigateBack({
    fail() {
      uni.reLaunch({ url: "/pages/home/home" });
    },
  });
}
</script>

<template>
  <view class="screen app-page">
    <view class="top">
      <button class="back" aria-label="返回首页" @tap="backHome">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5 8 12l7 7" />
        </svg>
      </button>
      <text class="logo">万顺</text>
    </view>
    <input
      v-model="query"
      class="query"
      type="text"
      confirm-type="search"
      placeholder="你想去哪儿"
      placeholder-class="placeholder"
      aria-label="你想去哪儿"
      :focus="true"
    />
    <view v-if="tips.length" class="suggest">
      <view
        v-for="(tip, index) in tips"
        :key="`${tip.placeId}-${index}`"
        class="place"
        role="button"
        @tap="chooseTip(tip)"
      >
        <text class="place-name">{{ tip.name }}</text>
        <text v-if="tip.address" class="place-address">{{ tip.address }}</text>
      </view>
    </view>
    <view class="recommend">
      <view class="recommend-bar">
        <text class="recommend-title">为你推荐</text>
      </view>
      <view v-for="place in places" :key="place.placeId" class="place">
        <text class="place-name">{{ place.name }}</text>
        <text v-if="place.address" class="place-address">{{ place.address }}</text>
      </view>
    </view>
    <view class="recommend">
      <view class="recommend-bar">
        <text class="recommend-title">丰都县</text>
      </view>
      <view v-for="place in fengduPlaces" :key="place.placeId" class="place">
        <text class="place-name">{{ place.name }}</text>
        <text class="place-address">{{ place.address }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.screen {
  min-height: var(--app-viewport-height);
  padding: calc(20px + var(--app-safe-top)) 16px 24px;
  background: #ffffff;
}

.top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin-bottom: 20px;
}

.back {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1a1a1a;
  line-height: 0;
}

.back::after {
  border: 0;
}

.back svg {
  width: 22px;
  height: 22px;
}

.logo {
  display: block;
  margin: 0;
  color: #d0121a;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-align: center;
}

.query {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 2px solid #d0121a;
  border-radius: 12px;
  background: #ffffff;
  color: #1a1a1a;
  font-size: 16px;
  caret-color: #d0121a;
}

.query:focus {
  outline: 3px solid rgba(208, 18, 26, 0.28);
  outline-offset: 2px;
}

.placeholder {
  color: #5c6370;
}

.suggest {
  margin-top: 8px;
  overflow: hidden;
  border: 1px solid #ece7e7;
  border-radius: 12px;
  background: #ffffff;
}

.suggest .place:first-child {
  border-top: 0;
}

.recommend {
  margin-top: 16px;
  overflow: hidden;
  border-radius: 12px;
  background: #ffffff;
}

.recommend-bar {
  padding: 10px 16px;
  background: #fcf3f0;
}

.recommend-title {
  color: #d5612e;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.place {
  padding: 12px 16px;
  border-top: 1px solid #ece7e7;
}

.place-name {
  display: block;
  color: #1a1a1a;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}

.place-address {
  display: block;
  margin-top: 4px;
  color: #3c4149;
  font-size: 13px;
  line-height: 1.4;
}
</style>

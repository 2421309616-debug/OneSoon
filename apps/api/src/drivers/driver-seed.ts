export type SeedPlace = {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
};

export type SeedOrder = {
  passengerName: string;
  passengerPhone: string;
  passengerRating: number;
  from: SeedPlace;
  to: SeedPlace;
  pickupKm: number;
  pickupMinutes: number;
  tripKm: number;
  tripMinutes: number;
  fare: number;
  note: string;
};

/** 丰都县城真实地点，与乘客端 fengdu-places.ts 保持一致 */
const PLACES: SeedPlace[] = [
  {
    name: '丰都鬼城',
    address: '重庆市丰都县名山街道名山路152号',
    longitude: 107.722209,
    latitude: 29.887322,
  },
  {
    name: '丰都站',
    address: '重庆市丰都县三合街道丁庄村',
    longitude: 107.740472,
    latitude: 29.865724,
  },
  {
    name: '丰都八一广场',
    address: '重庆市丰都县雪玉路156号',
    longitude: 107.733221,
    latitude: 29.863102,
  },
  {
    name: '丰都县人民政府',
    address: '重庆市丰都县平都大道西段53号',
    longitude: 107.731056,
    latitude: 29.863785,
  },
  {
    name: '重医附一院丰都医院',
    address: '重庆市丰都县芦塘街33号',
    longitude: 107.741233,
    latitude: 29.871622,
  },
  {
    name: '丰都汽车客运站',
    address: '重庆市丰都县滨江西路',
    longitude: 107.725512,
    latitude: 29.869103,
  },
  {
    name: '丰都港',
    address: '重庆市丰都县滨江西路31号',
    longitude: 107.719883,
    latitude: 29.872401,
  },
  {
    name: '宏声商业广场',
    address: '重庆市丰都县平都大道西段',
    longitude: 107.734812,
    latitude: 29.866503,
  },
];

const PASSENGER_NAMES = [
  '李先生',
  '王女士',
  '张同学',
  '陈先生',
  '刘女士',
  '赵先生',
  '周同学',
  '吴女士',
  '孙先生',
  '郑女士',
];

const NOTES = [
  '',
  '',
  '',
  '带了一个行李箱',
  '赶时间，麻烦快一点',
  '有一个小孩',
  '在路边等，穿白衣服',
  '帮忙放一下后备箱',
];

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('Cannot pick from an empty list');
  }
  return item;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 两点间球面距离（公里） */
function haversine(from: SeedPlace, to: SeedPlace): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 起步价 8 元含 2 公里，超出部分每公里 1.8 元 */
function estimateFare(tripKm: number): number {
  const base = 8;
  const extra = Math.max(0, tripKm - 2) * 1.8;
  return Math.round(base + extra);
}

function randomPhone(): string {
  const tail = Math.floor(10_000_000 + Math.random() * 90_000_000);
  return `138${String(tail).padStart(8, '0')}`;
}

export function buildSeedOrders(count: number): SeedOrder[] {
  const orders: SeedOrder[] = [];
  for (let i = 0; i < count; i += 1) {
    const from = pick(PLACES);
    let to = pick(PLACES);
    let guard = 0;
    while (to.name === from.name && guard < 20) {
      to = pick(PLACES);
      guard += 1;
    }

    const straightKm = haversine(from, to);
    const tripKm = round(Math.max(1.2, straightKm * 1.35), 1);
    const tripMinutes = Math.max(4, Math.round((tripKm / 25) * 60));

    const pickupKm = round(0.5 + Math.random() * 2.5, 1);
    const pickupMinutes = Math.max(1, Math.round((pickupKm / 20) * 60));

    orders.push({
      passengerName: pick(PASSENGER_NAMES),
      passengerPhone: randomPhone(),
      passengerRating: round(4.6 + Math.random() * 0.4, 1),
      from,
      to,
      pickupKm,
      pickupMinutes,
      tripKm,
      tripMinutes,
      fare: estimateFare(tripKm),
      note: pick(NOTES),
    });
  }
  return orders;
}

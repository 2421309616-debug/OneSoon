export type PlacePoint = {
  name: string;
  address: string;
  lngLat: [number, number];
};

export type TripOrder = {
  id: string;
  passengerName: string;
  passengerPhone: string;
  from: PlacePoint;
  to: PlacePoint;
  pickupKm: number;
  pickupMinutes: number;
  tripKm: number;
  tripMinutes: number;
  fare: number;
  note: string;
  /** 乘客评分（演示数据，详情页展示用；缺省按 4.9 显示） */
  passengerRating?: number;
};

export type HistoryItem = {
  id: string;
  time: string;
  from: string;
  to: string;
  fare: number;
};

export type NoticeItem = {
  id: string;
  title: string;
  time: string;
  body: string;
  image?: string;
};

const FENGDU = {
  ghostCity: {
    name: "丰都鬼城",
    address: "重庆市丰都县名山街道名山路152号",
    lngLat: [107.722209, 29.887322] as [number, number],
  },
  station: {
    name: "丰都站",
    address: "重庆市丰都县三合街道丁庄村",
    lngLat: [107.740472, 29.865724] as [number, number],
  },
  plaza: {
    name: "丰都八一广场",
    address: "重庆市丰都县雪玉路156号",
    lngLat: [107.733221, 29.863102] as [number, number],
  },
  government: {
    name: "丰都县人民政府",
    address: "重庆市丰都县平都大道西段53号",
    lngLat: [107.731056, 29.863785] as [number, number],
  },
  hospital: {
    name: "重医附一院丰都医院",
    address: "重庆市丰都县芦塘街33号",
    lngLat: [107.741233, 29.871622] as [number, number],
  },
  busStation: {
    name: "丰都汽车客运站",
    address: "重庆市丰都县滨江西路",
    lngLat: [107.725512, 29.869103] as [number, number],
  },
  port: {
    name: "丰都港",
    address: "重庆市丰都县滨江西路31号",
    lngLat: [107.719883, 29.872401] as [number, number],
  },
  mall: {
    name: "宏声商业广场",
    address: "重庆市丰都县平都大道西段",
    lngLat: [107.734812, 29.866503] as [number, number],
  },
};

export const MOCK_ORDERS: TripOrder[] = [
  {
    id: "o-1001",
    passengerName: "李先生",
    passengerPhone: "138****8000",
    from: FENGDU.ghostCity,
    to: FENGDU.station,
    pickupKm: 1.2,
    pickupMinutes: 3,
    tripKm: 8.4,
    tripMinutes: 18,
    fare: 22,
    note: "带一个行李箱，麻烦后备箱留位置",
    passengerRating: 4.9,
  },
  {
    id: "o-1002",
    passengerName: "王女士",
    passengerPhone: "139****3900",
    from: FENGDU.plaza,
    to: FENGDU.hospital,
    pickupKm: 0.8,
    pickupMinutes: 2,
    tripKm: 3.1,
    tripMinutes: 9,
    fare: 11,
    note: "",
    passengerRating: 5.0,
  },
  {
    id: "o-1003",
    passengerName: "张同学",
    passengerPhone: "137****1122",
    from: FENGDU.government,
    to: FENGDU.busStation,
    pickupKm: 2.4,
    pickupMinutes: 6,
    tripKm: 6.7,
    tripMinutes: 15,
    fare: 18,
    note: "赶车，麻烦快一点",
    passengerRating: 4.8,
  },
  {
    id: "o-1004",
    passengerName: "陈先生",
    passengerPhone: "136****7788",
    from: FENGDU.port,
    to: FENGDU.mall,
    pickupKm: 1.9,
    pickupMinutes: 5,
    tripKm: 4.2,
    tripMinutes: 11,
    fare: 13,
    note: "",
    passengerRating: 4.7,
  },
];

export const MOCK_NOTICES: NoticeItem[] = [
  {
    id: "n-1",
    title: "订单取消",
    time: "02-14 11:25",
    body: "预约时间为1月2日 18:30，从丰都鬼城到丰都站的订单取消成功，取消原因：与乘客协商一致。",
  },
  {
    id: "n-2",
    title: "加油呀！8折加油卡…",
    time: "02-14 10:50",
    body: "欢迎来到丰都，山城路线复杂，特为你准备了上车引导，请点击查看，祝你出行顺利。",
  },
  {
    id: "n-3",
    title: "五星老司机推荐",
    time: "02-13 09:20",
    body: "保持准点到达，上车后主动确认目的地。服务稳定、沟通及时，更容易拿到五星好评。",
    image: "/static/promo/star-driver.jpg",
  },
];


let orderCursor = 0;

/** 生成一条新的模拟订单（轮流取 4 条模板，id 保证唯一） */
export function createMockOrder(): TripOrder {
  const base = MOCK_ORDERS[orderCursor % MOCK_ORDERS.length];
  orderCursor += 1;
  return {
    ...base,
    id: `${base.id}-${Date.now()}-${orderCursor}`,
  };
}

/** 兼容旧名字 */
export const nextMockOrder = createMockOrder;

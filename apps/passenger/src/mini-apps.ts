export interface MiniAppEntry {
  id: string
  name: string
  url: string
  icon: string
}

/** 外部小应用挂载表。追加一项就会出现在首页；列数由全局响应式布局控制。 */
export const miniApps: MiniAppEntry[] = [
  { id: "taxi", name: "打车", url: "", icon: "/static/icons/app-taxi.svg" },
  { id: "drive", name: "代驾", url: "", icon: "/static/icons/app-drive.svg" },
  { id: "bus", name: "公交", url: "", icon: "/static/icons/app-bus.svg" },
  { id: "offer", name: "优惠", url: "", icon: "/static/icons/app-offer.svg" },
]

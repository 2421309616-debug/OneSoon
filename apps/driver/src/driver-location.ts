import { driverApi } from "./driver-api";

/**
 * 位置上报间隔。
 *
 * 后端的位置有效期是 60 秒，10 秒上报一次留了 6 倍余量 ——
 * 偶发一两次失败（地下车库、隧道）不会让司机被判定失联。
 */
const REPORT_INTERVAL_MS = 10_000;

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * 开始上报位置。
 *
 * 出车时调用，收车时调 `stopLocationReport`。
 * 用 `gcj02` 而不是 `wgs84`：高德地图和高德路径规划都用 gcj02，
 * 混用会出现几百米的偏移，接驾时间就算错了。
 */
export function startLocationReport(driverId: string): void {
  stopLocationReport();

  const report = (): void => {
    uni.getLocation({
      type: "gcj02",
      success: ({ longitude, latitude }) => {
        void driverApi.reportDriverLocation(driverId, longitude, latitude).catch(() => {
          // 上报失败不阻塞，下一轮再试 —— 位置是「尽力而为」，不是「必须成功」
        });
      },
      fail: () => {
        // 定位失败（没授权、没信号）不弹提示：司机在开车，不该被打断
      },
    });
  };

  report();
  timer = setInterval(report, REPORT_INTERVAL_MS);
}

/** 停止上报。收车、退出登录、页面卸载时调用 */
export function stopLocationReport(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

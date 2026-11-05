<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";

onLaunch(() => {
  const route = getCurrentPages().at(-1)?.route;
  if (route === "pages/login/login") return;
  uni.reLaunch({ url: "/pages/login/login" });
});
</script>

<style>
page {
  background: #f2f2f2;
  color: #1a1a1a;
  font-family: "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 32rpx;
  line-height: 1.5;
}

::selection {
  background: #f6d0d3;
  color: #1a1a1a;
}

button {
  font-family: inherit;
}
</style>

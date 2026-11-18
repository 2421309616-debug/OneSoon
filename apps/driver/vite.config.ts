import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      // Windows 上编辑器的原子写入会先建临时目录，vite 的 watcher 抓到就 EBUSY 崩掉。
      // 这些文件不是源码，忽略掉。
      ignored: ["**/*.tmpdir/**", "**/.~*", "**/*.tmp"],
    },
  },
});

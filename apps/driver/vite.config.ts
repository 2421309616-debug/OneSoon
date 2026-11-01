import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      // Windows 上编辑器/工具原子写入产生的临时目录会让 chokidar 抛 EBUSY 直接崩掉 dev server
      ignored: ["**/*.tmpdir/**", "**/.~*", "**/*.tmp"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["dispatch/**/*.test.ts"],
    environment: "node",
    coverage: {
      include: ["dispatch/**/*.ts"],
      exclude: ["dispatch/**/*.test.ts", "dispatch/types.ts"],
    },
  },
});

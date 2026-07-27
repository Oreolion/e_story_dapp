import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./__tests__/setup.ts",
    testTimeout: 10000,
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    exclude: ["node_modules", "e2e/**/*", ".expo", "dist"],
  },
});

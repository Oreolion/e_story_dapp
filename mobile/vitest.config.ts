import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./__tests__/setup.ts",
    testTimeout: 10000,
    // VM threads avoid Vitest's 60-second worker IPC startup timeout on the
    // Windows development environment while preserving a single isolated pool.
    pool: "vmThreads",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    exclude: ["node_modules", "e2e/**/*", ".expo", "dist", "__tests__/components/**/*"],
  },
});

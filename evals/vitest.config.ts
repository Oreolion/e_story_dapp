import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Payment evaluations render the real TSX email templates, as production does.
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["evals/**/*.test.ts"],
    setupFiles: ["./evals/test-setup.ts"],
    // Lifecycle beforeAll hooks also sign synthetic JWTs. Keep this fixture in
    // the test config so clean CI never depends on a developer's environment.
    env: { WALLET_JWT_SECRET: "synthetic-evaluation-signing-key-not-valid-for-production" },
    // Isolate native/WASM database lifetimes in processes. Windows Node 24's
    // shared-isolate pool crashed in V8 JIT allocation teardown during rehearsal.
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

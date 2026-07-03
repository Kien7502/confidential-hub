import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vitest reads the `test` field off the Vite config. We type it loosely so we
// can stay on `vite`'s defineConfig (importing from `vitest/config` pulls a
// nested Vite copy that conflicts with plugin types under `tsc`).
// The design-system bundle ships a read-only copy of this source tree under
// context/local-code; exclude it so Vitest only runs the real project tests.
const test = {
  exclude: ["**/node_modules/**", "**/dist/**", "**/DESIGN.md*/**"]
};

export default defineConfig({
  define: {
    global: "globalThis"
  },
  optimizeDeps: {
    exclude: ["@zama-fhe/relayer-sdk"],
    include: ["keccak", "fetch-retry", "ethers", "wasm-feature-detect"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      }
    }
  },
  plugins: [react()],
  test
} as Parameters<typeof defineConfig>[0]);

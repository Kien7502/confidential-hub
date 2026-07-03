import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The exported design-system bundle ships a read-only copy of this source
  // tree under context/local-code. Keep Vitest from picking up those duplicate
  // *.test.ts files so the suite only runs the real project tests.
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/DESIGN.md*/**"]
  },
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
  plugins: [react()]
});

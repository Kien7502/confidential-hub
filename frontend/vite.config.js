import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
    plugins: [react()]
});

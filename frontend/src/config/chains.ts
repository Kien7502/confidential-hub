import { defineChain } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111;
export const WRAPPERS_REGISTRY_ADDRESS = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";
export const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

export const sepolia = defineChain({
  id: SEPOLIA_CHAIN_ID,
  name: "Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [PUBLIC_SEPOLIA_RPC] },
    public: { http: [PUBLIC_SEPOLIA_RPC] }
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" }
  },
  testnet: true
});

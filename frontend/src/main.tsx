import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";

const queryClient = new QueryClient();
const privyAppId = import.meta.env.VITE_PRIVY_APP_ID ?? "";

function MissingPrivyConfig() {
  return (
    <div className="config-missing">
      <section>
        <div className="brand-mark">Z</div>
        <h1>Privy app ID required</h1>
        <p>Set <code>VITE_PRIVY_APP_ID</code> in <code>frontend/.env.local</code>, then restart the dev server.</p>
      </section>
    </div>
  );
}

const app = privyAppId ? (
  <PrivyProvider
    appId={privyAppId}
    config={{
      appearance: {
        theme: "dark",
        accentColor: "#D7DF82",
        logo: "/zama-brand-icon.png",
        walletChainType: "ethereum-only"
      },
      loginMethods: ["wallet"],
      embeddedWallets: {
        ethereum: {
          createOnLogin: "off"
        }
      },
      defaultChain: {
        id: 11155111,
        name: "Sepolia",
        network: "sepolia",
        nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] } },
        blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } }
      },
      supportedChains: [
        {
          id: 11155111,
          name: "Sepolia",
          network: "sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://ethereum-sepolia-rpc.publicnode.com"] } },
          blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } }
        }
      ]
    }}
  >
    <QueryClientProvider client={queryClient}>
      <App privyConfigured />
    </QueryClientProvider>
  </PrivyProvider>
) : (
  <MissingPrivyConfig />
);

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode>{app}</React.StrictMode>);

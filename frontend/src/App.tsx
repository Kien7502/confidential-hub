import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { usePrivy, useSignTypedData, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownUp,
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Wallet,
  X
} from "lucide-react";
import { getAddress, isAddress, toHex, type Address, type Hex } from "viem";
import { erc20Abi } from "./config/abis";
import { CERC20_WRAPPER_ARTIFACT, PUBLIC_ERC20_ARTIFACT } from "./config/artifacts";
import { BLOCKSCOUT_URL, SEPOLIA_CHAIN_ID } from "./config/chains";
import { FAUCET_MAX_TOKENS } from "./config/officialPairs";
import { cacheKey, estimateWrappedAmount, formatTokenAmount, isFaucetAmountAllowed, parseTokenAmount } from "./lib/amounts";
import { buildOfficialRows, buildUserRows, pairIsActionable, uniqueShieldPairs, uniqueUnshieldPairs, type DashboardRow } from "./lib/dashboardRows";
import { loadTokenPrices, priceLookupSymbol, type TokenPriceMap } from "./lib/prices";
import { loadAddedTokens, loadPairs, publicClient, readConfidentialHandle } from "./lib/registry";
import { createZamaInstance, signUserDecryptPermit, type TypedDataSigner } from "./lib/sdk";
import type { EthereumProvider } from "./lib/sdk";
import { iconForConfidentialToken, resolveTokenIcon } from "./lib/tokenIcons";
import { approveToken, confidentialTransfer, deployContract, finalizeUnwrap, mintFaucet, readAllowance, requestUnwrap, waitForTransactionSuccess, wrapToken } from "./lib/transactions";
import {
  readActivity,
  readAddedTokens,
  readDecryptCache,
  readPendingUnwraps,
  writeActivity,
  writeAddedTokens,
  writeDecryptCache,
  writePendingUnwraps
} from "./lib/storage";
import type { ActivityItem, AddedToken, PendingUnwrap, StandaloneConfidentialToken, TokenMetadata, TokenWrapperPair } from "./types";

type Page = "dashboard" | "shield" | "unshield" | "faucet" | "send" | "activity";
type FlowIntent = { page: "shield" | "unshield"; pairId?: string; tokenAddress?: Address; nonce: number };
type FlowStepState = "waiting" | "active" | "done" | "skipped" | "error";
type ShieldStepId = "allowance" | "wrap";
type ShieldResult = {
  approvalTxHash?: Hex;
  wrapTxHash: Hex;
  inputAmount: string;
  inputSymbol: string;
  outputAmount: string;
  outputSymbol: string;
};
type WalletAssetSnapshot = {
  publicBalance?: bigint;
  confidentialHandle?: Hex;
  confidentialDisplay: string;
  confidentialValue?: bigint;
  status: "idle" | "loading" | "ready" | "error";
};
type CreateModalRequest = {
  tab: "add" | "create";
  category?: AddedToken["category"];
  createKind?: "erc20" | "wrapper";
  address?: Address;
  underlyingAddress?: Address;
};

const DEFAULT_ERC20_DECIMALS = 18;
const DEFAULT_INITIAL_MINT_AMOUNT = "1000000";

const navItems: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "faucet", label: "Faucet", icon: Banknote },
  { page: "shield", label: "Shield / Unshield", icon: Shield },
  { page: "send", label: "Send", icon: Send },
  { page: "activity", label: "Activity", icon: Activity }
];

function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function transactionUrl(txHash: Hex) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parsePrivyChainId(chainId?: string): number | undefined {
  if (!chainId) return undefined;
  if (chainId.startsWith("eip155:")) return Number(chainId.slice("eip155:".length));
  if (chainId.startsWith("0x")) return Number.parseInt(chainId, 16);
  return Number(chainId);
}

function ethereumWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
  return wallets.find((wallet) => wallet.type === "ethereum");
}

function dedupeAddedTokens(tokens: AddedToken[]): AddedToken[] {
  const seen = new Map<string, AddedToken>();
  for (const token of tokens) {
    const key = token.address.toLowerCase();
    const existing = seen.get(key);
    seen.set(
      key,
      existing
        ? {
            ...existing,
            category: token.category,
            label: token.label || existing.label,
            iconUrl: token.iconUrl || existing.iconUrl,
            createdAt: existing.createdAt
          }
        : token
    );
  }
  return Array.from(seen.values());
}

function walletErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /user rejected|user denied|rejected request|request rejected|denied transaction|cancel/i.test(message)
    ? "Transaction was cancelled."
    : message;
}

/** Blocking reason on the CTA label until the wallet is connected on Sepolia. */
function ctaLabel(ready: string, verb: string, account: unknown, isSepolia: boolean) {
  if (!account) return `Connect wallet to ${verb}`;
  if (!isSepolia) return "Switch to Sepolia";
  return ready;
}

export default function App({ privyConfigured }: { privyConfigured: boolean }) {
  const { ready: privyReady, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { signTypedData } = useSignTypedData();
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pendingUnwraps, setPendingUnwraps] = useState<PendingUnwrap[]>([]);
  const [addedTokens, setAddedTokens] = useState<AddedToken[]>([]);
  const [walletProvider, setWalletProvider] = useState<EthereumProvider>();
  const [flowIntent, setFlowIntent] = useState<FlowIntent>();
  const [toast, setToast] = useState("");
  const copyAddress = useCallback((value: string, label = "Address copied") => {
    void navigator.clipboard?.writeText(value).then(
      () => setToast(label),
      () => setToast("Copy failed")
    );
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1500);
    return () => clearTimeout(timer);
  }, [toast]);
  const activeWallet = ethereumWallet(wallets);
  const account = activeWallet?.address && isAddress(activeWallet.address) ? getAddress(activeWallet.address) : undefined;
  const chainId = parsePrivyChainId(activeWallet?.chainId);
  const isPrivyEmbeddedWallet = activeWallet?.walletClientType === "privy" || activeWallet?.walletClientType === "privy-v2";
  const signDecryptTypedData = useCallback<TypedDataSigner>(
    async (typedData) => {
      if (!account) throw new Error("Wallet account not found");
      const result = await signTypedData(typedData as never, { address: account });
      return result.signature as Hex;
    },
    [account, signTypedData]
  );
  const decryptSigner = isPrivyEmbeddedWallet ? signDecryptTypedData : undefined;

  const pairsQuery = useQuery({
    queryKey: ["pairs"],
    queryFn: () => loadPairs(),
    staleTime: 60_000
  });

  const addedTokensQuery = useQuery({
    queryKey: ["added-tokens", addedTokens.map((token) => token.address).join(",")],
    queryFn: () => loadAddedTokens(addedTokens),
    enabled: addedTokens.length > 0,
    staleTime: 60_000
  });

  const pairs = pairsQuery.data ?? [];
  const addedPairs = addedTokensQuery.data?.pairs ?? [];
  const standaloneTokens: StandaloneConfidentialToken[] = [];
  const allPairs = useMemo(() => [...pairs, ...addedPairs], [pairs, addedPairs]);
  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const actionLocked = !privyConfigured || !account || !isSepolia || !walletProvider;

  useEffect(() => {
    let cancelled = false;
    if (!activeWallet) {
      setWalletProvider(undefined);
      return;
    }
    activeWallet
      .getEthereumProvider()
      .then((provider) => {
        if (!cancelled) setWalletProvider(provider as EthereumProvider);
      })
      .catch(() => {
        if (!cancelled) setWalletProvider(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWallet?.address, activeWallet?.chainId]);

  useEffect(() => {
    setActivity(readActivity(account));
    setPendingUnwraps(readPendingUnwraps(account));
    setAddedTokens(readAddedTokens(account));
  }, [account]);

  function pushActivity(item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) {
    const next = [
      { ...item, id: nowId(item.type), createdAt: Date.now(), chainId: chainId ?? SEPOLIA_CHAIN_ID, account },
      ...activity
    ];
    setActivity(next);
    writeActivity(next, account);
  }

  function savePending(items: PendingUnwrap[]) {
    setPendingUnwraps(items);
    writePendingUnwraps(items, account);
  }

  function saveTokens(items: AddedToken[]) {
    const deduped = dedupeAddedTokens(items);
    setAddedTokens(deduped);
    writeAddedTokens(deduped, account);
  }

  function navigateFlow(intent: Omit<FlowIntent, "nonce">) {
    setFlowIntent({ ...intent, nonce: Date.now() });
    setPage(intent.page);
    setSidebarOpen(false);
  }

  function goPage(next: Page) {
    setPage(next);
    setSidebarOpen(false);
  }

  const activityShown = page === "shield" || page === "unshield" ? "shield" : page;

  return (
    <div className="app">
      <aside className={sidebarOpen ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark">
            <img src="/zama-brand-icon.png" alt="" />
          </span>
          <span className="brand-name">
            <strong>Confidential Hub</strong>
            <span>Zama · ERC-7984</span>
          </span>
        </div>
        <nav className="nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.page === activityShown;
            return (
              <button key={item.page} className={isActive ? "nav-item active" : "nav-item"} onClick={() => goPage(item.page)}>
                <Icon size={18} />
                <span>{item.label}</span>
                {item.page === "activity" && activity.length ? <span className="nav-badge">{activity.length}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {account ? (
            <WalletMenu
              account={account}
              isSepolia={isSepolia}
              onCopy={() => copyAddress(account)}
              onExplorer={() => window.open(`${BLOCKSCOUT_URL}/address/${account}`, "_blank", "noopener,noreferrer")}
              onSwitch={activeWallet && !isSepolia ? () => void activeWallet.switchChain(SEPOLIA_CHAIN_ID) : undefined}
              onDisconnect={async () => {
                // Disconnect every connected wallet first — otherwise an
                // injected/external wallet stays in useWallets() after logout
                // and the UI still reads as connected.
                await Promise.allSettled(wallets.map((wallet) => wallet.disconnect?.()));
                setWalletProvider(undefined);
                try {
                  await logout();
                } catch {
                  // logout can reject if the Privy session is already gone
                }
              }}
            />
          ) : (
            <button className="wallet-button" disabled={!privyConfigured || !privyReady || !walletsReady} onClick={() => void login()}>
              <span className="wallet-avatar" aria-hidden="true" />
              <span className="wallet-meta">
                <strong>{privyConfigured ? "Connect wallet" : "Set Privy app ID"}</strong>
                <span>Sepolia testnet</span>
              </span>
            </button>
          )}
        </div>
      </aside>
      <div className={sidebarOpen ? "scrim open" : "scrim"} onClick={() => setSidebarOpen(false)} />

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="sidebar-toggle" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1>{titleFor(page)}</h1>
              <p className="sub">{subtitleFor(page)}</p>
            </div>
          </div>
          <div className="topbar-status">
            {account ? (
              isSepolia ? <span className="pill ok dot">Sepolia</span> : <span className="pill warn dot">Wrong network</span>
            ) : (
              <span className="pill">Sepolia testnet</span>
            )}
          </div>
        </header>

        {page === "dashboard" ? (
          <Dashboard pairs={pairs} addedPairs={addedPairs} standaloneTokens={standaloneTokens} loading={pairsQuery.isLoading} account={account} provider={walletProvider} decryptSigner={decryptSigner} actionLocked={actionLocked} isSepolia={isSepolia} onNavigate={goPage} onNavigateFlow={navigateFlow} pushActivity={pushActivity} addedTokens={addedTokens} saveTokens={saveTokens} />
        ) : null}
        {page === "shield" || page === "unshield" ? (
          <UnifiedWrapPage pairs={allPairs} intent={flowIntent} account={account} provider={walletProvider} locked={actionLocked} isSepolia={isSepolia} pending={pendingUnwraps} savePending={savePending} onCreateWrapper={() => goPage("dashboard")} pushActivity={pushActivity} />
        ) : null}
        {page === "faucet" ? <FaucetPage pairs={pairs} account={account} provider={walletProvider} locked={actionLocked} isSepolia={isSepolia} pushActivity={pushActivity} /> : null}
        {page === "send" ? <SendPage pairs={allPairs} standaloneTokens={standaloneTokens} account={account} provider={walletProvider} locked={actionLocked} isSepolia={isSepolia} pushActivity={pushActivity} /> : null}
        {page === "activity" ? <ActivityPage items={activity} /> : null}
      </main>
      {toast ? <div className="toast"><Check size={15} />{toast}</div> : null}
    </div>
  );
}

function WalletMenu({
  account,
  isSepolia,
  onCopy,
  onExplorer,
  onSwitch,
  onDisconnect
}: {
  account: Address;
  isSepolia: boolean;
  onCopy: () => void;
  onExplorer: () => void;
  onSwitch?: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  function run(action: () => void) {
    action();
    setOpen(false);
  }
  return (
    <div className="wallet-box">
      {open ? <div className="wallet-menu-overlay" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div className="wallet-menu" role="menu">
          <button role="menuitem" onClick={() => run(onCopy)}><Copy size={16} />Copy address</button>
          <button role="menuitem" onClick={() => run(onExplorer)}><Eye size={16} />View on Blockscout</button>
          {onSwitch ? <button role="menuitem" onClick={() => run(onSwitch)}><RefreshCw size={16} />Switch to Sepolia</button> : null}
          <button role="menuitem" className="danger" onClick={() => run(onDisconnect)}><LogOut size={16} />Disconnect</button>
        </div>
      ) : null}
      <button
        className={isSepolia ? "wallet-button connected" : "wallet-button connected wrong"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="wallet-avatar" aria-hidden="true" />
        <span className="wallet-meta">
          <strong>{shortAddress(account)}</strong>
          <span>{isSepolia ? "Sepolia" : "Wrong network"}</span>
        </span>
        <span className="wallet-caret"><ChevronDown size={16} /></span>
      </button>
    </div>
  );
}

function titleFor(page: Page) {
  return {
    dashboard: "Dashboard",
    shield: "Shield / Unshield",
    unshield: "Shield / Unshield",
    faucet: "Faucet",
    send: "Send confidential tokens",
    activity: "Activity"
  }[page];
}

function subtitleFor(page: Page) {
  return {
    dashboard: "Your shielded and public balances on Sepolia.",
    shield: "Wrap public ERC-20 into confidential tokens and back.",
    unshield: "Wrap public ERC-20 into confidential tokens and back.",
    faucet: "Mint mock ERC-20 test tokens. Limit 1,000,000 per call.",
    send: "Transfer confidential balances privately. Amounts stay encrypted on-chain.",
    activity: "Local log · this browser only."
  }[page];
}

function Dashboard({
  pairs,
  addedPairs,
  standaloneTokens,
  loading,
  account,
  provider,
  decryptSigner,
  actionLocked,
  isSepolia,
  onNavigate,
  onNavigateFlow,
  pushActivity,
  addedTokens,
  saveTokens
}: {
  pairs: TokenWrapperPair[];
  addedPairs: TokenWrapperPair[];
  standaloneTokens: StandaloneConfidentialToken[];
  loading: boolean;
  account?: Address;
  provider?: EthereumProvider;
  decryptSigner?: TypedDataSigner;
  actionLocked: boolean;
  isSepolia: boolean;
  onNavigate: (page: Page) => void;
  onNavigateFlow: (intent: Omit<FlowIntent, "nonce">) => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  addedTokens: AddedToken[];
  saveTokens: (items: AddedToken[]) => void;
}) {
  const [createRequest, setCreateRequest] = useState<CreateModalRequest | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string>();
  const [showEmptyAssets, setShowEmptyAssets] = useState(false);
  const [assetSnapshots, setAssetSnapshots] = useState<Record<string, WalletAssetSnapshot>>({});
  const official = pairs.filter((pair) => pair.source === "official");
  const registryCustom = pairs.filter((pair) => pair.source !== "official");
  const customRows = [...buildOfficialRows(registryCustom), ...buildUserRows(addedTokens, addedPairs, standaloneTokens)];
  const officialRows = buildOfficialRows(official);
  const walletRows = [...customRows, ...officialRows].filter((row) => row.underlying || row.confidential);
  const priceSymbols = Array.from(new Set(walletRows.map((row) => priceSymbolForAsset(row)).filter(Boolean) as string[]));
  const pricesQuery = useQuery({
    queryKey: ["token-prices", priceSymbols.join(",")],
    queryFn: () => loadTokenPrices(priceSymbols),
    enabled: priceSymbols.length > 0,
    staleTime: 60_000
  });
  const prices = pricesQuery.data ?? {};
  const emptyRows = walletRows.filter((row) => assetIsEmpty(row, assetSnapshots[row.id]));
  const visibleRows = showEmptyAssets ? walletRows : walletRows.filter((row) => !assetIsEmpty(row, assetSnapshots[row.id]));
  const selectedRow = walletRows.find((row) => row.id === selectedRowId);
  const totalValue = walletRows.reduce((sum, row) => sum + assetValue(row, assetSnapshots[row.id], prices), 0);
  const shieldableValue = walletRows.reduce((sum, row) => sum + publicAssetValue(row, assetSnapshots[row.id], prices), 0);
  const displayRows = visibleRows.length > 0 ? visibleRows : walletRows.slice(0, 1);
  const shieldedCount = walletRows.filter((row) => row.confidential).length;
  function updateSnapshot(rowId: string, snapshot: WalletAssetSnapshot) {
    setAssetSnapshots((current) => {
      const previous = current[rowId];
      if (
        previous?.publicBalance === snapshot.publicBalance &&
        previous?.confidentialHandle === snapshot.confidentialHandle &&
        previous?.confidentialDisplay === snapshot.confidentialDisplay &&
        previous?.confidentialValue === snapshot.confidentialValue &&
        previous?.status === snapshot.status
      ) {
        return current;
      }
      return { ...current, [rowId]: snapshot };
    });
  }
  return (
    <div className="wallet-screen">
      <div className="balance-row">
        <div className="balance-card">
          <div>
            <span className="label">Total balance</span>
            <div className="amount">{formatFiat(totalValue)}</div>
            <p className="meta">Across <b>{walletRows.length} assets</b> · <b>{shieldedCount} shielded</b></p>
          </div>
          <span className="balance-icon"><Shield size={22} /></span>
        </div>
        <div className="shieldable-card">
          <span className="label">Available to shield</span>
          <div className="amount">{formatFiat(shieldableValue)}</div>
          <p className="meta">Public ERC-20 you can wrap into confidential tokens.</p>
          <button className="btn primary sm" style={{ width: "max-content" }} disabled={actionLocked || walletRows.length === 0} onClick={() => onNavigateFlow({ page: "shield" })}>
            {ctaLabel("Shield now", "shield", account, isSepolia)}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
          <h2>Assets</h2>
          <span className="hint">Prices via CoinGecko</span>
        </div>
        <div className="asset-table">
          <div className="asset-head">
            <span>Asset</span><span>Price</span><span>Balance</span><span>Value</span><span />
          </div>
          {displayRows.map((row) => (
            <WalletAssetRow
              key={row.id}
              row={row}
              account={account}
              provider={provider}
              decryptSigner={decryptSigner}
              actionLocked={actionLocked}
              prices={prices}
              pushActivity={pushActivity}
              onSnapshot={(snapshot) => updateSnapshot(row.id, snapshot)}
              onOpen={() => setSelectedRowId(row.id)}
            />
          ))}
        </div>
        <div className="wallet-actions">
          <button className="link-btn dashed" onClick={() => setCreateRequest({ tab: "add" })}>
            <Plus size={15} />
            Add token
          </button>
          <button className="link-btn" onClick={() => setShowEmptyAssets((value) => !value)}>
            {showEmptyAssets ? "Hide empty assets" : `Show empty assets (${emptyRows.length})`}
          </button>
        </div>
        {loading || pricesQuery.isLoading ? <p className="hint" style={{ marginTop: 12 }}>{loading ? "Loading registry assets..." : "Loading token prices..."}</p> : null}
      </div>
      {selectedRow ? (
        <AssetDetailModal
          row={selectedRow}
          snapshot={assetSnapshots[selectedRow.id]}
          prices={prices}
          actionLocked={actionLocked}
          isSepolia={isSepolia}
          account={account}
          provider={provider}
          decryptSigner={decryptSigner}
          pushActivity={pushActivity}
          onClose={() => setSelectedRowId(undefined)}
          onNavigateFlow={(intent) => {
            setSelectedRowId(undefined);
            onNavigateFlow(intent);
          }}
          onSend={() => {
            setSelectedRowId(undefined);
            onNavigate("send");
          }}
        />
      ) : null}
      {createRequest ? (
        <CreateTokenModal request={createRequest} addedTokens={addedTokens} saveTokens={saveTokens} account={account} provider={provider} actionLocked={actionLocked} isSepolia={isSepolia} pairs={[...pairs, ...addedPairs]} pushActivity={pushActivity} onClose={() => setCreateRequest(null)} />
      ) : null}
    </div>
  );
}

function WalletAssetRow({
  row,
  account,
  provider,
  decryptSigner,
  actionLocked,
  prices,
  pushActivity,
  onSnapshot,
  onOpen
}: {
  row: DashboardRow;
  account?: Address;
  provider?: EthereumProvider;
  decryptSigner?: TypedDataSigner;
  actionLocked: boolean;
  prices: TokenPriceMap;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  onSnapshot: (snapshot: WalletAssetSnapshot) => void;
  onOpen: () => void;
}) {
  const [publicBalance, setPublicBalance] = useState<bigint>();
  const [handle, setHandle] = useState<Hex>();
  const [balanceStatus, setBalanceStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [decryptPhase, setDecryptPhase] = useState<"idle" | "signing" | "decrypting">("idle");
  const [decryptError, setDecryptError] = useState("");
  const [decryptCacheVersion, setDecryptCacheVersion] = useState(0);
  const pair = row.pair;
  const token = row.underlying ?? row.confidential;
  const confidential = row.confidential;
  const cache = useMemo(() => readDecryptCache(), [decryptCacheVersion]);
  const decryptCacheKey = account && handle && confidential ? cacheKey(SEPOLIA_CHAIN_ID, account, confidential.address, handle) : undefined;
  const cached = decryptCacheKey ? cache[decryptCacheKey] : undefined;
  const cachedConfidentialValue = cached?.value && cached.value !== "permit-required" ? parseCachedBigInt(cached.value) : undefined;
  const confidentialDisplay = getConfidentialBalanceLabel({
    handle,
    cachedValue: cached?.value,
    decimals: confidential?.decimals ?? 6,
    symbol: confidential?.symbol ?? "",
    status: balanceStatus,
    error: decryptError
  });
  const formattedPublicBalance = row.underlying ? `${formatTokenAmount(publicBalance, row.underlying.decimals)} ${row.underlying.symbol}` : "-";
  const price = priceForAsset(row, prices);
  const value = assetValue(row, {
    publicBalance,
    confidentialHandle: handle,
    confidentialDisplay,
    confidentialValue: cachedConfidentialValue,
    status: balanceStatus
  }, prices);

  async function refreshBalances() {
    if (!account) return;
    setBalanceStatus("loading");
    setDecryptError("");
    try {
      const [publicValue, confidentialHandle] = await Promise.all([
        row.underlying ? publicClient.readContract({ address: row.underlying.address, abi: erc20Abi, functionName: "balanceOf", args: [account] }).catch(() => undefined) : Promise.resolve(undefined),
        confidential ? readConfidentialHandle(publicClient, confidential.address, account).catch(() => undefined) : Promise.resolve(undefined)
      ]);
      setPublicBalance(publicValue);
      setHandle(confidentialHandle as Hex | undefined);
      setBalanceStatus("ready");
    } catch (error) {
      setBalanceStatus("error");
      setDecryptError(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    void refreshBalances();
  }, [account, row.id]);

  useEffect(() => {
    onSnapshot({
      publicBalance,
      confidentialHandle: handle,
      confidentialDisplay,
      confidentialValue: cachedConfidentialValue,
      status: balanceStatus
    });
  }, [publicBalance, handle, confidentialDisplay, cachedConfidentialValue, balanceStatus]);

  async function decryptBalance(event: React.MouseEvent) {
    event.stopPropagation();
    if (!account) {
      setDecryptError("Connect a wallet before decrypting.");
      return;
    }
    if (!provider) {
      setDecryptError("Wallet provider is not ready yet.");
      return;
    }
    if (!handle) {
      setDecryptError("Balance handle has not loaded yet.");
      return;
    }
    if (isZeroConfidentialHandle(handle)) {
      setDecryptError("No encrypted balance to decrypt.");
      return;
    }
    if (!confidential) return;
    setDecryptPhase("signing");
    setDecryptError("");
    try {
      const value = await runUserDecrypt(provider, confidential.address, account, handle, decryptSigner, (phase) => setDecryptPhase(phase));
      const next = readDecryptCache();
      next[cacheKey(SEPOLIA_CHAIN_ID, account, confidential.address, handle)] = { value, lastDecryptedAt: Date.now() };
      writeDecryptCache(next);
      setDecryptCacheVersion((version) => version + 1);
      pushActivity({ type: "decrypt", status: "success", title: `Decrypted ${confidential.symbol} balance`, detail: `${formatTokenAmount(BigInt(value), confidential.decimals)} ${confidential.symbol}` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setDecryptError(detail);
      pushActivity({ type: "decrypt", status: "failed", title: `Decrypt ${confidential.symbol} failed`, detail });
    } finally {
      setDecryptPhase("idle");
    }
  }

  return (
    <button type="button" className="asset-row" onClick={onOpen}>
      <span className="asset-token">
        {token ? <TokenAvatar token={token} confidential={!row.underlying} underlying={row.underlying} /> : null}
        <span className="name">
          <strong>{assetSymbol(row)}</strong>
          <small>{assetName(row)}</small>
        </span>
      </span>
      <span className="asset-price">{formatFiat(price)}</span>
      <span className="asset-balances">
        <span className="std">{formattedPublicBalance}</span>
        {confidential ? (
          <span className="conf">
            <Lock size={11} />
            {confidentialDisplay === "encrypted" ? <span className="encrypted-mask">****</span> : confidentialDisplay}
            {handle && !isZeroConfidentialHandle(handle) && confidentialDisplay === "encrypted" ? (
              <span
                role="button"
                tabIndex={0}
                className="decrypt-chip"
                aria-disabled={actionLocked || decryptPhase !== "idle"}
                onClick={(event) => {
                  if (actionLocked || decryptPhase !== "idle") return;
                  void decryptBalance(event);
                }}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && !actionLocked && decryptPhase === "idle") {
                    event.preventDefault();
                    void decryptBalance(event as unknown as React.MouseEvent);
                  }
                }}
              >
                <Eye size={12} />
                {decryptPhase === "signing" ? "Signing" : decryptPhase === "decrypting" ? "Decrypting" : "Decrypt"}
              </span>
            ) : null}
          </span>
        ) : null}
        {decryptError ? <span className="decrypt-error">{decryptError}</span> : null}
      </span>
      <span className="asset-value">{formatFiat(value)}</span>
      <ChevronRight size={16} className="asset-arrow" />
    </button>
  );
}

function AssetDetailModal({
  row,
  snapshot,
  prices,
  actionLocked,
  isSepolia,
  account,
  provider,
  decryptSigner,
  pushActivity,
  onClose,
  onNavigateFlow,
  onSend
}: {
  row: DashboardRow;
  snapshot?: WalletAssetSnapshot;
  prices: TokenPriceMap;
  actionLocked: boolean;
  isSepolia: boolean;
  account?: Address;
  provider?: EthereumProvider;
  decryptSigner?: TypedDataSigner;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  onClose: () => void;
  onNavigateFlow: (intent: Omit<FlowIntent, "nonce">) => void;
  onSend: () => void;
}) {
  const token = row.underlying ?? row.confidential;
  const publicBalance = row.underlying ? `${formatTokenAmount(snapshot?.publicBalance, row.underlying.decimals)} ${row.underlying.symbol}` : "-";
  const confidentialBalance = row.confidential ? snapshot?.confidentialDisplay ?? "encrypted" : "-";
  const totalValue = assetValue(row, snapshot, prices);
  const handle = snapshot?.confidentialHandle;
  const isEncrypted = Boolean(row.confidential && confidentialBalance === "encrypted" && handle && !isZeroConfidentialHandle(handle));
  const [decryptPhase, setDecryptPhase] = useState<"idle" | "signing" | "decrypting">("idle");
  const [decryptError, setDecryptError] = useState("");

  async function decryptBalance() {
    const confidential = row.confidential;
    if (!confidential || !handle) return;
    if (!account) {
      setDecryptError("Connect a wallet before decrypting.");
      return;
    }
    if (!provider) {
      setDecryptError("Wallet provider is not ready yet.");
      return;
    }
    setDecryptPhase("signing");
    setDecryptError("");
    try {
      const value = await runUserDecrypt(provider, confidential.address, account, handle, decryptSigner, (phase) => setDecryptPhase(phase));
      const next = readDecryptCache();
      next[cacheKey(SEPOLIA_CHAIN_ID, account, confidential.address, handle)] = { value, lastDecryptedAt: Date.now() };
      writeDecryptCache(next);
      pushActivity({ type: "decrypt", status: "success", title: `Decrypted ${confidential.symbol} balance`, detail: `${formatTokenAmount(BigInt(value), confidential.decimals)} ${confidential.symbol}` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setDecryptError(detail);
      pushActivity({ type: "decrypt", status: "failed", title: `Decrypt ${confidential.symbol} failed`, detail });
    } finally {
      setDecryptPhase("idle");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="asset-hero">
          {token ? <TokenAvatar token={token} size="lg" confidential={!row.underlying} underlying={row.underlying} /> : null}
          <strong>{assetName(row)}</strong>
          <span>{assetSymbol(row)}</span>
        </div>
        <div className="asset-summary">
          <div>
            <span className="lbl">Price</span>
            <strong>{formatFiat(priceForAsset(row, prices))}</strong>
            <small>Live USD price</small>
          </div>
          <div>
            <span className="lbl">Total balance</span>
            <strong>{formatFiat(totalValue)}</strong>
            <small>{tokenAmountLabel(row, snapshot)}</small>
          </div>
        </div>
        {isEncrypted ? (
          <div className="modal-encrypted">
            <div className="encrypted-notice">
              <div className="head">
                <Lock size={16} />
                <strong>Encrypted amount</strong>
              </div>
              <p>This amount is encrypted onchain. Decrypt it to see the value — your wallet will be asked to sign a request.</p>
              <button className="btn primary block" disabled={actionLocked || decryptPhase !== "idle"} onClick={() => void decryptBalance()}>
                <Eye size={16} />
                {decryptPhase === "signing" ? "Signing…" : decryptPhase === "decrypting" ? "Decrypting…" : ctaLabel("Decrypt", "decrypt", account, isSepolia)}
              </button>
              {decryptError ? <p className="warning">{decryptError}</p> : null}
            </div>
          </div>
        ) : null}
        <div className="balance-cards">
          {row.confidential ? (
            <div className="balance-detail">
              <div className="left">
                <span className="lbl"><Lock size={12} />Confidential · {row.confidential.symbol}</span>
                <span className={confidentialBalance === "encrypted" ? "val masked" : "val"}>{confidentialBalance === "encrypted" ? "****" : confidentialBalance}</span>
                <span className="lbl">{formatFiat(confidentialAssetValue(row, snapshot, prices))}</span>
              </div>
              <div className="right">
                <button className="btn sm" disabled={actionLocked || !row.canUnshield || !row.pair} onClick={() => row.pair && onNavigateFlow({ page: "unshield", pairId: row.pair.id, tokenAddress: row.confidential?.address })}>Unshield</button>
              </div>
            </div>
          ) : null}
          {row.underlying ? (
            <div className="balance-detail">
              <div className="left">
                <span className="lbl">Standard · {row.underlying.symbol}</span>
                <span className="val">{publicBalance}</span>
                <span className="lbl">{formatFiat(publicAssetValue(row, snapshot, prices))}</span>
              </div>
              <div className="right">
                <button className="btn primary sm" disabled={actionLocked || !row.canShield || !row.pair} onClick={() => row.pair && onNavigateFlow({ page: "shield", pairId: row.pair.id, tokenAddress: row.underlying?.address })}>Shield</button>
              </div>
            </div>
          ) : null}
        </div>
        <button className="btn ghost block modal-send" onClick={onSend}>
          <Send size={16} />
          Send
        </button>
      </div>
    </div>
  );
}

function parseCachedBigInt(value: string) {
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function priceSymbolForAsset(row: DashboardRow) {
  return priceLookupSymbol(row.underlying?.symbol) ?? priceLookupSymbol(row.confidential?.symbol);
}

function priceForAsset(row: DashboardRow, prices: TokenPriceMap) {
  const symbol = priceSymbolForAsset(row);
  return symbol ? prices[symbol] : undefined;
}

function unitsToNumber(value: bigint | undefined, decimals: number) {
  if (value === undefined) return 0;
  return Number(formatTokenAmount(value, decimals, 8));
}

function publicAssetValue(row: DashboardRow, snapshot: WalletAssetSnapshot | undefined, prices: TokenPriceMap) {
  if (!row.underlying) return 0;
  const price = priceForAsset(row, prices);
  return price ? unitsToNumber(snapshot?.publicBalance, row.underlying.decimals) * price : 0;
}

function confidentialAssetValue(row: DashboardRow, snapshot: WalletAssetSnapshot | undefined, prices: TokenPriceMap) {
  if (!row.confidential) return 0;
  const price = priceForAsset(row, prices);
  return price ? unitsToNumber(snapshot?.confidentialValue, row.confidential.decimals) * price : 0;
}

function assetValue(row: DashboardRow, snapshot: WalletAssetSnapshot | undefined, prices: TokenPriceMap) {
  return publicAssetValue(row, snapshot, prices) + confidentialAssetValue(row, snapshot, prices);
}

function assetIsEmpty(row: DashboardRow, snapshot?: WalletAssetSnapshot) {
  if (!snapshot || snapshot.status !== "ready") return false;
  if (row.underlying && snapshot.publicBalance === undefined) return false;
  if (row.confidential && snapshot.confidentialHandle === undefined) return false;

  const hasPublicBalance = Boolean(snapshot.publicBalance && snapshot.publicBalance > 0n);
  const hasConfidentialBalance =
    Boolean(snapshot.confidentialValue && snapshot.confidentialValue > 0n) ||
    Boolean(snapshot.confidentialHandle && !isZeroConfidentialHandle(snapshot.confidentialHandle));

  return !hasPublicBalance && !hasConfidentialBalance;
}

function formatFiat(value: number | undefined) {
  if (value === undefined) return "-";
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  if (value < 0.01) return "< $0.01";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: value < 10 ? 3 : 2, maximumFractionDigits: value < 10 ? 3 : 2 })}`;
}

function assetSymbol(row: DashboardRow) {
  return row.underlying?.symbol ?? row.confidential?.symbol ?? "Token";
}

function assetName(row: DashboardRow) {
  return row.underlying?.name ?? row.confidential?.name ?? "Token";
}

function tokenAmountLabel(row: DashboardRow, snapshot?: WalletAssetSnapshot) {
  const parts = [];
  if (row.underlying) parts.push(`${formatTokenAmount(snapshot?.publicBalance, row.underlying.decimals)} ${row.underlying.symbol}`);
  if (row.confidential && snapshot?.confidentialValue !== undefined) parts.push(`${formatTokenAmount(snapshot.confidentialValue, row.confidential.decimals)} ${row.confidential.symbol}`);
  return parts.join(" + ") || "-";
}

function getConfidentialBalanceLabel({
  handle,
  cachedValue,
  decimals,
  symbol,
  status,
  error
}: {
  handle?: Hex;
  cachedValue?: string;
  decimals: number;
  symbol: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
}) {
  if (status === "loading") return "loading";
  if (status === "error") return error ? "handle error" : "error";
  if (!handle) return "encrypted";
  if (isZeroConfidentialHandle(handle)) return `0 ${symbol}`;
  if (cachedValue && cachedValue !== "permit-required") {
    try {
      return `${formatTokenAmount(BigInt(cachedValue), decimals)} ${symbol}`;
    } catch {
      return cachedValue;
    }
  }
  return "encrypted";
}

function isZeroConfidentialHandle(handle?: Hex) {
  return Boolean(handle && /^0x0{64}$/i.test(handle));
}

function confidentialBalancePreview(handle: Hex | undefined, symbol: string) {
  return isZeroConfidentialHandle(handle) ? `0 ${symbol}` : "****";
}

/** Shield-badge fill per token. Falls back to Zama yellow when the token's
 *  colour can't be resolved. Keyed by upper-cased symbol without the c-prefix. */
const SHIELD_FILL: Record<string, string> = {
  ZAMA: "#FFD208",
  USDC: "#2775CA",
  USDT: "#50AF95",
  TGBP: "#499BE5",
  XAUT: "#F5E7BF",
  BRON: "#4A1FA9",
  WETH: "#FF0079",
  STEAKCUSDC: "#086552",
  BBQTGBP: "#086552"
};

function shieldFillFor(symbol: string) {
  const key = symbol.replace(/mock$/i, "").replace(/^c/, "").toUpperCase();
  return SHIELD_FILL[key] ?? "#FFD208";
}

function TokenAvatar({ token, confidential, underlying, size }: { token: TokenMetadata; confidential?: boolean; underlying?: TokenMetadata; size?: "sm" | "lg" }) {
  const icon = confidential ? iconForConfidentialToken(token, underlying) : resolveTokenIcon(token);
  const label = confidential ? `c${token.symbol.slice(0, 1).toUpperCase()}` : token.symbol.slice(0, 1).toUpperCase();
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [icon.url]);
  const className = ["token-avatar", size ? size : "", confidential ? "confidential-avatar" : ""].filter(Boolean).join(" ");
  const shieldFill = confidential ? shieldFillFor((underlying ?? token).symbol) : undefined;
  return (
    <span className={className}>
      {icon.url && !broken ? <img src={icon.url} alt="" onError={() => setBroken(true)} /> : label}
      {confidential ? (
        <span className="token-shield" aria-hidden="true" style={{ ["--token-shield-fill" as string]: shieldFill }}>
          <TokenShieldIcon />
        </span>
      ) : null}
    </span>
  );
}

function TokenShieldIcon() {
  return (
    <svg
      viewBox="0 0 24.3965 29.9991"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="token-shield-svg"
      aria-hidden="true"
    >
      <path
        d="M23.3962 16.398C23.3962 23.3969 18.4971 26.8963 12.674 28.926C12.3691 29.0293 12.0379 29.0243 11.7362 28.912C5.89918 26.8963 1 23.3969 1 16.398V6.59969C1 6.22845 1.14748 5.87242 1.40998 5.60991C1.67249 5.3474 2.02852 5.19993 2.39976 5.19993C5.19929 5.19993 8.69871 3.52021 11.1343 1.39256C11.4308 1.1392 11.8081 1 12.1981 1C12.5882 1 12.9654 1.1392 13.2619 1.39256C15.7115 3.5342 19.1969 5.19993 21.9965 5.19993C22.3677 5.19993 22.7237 5.3474 22.9863 5.60991C23.2488 5.87242 23.3962 6.22845 23.3962 6.59969V16.398Z"
        fill="var(--token-shield-fill, currentColor)"
      />
      <path
        d="M22.3965 6.59961C22.3965 6.49374 22.3541 6.39231 22.2793 6.31738C22.2043 6.24241 22.1021 6.2002 21.9961 6.2002C18.8771 6.20005 15.172 4.38716 12.6123 2.15234C12.4969 2.05387 12.35 2.00003 12.1982 2C12.0464 2 11.8997 2.05466 11.7842 2.15332L11.7832 2.15234C9.23832 4.37234 5.51912 6.2002 2.39941 6.2002C2.29352 6.20029 2.19208 6.24249 2.11719 6.31738C2.04232 6.39232 2.00002 6.49368 2 6.59961V16.3984C2.00009 19.6336 3.12049 22.0083 4.89453 23.8252C6.58336 25.5548 8.90443 26.8174 11.5332 27.7783L12.0625 27.9668L12.085 27.9746C12.1704 28.0064 12.2641 28.0073 12.3506 27.9785C15.1881 26.9888 17.704 25.6728 19.5029 23.8271C21.2757 22.0082 22.3964 19.6334 22.3965 16.3984V6.59961ZM17.1035 10.8926C17.5 10.5081 18.1331 10.5176 18.5176 10.9141C18.9019 11.3106 18.8915 11.9437 18.4951 12.3281L11.2012 19.4014C10.8133 19.7775 10.1965 19.7775 9.80859 19.4014L6.49316 16.1865C6.09668 15.8021 6.08721 15.1689 6.47168 14.7725C6.85614 14.376 7.48927 14.3656 7.88574 14.75L10.5049 17.29L17.1035 10.8926ZM24.3965 16.3984C24.3964 20.1618 23.0668 23.036 20.9346 25.2236C18.8295 27.3833 15.9858 28.8304 13.0029 29.8701L12.9951 29.873C12.4799 30.0476 11.9214 30.0401 11.4102 29.8555V29.8574C8.41944 28.8247 5.57133 27.3809 3.46387 25.2227C1.32923 23.0364 9.13742e-05 20.1617 0 16.3984V6.59961C2.17195e-05 5.96318 0.253102 5.35237 0.703125 4.90234C1.15305 4.45261 1.76325 4.20029 2.39941 4.2002C4.87533 4.2002 8.15048 2.67163 10.4766 0.639648L10.4844 0.631836C10.962 0.22378 11.57 0 12.1982 0C12.7479 2.58125e-05 13.2817 0.171938 13.7266 0.488281L13.9111 0.631836L13.9199 0.639648C16.2589 2.68459 19.5195 4.20004 21.9961 4.2002C22.6324 4.2002 23.2433 4.45244 23.6934 4.90234C24.1434 5.35237 24.3965 5.96318 24.3965 6.59961V16.3984Z"
        fill="white"
      />
    </svg>
  );
}

function CreateTokenModal({
  addedTokens,
  saveTokens,
  account,
  provider,
  actionLocked,
  isSepolia,
  pairs,
  pushActivity,
  onClose,
  request
}: {
  addedTokens: AddedToken[];
  saveTokens: (items: AddedToken[]) => void;
  account?: Address;
  provider?: EthereumProvider;
  actionLocked: boolean;
  isSepolia: boolean;
  pairs: TokenWrapperPair[];
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  onClose: () => void;
  request: CreateModalRequest;
}) {
  const [tab, setTab] = useState<"add" | "create">(request.tab);
  const initialCategory: AddedToken["category"] = request.category === "ctoken" ? "verified-ctoken" : request.category ?? "erc20";
  const [category, setCategory] = useState<AddedToken["category"]>(initialCategory);
  const [address, setAddress] = useState(request.address ?? "");

  // Create-tab form state
  type CreateKind = NonNullable<CreateModalRequest["createKind"]>;
  const [createKind, setCreateKind] = useState<CreateKind>(request.createKind ?? "erc20");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tokenURI, setTokenURI] = useState("");
  const [underlying, setUnderlying] = useState(request.underlyingAddress ?? "");
  const [mintAmount, setMintAmount] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployPhase, setDeployPhase] = useState<"idle" | "deploying">("idle");
  const [deployError, setDeployError] = useState("");

  function addToken() {
    if (!isAddress(address)) return;
    const normalizedAddress = getAddress(address);
    const existing = addedTokens.find((token) => token.address.toLowerCase() === normalizedAddress.toLowerCase());
    const token: AddedToken = {
      id: existing?.id ?? nowId("token"),
      category,
      address: normalizedAddress,
      label: existing?.label,
      iconUrl: existing?.iconUrl,
      createdAt: existing?.createdAt ?? Date.now()
    };
    saveTokens([token, ...addedTokens.filter((item) => item.address.toLowerCase() !== normalizedAddress.toLowerCase())]);
    pushActivity({ type: "add-token", status: "info", title: existing ? `Updated ${category}` : `Added ${category}`, detail: shortAddress(normalizedAddress) });
    onClose();
  }

  const effectiveMintAmount = mintAmount.trim() || DEFAULT_INITIAL_MINT_AMOUNT;
  const mintValid = Number(effectiveMintAmount) > 0;
  const selectedUnderlying = pairs.find((pair) => pair.underlying.address.toLowerCase() === underlying.toLowerCase())?.underlying;
  const [autoWrapperName, setAutoWrapperName] = useState("");
  const [autoWrapperSymbol, setAutoWrapperSymbol] = useState("");

  useEffect(() => {
    setDeployError("");
    setDeployPhase("idle");
  }, [tab, createKind]);

  useEffect(() => {
    if (createKind !== "wrapper" || !selectedUnderlying) return;
    const nextName = `c${selectedUnderlying.name}`;
    const nextSymbol = `c${selectedUnderlying.symbol}`;
    setName((current) => (current.trim() === "" || current === autoWrapperName ? nextName : current));
    setSymbol((current) => (current.trim() === "" || current === autoWrapperSymbol ? nextSymbol : current));
    setAutoWrapperName(nextName);
    setAutoWrapperSymbol(nextSymbol);
  }, [autoWrapperName, autoWrapperSymbol, createKind, selectedUnderlying]);
  const createReady =
    !actionLocked &&
    Boolean(provider && account) &&
    name.trim().length > 0 &&
    symbol.trim().length > 0 &&
    mintValid &&
    (createKind !== "wrapper" || isAddress(underlying));

  async function createToken() {
    if (!provider || !account || !createReady) return;
    setDeploying(true);
    setDeployPhase("deploying");
    setDeployError("");
    try {
      let deployed: { txHash: Hex; address: Address };
      if (createKind === "erc20") {
        // Initial supply is minted inside the constructor: a single deploy tx.
        const initialSupply = parseTokenAmount(effectiveMintAmount, DEFAULT_ERC20_DECIMALS);
        deployed = await deployContract(provider, account, PUBLIC_ERC20_ARTIFACT, [name, symbol, DEFAULT_ERC20_DECIMALS, initialSupply]);
      } else {
        deployed = await deployContract(provider, account, CERC20_WRAPPER_ARTIFACT, [getAddress(underlying), name, symbol, tokenURI]);
      }
      const category: AddedToken["category"] = createKind === "erc20" ? "erc20" : "verified-ctoken";
      const token: AddedToken = { id: nowId("token"), category, address: deployed.address, label: name, createdAt: Date.now() };
      saveTokens([token, ...addedTokens.filter((item) => item.address.toLowerCase() !== deployed.address.toLowerCase())]);
      pushActivity({ type: "add-token", status: "success", title: `Deployed ${symbol}`, detail: shortAddress(deployed.address), txHash: deployed.txHash });
      onClose();
    } catch (error) {
      setDeployError(walletErrorMessage(error));
    } finally {
      setDeploying(false);
      setDeployPhase("idle");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sm" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="form-head" style={{ border: "none", padding: 0, marginBottom: 4 }}>
          <h2>{tab === "add" ? "Add token" : "Create token"}</h2>
          <p>Register an existing pair, or deploy new ERC-20 / ERC-7984 wrappers.</p>
        </div>
        <div className="tabs">
          <button className={tab === "add" ? "active" : ""} onClick={() => setTab("add")}>Add existing</button>
          <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Create new</button>
        </div>
        {tab === "add" ? (
          <div className="form-card" style={{ border: "none", background: "none", padding: 0, gap: 14 }}>
            <div className="field">
              <label>Token type</label>
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value as AddedToken["category"])}>
                <option value="erc20">ERC20</option>
                <option value="verified-ctoken">ERC7984 / cToken wrapper</option>
              </select>
            </div>
            <div className="field">
              <label>Contract address</label>
              <input className="input mono" value={address} onChange={(event) => setAddress(event.target.value)} placeholder={category === "erc20" ? "0x ERC20 address" : "0x ERC7984 wrapper address"} spellCheck={false} />
              <span className="help">{request.underlyingAddress && category === "verified-ctoken" ? `Add the ERC7984 wrapper for ${shortAddress(request.underlyingAddress)}.` : "Token type is detected automatically from the contract on-chain."}</span>
            </div>
            <button className="btn primary block" disabled={!isAddress(address)} onClick={addToken}>
              <Plus size={16} />
              Add token
            </button>
            {addedTokens.length ? (
              <div className="token-chips">
                {addedTokens.map((token) => (
                  <span key={token.id}>{token.label || shortAddress(token.address)} · {token.category}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="form-card" style={{ border: "none", background: "none", padding: 0, gap: 14 }}>
            <div className="field">
              <label>Token kind</label>
              <select className="input" value={createKind} onChange={(event) => setCreateKind(event.target.value as CreateKind)}>
                <option value="erc20">ERC20 (public underlying)</option>
                <option value="wrapper">Confidential token (ERC7984 wrapper)</option>
              </select>
            </div>
            <div className="field">
              <label>{createKind === "wrapper" ? "Confidential token name" : "Token name"}</label>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder={createKind === "wrapper" ? "Confidential token name" : "Token name"} />
            </div>
            <div className="field">
              <label>Symbol</label>
              <input className="input" value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder={createKind === "wrapper" ? "Confidential symbol" : "Symbol"} />
            </div>
            {createKind === "wrapper" ? (
              <>
                <div className="field">
                  <label>Underlying ERC20</label>
                  <select className="input" value={underlying} onChange={(event) => setUnderlying(event.target.value)}>
                    <option value="">Select underlying ERC20…</option>
                    {pairs.map((pair) => (
                      <option key={pair.id} value={pair.underlying.address}>
                        {pair.underlying.symbol} · {shortAddress(pair.underlying.address)}
                      </option>
                    ))}
                  </select>
                  <input className="input mono" value={underlying} onChange={(event) => setUnderlying(event.target.value)} placeholder="or paste 0x ERC20 address" spellCheck={false} />
                </div>
                <div className="field">
                  <label>Token URI (optional)</label>
                  <input className="input" value={tokenURI} onChange={(event) => setTokenURI(event.target.value)} placeholder="Token URI (optional)" />
                </div>
                <p className="help">Deploys a real wrapper to Sepolia. Name and symbol are prefilled as c + the selected ERC20.</p>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Initial mint amount</label>
                  <input className="input mono" value={mintAmount} onChange={(event) => setMintAmount(event.target.value)} inputMode="decimal" placeholder={DEFAULT_INITIAL_MINT_AMOUNT} />
                  <span className="help">Decimals are fixed at {DEFAULT_ERC20_DECIMALS}. Deploys a real ERC20 to Sepolia, then mints the initial amount to you.</span>
                </div>
              </>
            )}
            {deployError ? <p className="warning">{deployError}</p> : null}
            <button className="btn primary block" disabled={!createReady || deploying} onClick={() => void createToken()}>
              <Plus size={16} />
              {deployPhase === "deploying" ? "Deploying…" : ctaLabel("Deploy token", "deploy", account, isSepolia)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type TokenDropdownOption = {
  value: string;
  token: TokenMetadata;
  confidential?: boolean;
  underlying?: TokenMetadata;
  balance?: string;
  encrypted?: boolean;
};

function TokenDropdown({
  options,
  value,
  setValue,
  placeholder,
  fullWidth
}: {
  options: TokenDropdownOption[];
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="token-dropdown" style={fullWidth ? { width: "100%" } : undefined} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="token-trigger"
        style={fullWidth ? { width: "100%" } : undefined}
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          <>
            <TokenAvatar token={selected.token} confidential={selected.confidential} underlying={selected.underlying} />
            <span>{selected.token.symbol}</span>
          </>
        ) : (
          <span>{placeholder ?? "Select token"}</span>
        )}
        <ChevronDown size={16} className="caret" />
      </button>
      {open && options.length > 0 ? (
        <div className="token-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === selected?.value}
              className={option.value === selected?.value ? "token-option active" : "token-option"}
              onClick={() => {
                setValue(option.value);
                setOpen(false);
              }}
            >
              <TokenAvatar token={option.token} confidential={option.confidential} underlying={option.underlying} />
              <span className="opt-meta">
                <span>{option.token.symbol}</span>
                <small>{option.token.name}</small>
              </span>
              {option.balance != null ? <span className="opt-bal">{option.encrypted ? "****" : option.balance}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FlowPairSelect({ pairs, value, setValue, side }: { pairs: TokenWrapperPair[]; value: string; setValue: (value: string) => void; side: "underlying" | "confidential" }) {
  const options: TokenDropdownOption[] = pairs.map((pair) => ({
    value: pair.id,
    token: side === "underlying" ? pair.underlying : pair.confidential,
    confidential: side === "confidential",
    underlying: pair.underlying
  }));
  return <TokenDropdown options={options} value={value} setValue={setValue} />;
}

function findFlowPairId(pairs: TokenWrapperPair[], intent: FlowIntent | undefined, side: "underlying" | "confidential") {
  if (!intent) return "";
  const intended = pairs.find((item) => {
    if (intent.pairId && item.id === intent.pairId) return true;
    if (!intent.tokenAddress) return false;
    const token = side === "underlying" ? item.underlying : item.confidential;
    return token.address.toLowerCase() === intent.tokenAddress.toLowerCase();
  });
  return intended?.id ?? "";
}

function UnifiedWrapPage({
  pairs,
  intent,
  account,
  provider,
  locked,
  isSepolia,
  pending,
  savePending,
  onCreateWrapper,
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  intent?: FlowIntent;
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
  isSepolia: boolean;
  pending: PendingUnwrap[];
  savePending: (items: PendingUnwrap[]) => void;
  onCreateWrapper: () => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
}) {
  const [mode, setMode] = useState<"shield" | "unshield">(intent?.page ?? "shield");
  const [pairId, setPairId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [publicBalance, setPublicBalance] = useState<bigint>();
  const [confidentialHandle, setConfidentialHandle] = useState<Hex>();
  const [phase, setPhase] = useState<"idle" | "checking" | "approving" | "wrapping" | "requesting">("idle");
  const [shieldResult, setShieldResult] = useState<ShieldResult>();
  const [approvalTxHash, setApprovalTxHash] = useState<Hex>();
  const [shieldFailedStep, setShieldFailedStep] = useState<ShieldStepId>();

  const shieldOptions = uniqueShieldPairs(pairs);
  const unshieldOptions = uniqueUnshieldPairs(pairs);
  const options = mode === "shield" ? shieldOptions : unshieldOptions;
  const requestedPairId = findFlowPairId(options, intent, mode === "shield" ? "underlying" : "confidential");
  const selectedPairId = pairId || requestedPairId || options[0]?.id || "";
  const pair = options.find((item) => item.id === selectedPairId) ?? options[0];
  const actionable = pairIsActionable(pair);
  const inputToken = mode === "shield" ? pair?.underlying : pair?.confidential;
  const outputToken = mode === "shield" ? pair?.confidential : pair?.underlying;
  const inputDecimals = inputToken?.decimals ?? 18;
  const parsed = pair ? parseTokenAmount(amount, inputDecimals) : 0n;
  const shieldOutput = pair && actionable ? estimateWrappedAmount(parsed, pair.rate) : 0n;
  const outputAmount = mode === "shield" ? (actionable ? formatTokenAmount(shieldOutput, pair?.confidential.decimals ?? 6) : "0.00") : amount || "0.00";

  useEffect(() => {
    if (intent?.page) setMode(intent.page);
  }, [intent?.nonce]);

  useEffect(() => {
    setError("");
    setShieldResult(undefined);
    setApprovalTxHash(undefined);
    setShieldFailedStep(undefined);
  }, [mode, selectedPairId, amount]);

  useEffect(() => {
    if (requestedPairId) setPairId(requestedPairId);
  }, [requestedPairId, intent?.nonce]);

  useEffect(() => {
    if (!pairId && options[0]) setPairId(options[0].id);
  }, [mode, pairId, options.length]);

  useEffect(() => {
    if (!account || !pair) return;
    let cancelled = false;
    Promise.all([
      publicClient.readContract({ address: pair.underlying.address, abi: erc20Abi, functionName: "balanceOf", args: [account] }).catch(() => undefined),
      actionable ? readConfidentialHandle(publicClient, pair.confidential.address, account).catch(() => undefined) : Promise.resolve(undefined)
    ]).then(([publicValue, handle]) => {
      if (cancelled) return;
      setPublicBalance(publicValue);
      setConfidentialHandle(handle as Hex | undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [account, pair?.id, actionable]);

  function swapMode() {
    const nextMode = mode === "shield" ? "unshield" : "shield";
    const nextOptions = nextMode === "shield" ? shieldOptions : unshieldOptions;
    setMode(nextMode);
    setAmount("");
    setPairId(pair && nextOptions.some((item) => item.id === pair.id) ? pair.id : nextOptions[0]?.id ?? "");
  }

  async function submitShield() {
    if (!account || !provider || !pair || !actionable || parsed <= 0n) return;
    setBusy(true);
    setPhase("checking");
    setError("");
    setShieldResult(undefined);
    setApprovalTxHash(undefined);
    setShieldFailedStep(undefined);
    try {
      setShieldFailedStep("allowance");
      const currentAllowance = await readAllowance(pair.underlying.address, account, pair.confidential.address);
      let approval: Hex | undefined;
      if (currentAllowance < parsed) {
        setPhase("approving");
        approval = await approveToken(provider, pair.underlying.address, account, pair.confidential.address, parsed);
        setApprovalTxHash(approval);
        pushActivity({ type: "approve", status: "pending", title: `Approve ${pair.underlying.symbol}`, txHash: approval });
        await waitForTransactionSuccess(approval);
        pushActivity({ type: "approve", status: "success", title: `Approved ${pair.underlying.symbol}`, txHash: approval });

        const updatedAllowance = await readAllowance(pair.underlying.address, account, pair.confidential.address);
        if (updatedAllowance < parsed) {
          throw new Error(`Approval confirmed, but allowance is still below ${amount} ${pair.underlying.symbol}.`);
        }
      }

      setShieldFailedStep("wrap");
      setPhase("wrapping");
      const txHash = await wrapToken(provider, pair.confidential.address, account, parsed);
      pushActivity({ type: "wrap", status: "pending", title: `Shield ${pair.underlying.symbol}`, detail: `${amount} ${pair.underlying.symbol}`, txHash });
      await waitForTransactionSuccess(txHash);
      pushActivity({ type: "wrap", status: "success", title: `Shielded ${pair.underlying.symbol}`, detail: `${amount} ${pair.underlying.symbol}`, txHash });
      setShieldResult({
        approvalTxHash: approval,
        wrapTxHash: txHash,
        inputAmount: amount,
        inputSymbol: pair.underlying.symbol,
        outputAmount,
        outputSymbol: pair.confidential.symbol
      });
      setShieldFailedStep(undefined);
    } catch (error) {
      const detail = walletErrorMessage(error);
      setError(detail);
      pushActivity({ type: "wrap", status: "failed", title: "Shield failed", detail });
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  async function submitUnshield() {
    if (!account || !provider || !pair || parsed <= 0n) return;
    setBusy(true);
    setPhase("requesting");
    try {
      const instance = await createEncryptedInput(provider, pair.confidential.address, account, parsed);
      const result = await requestUnwrap(provider, pair.confidential.address, account, instance.handle, instance.proof);
      const item: PendingUnwrap = {
        chainId: SEPOLIA_CHAIN_ID,
        wrapper: pair.confidential.address,
        requestId: result.requestId ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
        encryptedHandle: instance.handle,
        receiver: account,
        createdTxHash: result.txHash,
        status: result.requestId ? "requested" : "failed",
        createdAt: Date.now()
      };
      savePending([item, ...pending]);
      pushActivity({ type: "unwrap-request", status: "pending", title: `Request unshield ${pair.confidential.symbol}`, txHash: result.txHash });
    } catch (error) {
      pushActivity({ type: "unwrap-request", status: "failed", title: "Unshield request failed", detail: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  async function finalize(item: PendingUnwrap) {
    if (!account || !provider) return;
    try {
      const proof = item.proof ?? "0x";
      const clearValue = BigInt(item.clearValue ?? "0");
      const txHash = await finalizeUnwrap(provider, item.wrapper, account, item.requestId, clearValue, proof as Hex);
      const next = pending.map((entry) => (entry.requestId === item.requestId ? { ...entry, status: "finalized" as const } : entry));
      savePending(next);
      pushActivity({ type: "unwrap-finalize", status: "pending", title: "Finalize unshield", txHash });
    } catch (error) {
      pushActivity({ type: "unwrap-finalize", status: "failed", title: "Finalize failed", detail: error instanceof Error ? error.message : String(error) });
    }
  }

  const inputBalance =
    mode === "shield"
      ? pair
        ? `${formatTokenAmount(publicBalance, pair.underlying.decimals)} ${pair.underlying.symbol}`
        : "-"
      : pair
        ? confidentialBalancePreview(confidentialHandle, pair.confidential.symbol)
        : "-";
  const outputBalance = mode === "shield"
    ? actionable && pair
      ? confidentialBalancePreview(confidentialHandle, pair.confidential.symbol)
      : "No cToken wrapper"
    : pair
      ? `${formatTokenAmount(publicBalance, pair.underlying.decimals)} ${pair.underlying.symbol}`
      : "-";
  const submitLabel =
    mode === "shield"
      ? phase === "checking"
        ? "Checking allowance"
        : phase === "approving"
          ? "Approving"
          : phase === "wrapping"
            ? "Shielding"
            : "Shield"
      : phase === "requesting"
        ? "Requesting"
        : "Unshield";
  const submitReady = mode === "shield" ? (actionable ? "Shield" : "Wrapper required") : "Request unshield";
  const submitText = busy ? submitLabel : mode === "shield" && !actionable ? "Wrapper required" : ctaLabel(submitReady, mode === "shield" ? "shield" : "unshield", account, isSepolia);
  const disabled = locked || !pair || parsed <= 0n || busy || (mode === "shield" && !actionable);
  const canSetMax = mode === "shield" && pair && publicBalance !== undefined && publicBalance > 0n;
  function setMax() {
    if (mode === "shield" && pair && publicBalance !== undefined) {
      setAmount(formatTokenAmount(publicBalance, pair.underlying.decimals).replace(/,/g, ""));
    }
  }
  const shieldSteps = buildShieldSteps({
    phase,
    busy,
    hasAmount: parsed > 0n,
    error,
    result: shieldResult,
    approvalTxHash,
    failedStep: shieldFailedStep
  });

  return (
    <div className="flow-page">
      <div className="flow-card">
        <div className="flow-card-head">
          <span className="leg">{mode === "shield" ? "You shield" : "You unshield"}</span>
          <FlowPairSelect pairs={options} value={selectedPairId} setValue={setPairId} side={mode === "shield" ? "underlying" : "confidential"} />
        </div>
        <div className="flow-amount-row">
          <input className="flow-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" aria-label="Amount" />
        </div>
        <div className="flow-sub">
          <span>Balance: {inputBalance}</span>
          {canSetMax ? <button className="max" onClick={setMax}>MAX</button> : null}
        </div>
      </div>

      <div className="flow-switch-row">
        <button className="flow-switch" onClick={swapMode} aria-label={mode === "shield" ? "Switch to unshield" : "Switch to shield"}>
          <ArrowDownUp size={18} />
        </button>
      </div>

      <div className="flow-card">
        <div className="flow-card-head">
          <span className="leg">You receive</span>
          {mode === "shield" ? (
            actionable && pair ? (
              <FlowPairSelect pairs={options} value={selectedPairId} setValue={setPairId} side="confidential" />
            ) : (
              <button className="btn sm" onClick={onCreateWrapper}>Create wrapper</button>
            )
          ) : pair ? (
            <FlowPairSelect pairs={options} value={selectedPairId} setValue={setPairId} side="underlying" />
          ) : null}
        </div>
        <div className="flow-amount-row">
          <input className="flow-amount readonly" value={outputAmount} readOnly placeholder="0" aria-label="Amount received" />
        </div>
        <div className="flow-sub">
          <span>Balance: {outputBalance}</span>
        </div>
      </div>

      {mode === "shield" && pair && parsed > 0n && shieldOutput === 0n ? <p className="flow-warning">Amount is below the wrapper rate and may mint zero confidential tokens.</p> : null}
      {mode === "shield" && !actionable && pair ? <p className="flow-warning">No valid wrapper is available for this ERC20 yet. Create or add its cToken wrapper before shielding.</p> : null}
      <button className="btn primary flow-submit" disabled={disabled} onClick={() => void (mode === "shield" ? submitShield() : submitUnshield())}>
        {submitText}
      </button>
      {mode === "shield" ? <FlowSteps steps={shieldSteps} /> : null}
      {mode === "shield" && error ? <p className="flow-warning">{error}</p> : null}
      {mode === "shield" && shieldResult ? <ShieldResultPanel result={shieldResult} /> : null}

      {pending.length ? (
        <section className="panel" style={{ marginTop: 24 }}>
          <div className="section-title">
            <h2>Pending unwraps</h2>
            <span className="hint">{pending.length} saved</span>
          </div>
          <div className="activity-list">
            {pending.map((item) => (
              <div className="activity-item" key={item.requestId + item.createdTxHash}>
                <div className="activity-left">
                  <span className="activity-icon"><RefreshCw size={16} /></span>
                  <div className="activity-meta">
                    <strong>{shortAddress(item.requestId)}</strong>
                    <span>{item.status}</span>
                  </div>
                </div>
                <div className="activity-right">
                  <button disabled={item.status === "finalized"} onClick={() => void finalize(item)}>Finalize</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function buildShieldSteps({
  phase,
  busy,
  hasAmount,
  error,
  result,
  approvalTxHash,
  failedStep
}: {
  phase: "idle" | "checking" | "approving" | "wrapping" | "requesting";
  busy: boolean;
  hasAmount: boolean;
  error: string;
  result?: ShieldResult;
  approvalTxHash?: Hex;
  failedStep?: ShieldStepId;
}): Array<{ id: ShieldStepId; label: string; detail: string; state: FlowStepState; txHash?: Hex }> {
  if (result) {
    return [
      {
        id: "allowance",
        label: "Allowance",
        detail: result.approvalTxHash ? "Approval confirmed on Sepolia." : "Existing allowance was sufficient.",
        state: result.approvalTxHash ? "done" : "skipped",
        txHash: result.approvalTxHash
      },
      {
        id: "wrap",
        label: "Shield",
        detail: "Shield transaction confirmed on Sepolia.",
        state: "done",
        txHash: result.wrapTxHash
      }
    ];
  }

  if (error && !busy) {
    return [
      {
        id: "allowance",
        label: "Allowance",
        detail: failedStep === "allowance" ? error : approvalTxHash ? "Approval confirmed on Sepolia." : "Check ERC20 allowance.",
        state: failedStep === "allowance" ? "error" : approvalTxHash ? "done" : "waiting",
        txHash: approvalTxHash
      },
      {
        id: "wrap",
        label: "Shield",
        detail: failedStep === "wrap" ? error : "Submit wrapper transaction.",
        state: failedStep === "wrap" ? "error" : "waiting"
      }
    ];
  }

  const allowanceActive = phase === "checking" || phase === "approving";
  const wrapActive = phase === "wrapping";
  return [
    {
      id: "allowance",
      label: "Allowance",
      detail: phase === "checking" ? "Checking ERC20 allowance." : phase === "approving" ? "Approve wrapper spending in your wallet." : wrapActive ? (approvalTxHash ? "Approval confirmed on Sepolia." : "Existing allowance is sufficient.") : "Check whether approval is needed.",
      state: allowanceActive ? "active" : wrapActive ? (approvalTxHash ? "done" : "skipped") : "waiting",
      txHash: approvalTxHash
    },
    {
      id: "wrap",
      label: "Shield",
      detail: wrapActive ? "Submitting and confirming shield transaction." : hasAmount ? "Wrap ERC20 into confidential token." : "Enter an amount to prepare shielding.",
      state: wrapActive ? "active" : "waiting"
    }
  ];
}

function FlowSteps({ steps }: { steps: Array<{ id: ShieldStepId; label: string; detail: string; state: FlowStepState; txHash?: Hex }> }) {
  const stepClass = (state: FlowStepState) => (state === "active" ? "active" : state === "done" || state === "skipped" ? "done" : state === "error" ? "error" : "");
  return (
    <div className="flow-steps" aria-label="Shield progress">
      {steps.map((step, index) => (
        <div className={`flow-step ${stepClass(step.state)}`} key={step.id}>
          <div className="idx">{index + 1}</div>
          <div className="body">
            <div className="row">
              <strong>{step.label}</strong>
              {step.state === "active" ? <span className="spinner" aria-hidden="true" /> : <span className="tag">{step.state}</span>}
            </div>
            <p>{step.detail}</p>
            {step.txHash ? (
              <a href={transactionUrl(step.txHash)} target="_blank" rel="noreferrer">
                View {shortAddress(step.txHash)}
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShieldResultPanel({ result }: { result: ShieldResult }) {
  return (
    <div className="flow-result">
      <div className="rhead">
        <Check size={16} />
        Shield complete
      </div>
      <div className="grid">
        <span>You shielded</span>
        <strong>{result.inputAmount} {result.inputSymbol}</strong>
        <span>You received</span>
        <strong>{result.outputAmount} {result.outputSymbol}</strong>
        {result.approvalTxHash ? (
          <>
            <span>Approve tx</span>
            <a href={transactionUrl(result.approvalTxHash)} target="_blank" rel="noreferrer">{shortAddress(result.approvalTxHash)}</a>
          </>
        ) : null}
        <span>Shield tx</span>
        <a href={transactionUrl(result.wrapTxHash)} target="_blank" rel="noreferrer">{shortAddress(result.wrapTxHash)}</a>
      </div>
    </div>
  );
}

async function createEncryptedInput(provider: EthereumProvider, wrapper: Address, account: Address, amount: bigint): Promise<{ handle: Hex; proof: Hex }> {
  const instance = await createZamaInstance(provider);
  const input = instance.createEncryptedInput(wrapper, account).add64(amount);
  const encrypted = await input.encrypt();
  return { handle: bytesLikeToHex(encrypted.handles?.[0] ?? encrypted.handle), proof: bytesLikeToHex(encrypted.inputProof ?? encrypted.proof) };
}

function bytesLikeToHex(value: Hex | Uint8Array): Hex {
  return typeof value === "string" ? value : toHex(value);
}

type SendToken = { address: Address; metadata: TokenMetadata; underlying?: TokenMetadata };

function SendPage({
  pairs,
  standaloneTokens,
  account,
  provider,
  locked,
  isSepolia,
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  standaloneTokens: StandaloneConfidentialToken[];
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
  isSepolia: boolean;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
}) {
  const tokens = useMemo<SendToken[]>(() => {
    const fromPairs = pairs
      .filter((pair) => pair.isValid)
      .map((pair) => ({ address: pair.confidential.address, metadata: pair.confidential, underlying: pair.underlying }));
    const fromStandalone = standaloneTokens.map((token) => ({ address: token.confidential.address, metadata: token.confidential }));
    const seen = new Set<string>();
    return [...fromPairs, ...fromStandalone].filter((token) => {
      const key = token.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pairs, standaloneTokens]);

  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handle, setHandle] = useState<Hex>();

  const selected = tokens.find((token) => token.address.toLowerCase() === tokenAddress.toLowerCase()) ?? tokens[0];
  const decimals = selected?.metadata.decimals ?? 6;
  const parsed = selected ? parseTokenAmount(amount, decimals) : 0n;
  const recipientValid = isAddress(recipient);
  const balanceLabel = !selected ? "-" : confidentialBalancePreview(handle, selected.metadata.symbol);

  useEffect(() => {
    if (!tokenAddress && tokens[0]) setTokenAddress(tokens[0].address);
  }, [tokens.length]);

  useEffect(() => {
    let cancelled = false;
    setHandle(undefined);
    if (!account || !selected) return;
    readConfidentialHandle(publicClient, selected.address, account)
      .then((value) => {
        if (!cancelled) setHandle(value as Hex);
      })
      .catch(() => {
        if (!cancelled) setHandle(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [account, selected?.address]);

  async function submit() {
    if (!account || !provider || !selected || parsed <= 0n || !recipientValid) return;
    setBusy(true);
    setError("");
    try {
      const encrypted = await createEncryptedInput(provider, selected.address, account, parsed);
      const txHash = await confidentialTransfer(provider, selected.address, account, getAddress(recipient), encrypted.handle, encrypted.proof);
      pushActivity({ type: "send", status: "pending", title: `Send ${selected.metadata.symbol}`, detail: `${amount} ${selected.metadata.symbol} → ${shortAddress(recipient)}`, txHash });
      setAmount("");
      setRecipient("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      pushActivity({ type: "send", status: "failed", title: "Send failed", detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-page">
      <div className="form-card">
        <div className="form-head">
          <h2>Send confidential tokens</h2>
          <p>Transfer confidential balances privately. Amounts stay encrypted on-chain.</p>
        </div>
        <div className="field">
          <label>Token</label>
          <TokenDropdown
            options={tokens.map((token) => ({ value: token.address, token: token.metadata, confidential: true, underlying: token.underlying, balance: "****", encrypted: true }))}
            value={selected?.address ?? ""}
            setValue={setTokenAddress}
            placeholder="No confidential tokens"
            fullWidth
          />
          <span className="help">Confidential balance: {balanceLabel} — decrypt on the dashboard to see the exact amount.</span>
        </div>
        <div className="field">
          <label htmlFor="send-to">Recipient address</label>
          <input id="send-to" className="input mono" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="0x…" spellCheck={false} />
          {recipient && !recipientValid ? <span className="err">Enter a valid 0x address.</span> : null}
        </div>
        <div className="field">
          <label htmlFor="send-amount">Amount</label>
          <input id="send-amount" className="input mono" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" />
        </div>
        {error ? <p className="warning">{error}</p> : null}
        <button className="btn primary block" disabled={locked || !selected || parsed <= 0n || !recipientValid || busy} onClick={() => void submit()}>
          {busy ? "Sending…" : ctaLabel("Send confidential tokens", "send", account, isSepolia)}
        </button>
      </div>
    </div>
  );
}

function FaucetPage({
  pairs,
  account,
  provider,
  locked,
  isSepolia,
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
  isSepolia: boolean;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
}) {
  const faucetPairs = pairs.filter((pair) => pair.supportsFaucet);
  const [pairId, setPairId] = useState("");
  const [amount, setAmount] = useState("1000000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pair = faucetPairs.find((item) => item.id === pairId) ?? faucetPairs[0];
  const parsed = pair ? parseTokenAmount(amount, pair.underlying.decimals) : 0n;
  const allowed = pair ? isFaucetAmountAllowed(parsed, pair.underlying.decimals, FAUCET_MAX_TOKENS) : false;

  useEffect(() => {
    if (!pairId && faucetPairs[0]) setPairId(faucetPairs[0].id);
  }, [faucetPairs.length]);

  async function submit() {
    if (!account || !provider || !pair || !allowed) return;
    setBusy(true);
    setError("");
    try {
      const txHash = await mintFaucet(provider, pair.underlying.address, account, parsed);
      pushActivity({ type: "faucet", status: "pending", title: `Claim ${pair.underlying.symbol}`, detail: `${amount} tokens`, txHash });
    } catch (error) {
      const message = walletErrorMessage(error);
      setError(message);
      pushActivity({ type: "faucet", status: "failed", title: "Faucet failed", detail: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-page">
      <div className="form-card">
        <div className="form-head">
          <h2>Faucet</h2>
          <p>Mint mock ERC-20 test tokens. Limit 1,000,000 per call.</p>
        </div>
        <div className="field">
          <label>Token</label>
          <div className="faucet-grid">
            {faucetPairs.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === pair?.id ? "faucet-token active" : "faucet-token"}
                onClick={() => setPairId(option.id)}
              >
                <TokenAvatar token={option.underlying} />
                <span>{option.underlying.symbol}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="faucet-amount">Amount</label>
          <input id="faucet-amount" className="input mono" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
          <span className="help">Per-call limit 1,000,000 {pair?.underlying.symbol}.</span>
          {!allowed && amount ? <span className="err">Enter an amount from 0 to 1,000,000 tokens.</span> : null}
        </div>
        {error ? <p className="warning">{error}</p> : null}
        <button className="btn primary block" disabled={!pair || !allowed || busy} onClick={() => void submit()}>
          {busy ? "Claiming…" : ctaLabel("Claim", "mint", account, isSepolia)}
        </button>
      </div>
    </div>
  );
}

async function runUserDecrypt(
  provider: EthereumProvider,
  token: Address,
  account: Address,
  handle: Hex,
  signer?: TypedDataSigner,
  onPhase?: (phase: "signing" | "decrypting") => void
): Promise<string> {
  const contractAddresses = [token];
  const instance = await createZamaInstance(provider);
  onPhase?.("signing");
  const permit = await signUserDecryptPermit(instance, provider, account, contractAddresses, signer);
  onPhase?.("decrypting");
  if (!instance.userDecrypt) {
    throw new Error("Relayer SDK user decrypt API is unavailable in this installed version.");
  }
  const values = await instance.userDecrypt(
    [{ handle, contractAddress: token }],
    permit.privateKey,
    permit.publicKey,
    permit.signature,
    permit.contractAddresses,
    account,
    permit.startTimestamp,
    permit.durationDays
  );
  return String(values[handle] ?? values[handle.toLowerCase()] ?? "0");
}

function activityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "wrap":
    case "approve":
      return <Shield size={16} />;
    case "unwrap-request":
    case "unwrap-finalize":
      return <RefreshCw size={16} />;
    case "decrypt":
      return <Eye size={16} />;
    case "faucet":
      return <Banknote size={16} />;
    case "send":
      return <Send size={16} />;
    default:
      return <Plus size={16} />;
  }
}

const ACTIVITY_ACTION_LABEL: Record<ActivityItem["type"], string> = {
  faucet: "Minted",
  approve: "Approved",
  wrap: "Shielded",
  "unwrap-request": "Unshield requested",
  "unwrap-finalize": "Unshield finalized",
  decrypt: "Decrypted",
  "add-token": "Added token",
  send: "Sent"
};

function formatActivityDate(ms: number) {
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
}

const ACTIVITY_PAGE_SIZE = 8;

function ActivityPage({ items }: { items: ActivityItem[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / ACTIVITY_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const slice = items.slice(current * ACTIVITY_PAGE_SIZE, current * ACTIVITY_PAGE_SIZE + ACTIVITY_PAGE_SIZE);

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <div className="section-title">
        <h2>Activity</h2>
        <span className="hint">Local log · this browser only</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <Activity size={28} />
          <strong>No activity yet</strong>
          <span>Shield, unshield, decrypt, mint and send actions show up here.</span>
        </div>
      ) : (
        <>
          <div className="activity-table">
            <div className="activity-thead">
              <span>Token</span>
              <span>Amount</span>
              <span>Action</span>
              <span>Date</span>
              <span />
            </div>
            {slice.map((item) => {
              const rowInner = (
                <>
                  <span className="act-token">
                    {item.tokenSymbol ? (
                      <TokenAvatar
                        token={{ address: "0x0000000000000000000000000000000000000000", name: item.tokenSymbol, symbol: item.tokenSymbol, decimals: 0, iconUrl: item.tokenIconUrl }}
                        confidential={item.tokenConfidential}
                        size="sm"
                      />
                    ) : (
                      <span className="activity-icon">{activityIcon(item.type)}</span>
                    )}
                    <span className="act-token-name">{item.tokenSymbol ?? item.title}</span>
                  </span>
                  <span className="act-amount">{item.amount ?? "—"}</span>
                  <span className="act-action">
                    <span className={`act-badge ${item.status}`}>{activityIcon(item.type)}{ACTIVITY_ACTION_LABEL[item.type]}</span>
                  </span>
                  <span className="act-date">{formatActivityDate(item.createdAt)}</span>
                  <span className="act-arrow">{item.txHash ? <ChevronRight size={16} /> : null}</span>
                </>
              );
              return item.txHash ? (
                <a key={item.id} className="activity-trow" href={transactionUrl(item.txHash)} target="_blank" rel="noreferrer">{rowInner}</a>
              ) : (
                <div key={item.id} className="activity-trow static">{rowInner}</div>
              );
            })}
          </div>
          {pageCount > 1 ? (
            <div className="activity-pager">
              <span>Page {current + 1} of {pageCount}</span>
              <div className="activity-pager-actions">
                <button className="btn sm" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
                <button className="btn sm" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

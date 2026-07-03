import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { usePrivy, useSignTypedData, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownUp,
  Banknote,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  LayoutDashboard,
  Plus,
  RefreshCcw,
  Send,
  Shield,
  TrendingUp,
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

type Page = "dashboard" | "shield" | "unshield" | "faucet" | "send" | "earn" | "activity";
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
  { page: "earn", label: "Earn", icon: TrendingUp },
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

export default function App({ privyConfigured }: { privyConfigured: boolean }) {
  const { ready: privyReady, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { signTypedData } = useSignTypedData();
  const [page, setPage] = useState<Page>("dashboard");
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
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/zama-brand-icon.png" alt="" />
          </div>
          <div>
            <strong>Confidential Hub</strong>
            <span>Sepolia Registry</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => setPage(item.page)}>
                <Icon size={18} />
                <span>{item.label}</span>
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
              onActivity={() => setPage("activity")}
              onSwitch={activeWallet && !isSepolia ? () => void activeWallet.switchChain(SEPOLIA_CHAIN_ID) : undefined}
              onDisconnect={() => void logout()}
            />
          ) : (
            <button className="primary wallet-connect" disabled={!privyConfigured || !privyReady || !walletsReady} onClick={() => void login()}>
              <Wallet size={16} />
              {privyConfigured ? "Connect wallet" : "Set Privy app ID"}
            </button>
          )}
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">Zama Developer Program S3</p>
            <h1>{titleFor(page)}</h1>
          </div>
          <div className="status-row">
            {account && !isSepolia ? <span className="pill warn">Wrong network</span> : null}
          </div>
        </header>

        {page === "dashboard" ? (
          <Dashboard pairs={pairs} addedPairs={addedPairs} standaloneTokens={standaloneTokens} loading={pairsQuery.isLoading} account={account} provider={walletProvider} decryptSigner={decryptSigner} actionLocked={actionLocked} onNavigate={setPage} onNavigateFlow={navigateFlow} pushActivity={pushActivity} addedTokens={addedTokens} saveTokens={saveTokens} onCopyAddress={copyAddress} />
        ) : null}
        {page === "shield" || page === "unshield" ? (
          <UnifiedWrapPage pairs={allPairs} intent={flowIntent} account={account} provider={walletProvider} locked={actionLocked} pending={pendingUnwraps} savePending={savePending} onCreateWrapper={() => setPage("dashboard")} pushActivity={pushActivity} />
        ) : null}
        {page === "faucet" ? <FaucetPage pairs={pairs} account={account} provider={walletProvider} locked={actionLocked} pushActivity={pushActivity} /> : null}
        {page === "send" ? <SendPage pairs={allPairs} standaloneTokens={standaloneTokens} account={account} provider={walletProvider} locked={actionLocked} pushActivity={pushActivity} /> : null}
        {page === "earn" ? <EarnPage /> : null}
        {page === "activity" ? <ActivityPage items={activity} /> : null}
      </main>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function WalletMenu({
  account,
  isSepolia,
  onCopy,
  onExplorer,
  onActivity,
  onSwitch,
  onDisconnect
}: {
  account: Address;
  isSepolia: boolean;
  onCopy: () => void;
  onExplorer: () => void;
  onActivity: () => void;
  onSwitch?: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  function run(action: () => void) {
    action();
    setOpen(false);
  }
  return (
    <div className="wallet-menu-wrap">
      {open ? <div className="wallet-menu-overlay" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <div className="wallet-menu">
          <button onClick={() => run(onCopy)}>Copy address</button>
          <button onClick={() => run(onExplorer)}>View on Blockscout</button>
          <button onClick={() => run(onActivity)}>Activity</button>
          {onSwitch ? <button onClick={() => run(onSwitch)}>Switch to Sepolia</button> : null}
          <button className="wallet-menu-danger" onClick={() => run(onDisconnect)}>Disconnect</button>
        </div>
      ) : null}
      <button className={isSepolia ? "wallet-button" : "wallet-button wallet-wrong"} onClick={() => setOpen((value) => !value)}>
        <Wallet size={16} />
        <span>{shortAddress(account)}</span>
        <ChevronUp size={14} className={open ? "" : "wallet-chevron-down"} />
      </button>
    </div>
  );
}

function titleFor(page: Page) {
  return {
    dashboard: "Dashboard",
    shield: "Shield / Unshield",
    unshield: "Shield / Unshield",
    faucet: "Mock faucet",
    send: "Send tokens",
    earn: "Earn",
    activity: "Activity"
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
  onNavigate,
  onNavigateFlow,
  pushActivity,
  addedTokens,
  saveTokens,
  onCopyAddress
}: {
  pairs: TokenWrapperPair[];
  addedPairs: TokenWrapperPair[];
  standaloneTokens: StandaloneConfidentialToken[];
  loading: boolean;
  account?: Address;
  provider?: EthereumProvider;
  decryptSigner?: TypedDataSigner;
  actionLocked: boolean;
  onNavigate: (page: Page) => void;
  onNavigateFlow: (intent: Omit<FlowIntent, "nonce">) => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  addedTokens: AddedToken[];
  saveTokens: (items: AddedToken[]) => void;
  onCopyAddress: (address: string) => void;
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
      <section className="wallet-balance-card">
        <div className="wallet-balance-left">
          <span className="wallet-balance-icon"><Wallet size={20} /></span>
          <div>
            <p>TOTAL BALANCE</p>
            <strong>{formatFiat(totalValue)}</strong>
            <span>Available to shield: {formatFiat(shieldableValue)}</span>
          </div>
        </div>
        <button className="primary wallet-shield-cta" disabled={actionLocked || walletRows.length === 0} onClick={() => onNavigateFlow({ page: "shield" })}>
          <Shield size={16} />
          SHIELD
        </button>
      </section>

      <section className="wallet-assets">
        <div className="wallet-asset-header">
          <span>Asset</span>
          <span>Price</span>
          <span>Balance</span>
          <span>Value</span>
        </div>
        <div className="wallet-asset-list">
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
          <button className="wallet-add-asset" onClick={() => setCreateRequest({ tab: "add" })}>
            <Plus size={18} />
            Add token
          </button>
        </div>
        <button className="wallet-empty-toggle" onClick={() => setShowEmptyAssets((value) => !value)}>
          {showEmptyAssets ? "Hide empty assets" : `Show empty assets (${emptyRows.length})`}
        </button>
        {loading || pricesQuery.isLoading ? <p className="wallet-loading">{loading ? "Loading registry assets..." : "Loading token prices..."}</p> : null}
      </section>
      {selectedRow ? (
        <AssetDetailModal
          row={selectedRow}
          snapshot={assetSnapshots[selectedRow.id]}
          prices={prices}
          actionLocked={actionLocked}
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
        <CreateTokenModal request={createRequest} addedTokens={addedTokens} saveTokens={saveTokens} account={account} provider={provider} actionLocked={actionLocked} pairs={[...pairs, ...addedPairs]} pushActivity={pushActivity} onClose={() => setCreateRequest(null)} />
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
    <div
      className="wallet-asset-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="wallet-asset-token">
        {token ? <TokenAvatar token={token} confidential={!row.underlying} underlying={row.underlying} /> : null}
        <span>
          <strong>{assetSymbol(row)}</strong>
          <small>{assetName(row)}</small>
        </span>
      </div>
      <span className="wallet-price">{formatFiat(price)}</span>
      <span className="wallet-balances">
        <em>{formattedPublicBalance}</em>
        {confidential ? <em>{confidentialDisplay === "encrypted" ? "****" : confidentialDisplay}</em> : null}
        {confidential && handle && !isZeroConfidentialHandle(handle) && confidentialDisplay === "encrypted" ? (
          <button className="wallet-decrypt-chip" disabled={actionLocked || decryptPhase !== "idle"} onClick={decryptBalance}>
            <Eye size={12} />
            {decryptPhase === "signing" ? "Signing" : decryptPhase === "decrypting" ? "Decrypting" : "Decrypt"}
          </button>
        ) : null}
      </span>
      <span className="wallet-value">{formatFiat(value)}</span>
      <ChevronRight size={16} className="wallet-row-arrow" />
    </div>
  );
}

function AssetDetailModal({
  row,
  snapshot,
  prices,
  actionLocked,
  onClose,
  onNavigateFlow,
  onSend
}: {
  row: DashboardRow;
  snapshot?: WalletAssetSnapshot;
  prices: TokenPriceMap;
  actionLocked: boolean;
  onClose: () => void;
  onNavigateFlow: (intent: Omit<FlowIntent, "nonce">) => void;
  onSend: () => void;
}) {
  const token = row.underlying ?? row.confidential;
  const publicBalance = row.underlying ? `${formatTokenAmount(snapshot?.publicBalance, row.underlying.decimals)} ${row.underlying.symbol}` : "-";
  const confidentialBalance = row.confidential ? snapshot?.confidentialDisplay ?? "encrypted" : "-";
  const totalValue = assetValue(row, snapshot, prices);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="asset-detail-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Close"><X size={18} /></button>
        <div className="asset-detail-hero">
          {token ? <TokenAvatar token={token} confidential={!row.underlying} underlying={row.underlying} /> : null}
          <strong>{assetName(row)}</strong>
          <span>{assetSymbol(row)}</span>
        </div>
        <div className="asset-summary-grid">
          <div>
            <span>PRICE</span>
            <strong>{formatFiat(priceForAsset(row, prices))}</strong>
            <em>Live USD price</em>
          </div>
          <div>
            <span>TOTAL BALANCE</span>
            <strong>{formatFiat(totalValue)}</strong>
            <em>{tokenAmountLabel(row, snapshot)}</em>
          </div>
        </div>
        {row.confidential ? (
          <div className="asset-balance-card">
            <div>
              <strong>{row.confidential.symbol}</strong>
              <span>Confidential</span>
            </div>
            <div>
              <em>{confidentialBalance === "encrypted" ? "****" : confidentialBalance}</em>
              <span>{formatFiat(confidentialAssetValue(row, snapshot, prices))}</span>
              <button className="secondary" disabled={actionLocked || !row.canUnshield || !row.pair} onClick={() => row.pair && onNavigateFlow({ page: "unshield", pairId: row.pair.id, tokenAddress: row.confidential?.address })}>UNSHIELD</button>
            </div>
          </div>
        ) : null}
        {row.underlying ? (
          <div className="asset-balance-card">
            <div>
              <strong>{row.underlying.symbol}</strong>
              <span>Standard</span>
            </div>
            <div>
              <em>{publicBalance}</em>
              <span>{formatFiat(publicAssetValue(row, snapshot, prices))}</span>
              <button className="primary" disabled={actionLocked || !row.canShield || !row.pair} onClick={() => row.pair && onNavigateFlow({ page: "shield", pairId: row.pair.id, tokenAddress: row.underlying?.address })}>SHIELD</button>
            </div>
          </div>
        ) : null}
        <button className="asset-send-button" onClick={onSend}>
          <Send size={16} />
          Send
        </button>
      </section>
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

function CollapsibleSection({ title, action, defaultExpanded, children }: { title: string; action?: string; defaultExpanded?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);
  return (
    <section className="panel collapsible">
      <button className="collapsible-head" onClick={() => setExpanded((value) => !value)}>
        <h2>{title}</h2>
        <div className="collapsible-meta">
          {action ? <span>{action}</span> : null}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      {expanded ? children : null}
    </section>
  );
}

function TokenPairCard({
  row,
  editable,
  account,
  provider,
  decryptSigner,
  actionLocked,
  onNavigateFlow,
  pushActivity,
  onCreate,
  onCopyAddress
}: {
  row: DashboardRow;
  editable: boolean;
  account?: Address;
  provider?: EthereumProvider;
  decryptSigner?: TypedDataSigner;
  actionLocked: boolean;
  onNavigateFlow: (intent: Omit<FlowIntent, "nonce">) => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
  onCreate: (request: CreateModalRequest) => void;
  onCopyAddress: (address: string) => void;
}) {
  const [publicBalance, setPublicBalance] = useState<bigint>();
  const [handle, setHandle] = useState<Hex>();
  const [balanceStatus, setBalanceStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [decryptPhase, setDecryptPhase] = useState<"idle" | "signing" | "decrypting">("idle");
  const [decryptError, setDecryptError] = useState("");
  const [decryptCacheVersion, setDecryptCacheVersion] = useState(0);
  const pair = row.pair;
  const underlying = row.underlying;
  const confidential = row.confidential;
  const cache = useMemo(() => readDecryptCache(), [decryptCacheVersion]);
  const decryptCacheKey = account && handle && confidential ? cacheKey(SEPOLIA_CHAIN_ID, account, confidential.address, handle) : undefined;
  const cached = decryptCacheKey ? cache[decryptCacheKey] : undefined;
  const isDecrypted = Boolean(cached?.value && cached.value !== "permit-required");
  const hasZeroHandle = isZeroConfidentialHandle(handle);
  const centerFlow = underlying ? "shield" : confidential ? "unshield" : undefined;
  const centerEnabled = centerFlow === "shield" ? row.canShield : centerFlow === "unshield" ? row.canUnshield : false;
  const confidentialBalance = getConfidentialBalanceLabel({
    handle,
    cachedValue: cached?.value,
    decimals: confidential?.decimals ?? 6,
    symbol: confidential?.symbol ?? "",
    status: balanceStatus,
    error: decryptError
  });
  const encrypted = confidentialBalance === "encrypted";

  async function refreshBalances() {
    if (!account) return;
    setBalanceStatus("loading");
    setDecryptError("");
    try {
      const [publicValue, confidentialHandle] = await Promise.all([
        underlying ? publicClient.readContract({ address: underlying.address, abi: erc20Abi, functionName: "balanceOf", args: [account] }).catch(() => undefined) : Promise.resolve(undefined),
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

  async function decryptBalance() {
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
    if (hasZeroHandle) {
      setDecryptError("No encrypted balance to decrypt.");
      return;
    }
    if (isDecrypted) {
      setDecryptError("");
      return;
    }
    setDecryptPhase("signing");
    setDecryptError("");
    try {
      if (!confidential) throw new Error("Confidential token not found.");
      const value = await runUserDecrypt(provider, confidential.address, account, handle, decryptSigner, (phase) => setDecryptPhase(phase));
      const next = readDecryptCache();
      next[cacheKey(SEPOLIA_CHAIN_ID, account, confidential.address, handle)] = { value, lastDecryptedAt: Date.now() };
      writeDecryptCache(next);
      setDecryptCacheVersion((version) => version + 1);
      pushActivity({ type: "decrypt", status: "success", title: `Decrypted ${confidential.symbol} balance`, detail: `${formatTokenAmount(BigInt(value), confidential.decimals)} ${confidential.symbol}` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setDecryptError(detail);
      pushActivity({ type: "decrypt", status: "failed", title: `Decrypt ${confidential?.symbol ?? "token"} failed`, detail });
    } finally {
      setDecryptPhase("idle");
    }
  }

  return (
    <div className={row.canShield || row.canUnshield || row.complete ? "token-pair-card" : "token-pair-card invalid"}>
      {underlying ? (
        <TokenSide
          token={underlying}
          balance={formatTokenAmount(publicBalance, underlying.decimals)}
          onCopyAddress={onCopyAddress}
        />
      ) : (
        <EmptySide label="Add ERC20" onClick={editable ? () => onCreate({ tab: "add", category: "erc20", address: pair?.underlying.address }) : undefined} />
      )}
      <button
        className="pair-swap"
        disabled={actionLocked || !pair || !centerEnabled}
        onClick={() => {
          if (!pair || !centerFlow) return;
          onNavigateFlow({
            page: centerFlow,
            pairId: pair.id,
            tokenAddress: centerFlow === "shield" ? underlying?.address : confidential?.address
          });
        }}
        title={centerFlow === "unshield" ? "Unshield" : "Shield"}
      >
        <RefreshCcw size={18} />
      </button>
      {confidential ? (
        <TokenSide
          confidential
          token={confidential}
          underlying={underlying}
          balance={encrypted ? "****" : confidentialBalance}
          onCopyAddress={onCopyAddress}
          decrypt={{
            show: Boolean(handle && !hasZeroHandle),
            busy: decryptPhase !== "idle" || isDecrypted,
            phase: decryptPhase,
            decrypted: isDecrypted,
            error: decryptError,
            onClick: () => void decryptBalance()
          }}
        />
      ) : (
        <EmptySide label="Add ERC7984" onClick={editable ? () => onCreate({ tab: "add", category: "verified-ctoken", underlyingAddress: underlying?.address }) : undefined} />
      )}
    </div>
  );
}

function EmptySide({ onClick, label }: { onClick?: () => void; label: string }) {
  return (
    <div className="token-side empty-side">
      <button className="add-token-button" disabled={!onClick} onClick={onClick} title={label}>
        <Plus size={22} />
      </button>
    </div>
  );
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

function TokenSide({
  confidential,
  token,
  underlying,
  balance,
  decrypt,
  onCopyAddress
}: {
  confidential?: boolean;
  token: TokenMetadata;
  underlying?: TokenMetadata;
  balance: string;
  decrypt?: { show: boolean; busy: boolean; phase: "idle" | "signing" | "decrypting"; decrypted: boolean; error: string; onClick: () => void };
  onCopyAddress?: (address: string) => void;
}) {
  return (
    <div className="token-side">
      <TokenAvatar token={token} confidential={confidential} underlying={underlying} />
      <div className="token-info">
        <strong>{token.symbol}</strong>
        <small>{token.name}</small>
        <button type="button" className="address-chip" title="Copy address" onClick={() => onCopyAddress?.(token.address)}>{shortAddress(token.address)}</button>
        <div className="balance-line">
          <em>Balance: {balance}</em>
          {decrypt?.show ? (
            <button className="decrypt-button" disabled={decrypt.busy} onClick={decrypt.onClick}>
              <Eye size={12} />
              {decrypt.decrypted ? "Decrypted" : decrypt.phase === "signing" ? "Signing" : decrypt.phase === "decrypting" ? "Decrypting" : "Decrypt"}
            </button>
          ) : null}
        </div>
        {decrypt?.show && decrypt.error ? <em className="decrypt-error">{decrypt.error}</em> : null}
      </div>
    </div>
  );
}

function TokenAvatar({ token, confidential, underlying }: { token: TokenMetadata; confidential?: boolean; underlying?: TokenMetadata }) {
  const icon = confidential ? iconForConfidentialToken(token, underlying) : resolveTokenIcon(token);
  const label = confidential ? `c${token.symbol.slice(0, 1).toUpperCase()}` : token.symbol.slice(0, 1).toUpperCase();
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [icon.url]);
  return (
    <span className={confidential ? "token-avatar confidential-avatar" : "token-avatar"}>
      {icon.url && !broken ? <img src={icon.url} alt="" onError={() => setBroken(true)} /> : label}
      {confidential ? <TokenShieldIcon /> : null}
    </span>
  );
}

function TokenShieldIcon() {
  return (
    <svg viewBox="0 0 24.3965 29.9991" fill="none" xmlns="http://www.w3.org/2000/svg" className="token-shield" aria-hidden="true">
      <path
        d="M23.3962 16.398C23.3962 23.3969 18.4971 26.8963 12.674 28.926C12.3691 29.0293 12.0379 29.0243 11.7362 28.912C5.89918 26.8963 1 23.3969 1 16.398V6.59969C1 6.22845 1.14748 5.87242 1.40998 5.60991C1.67249 5.3474 2.02852 5.19993 2.39976 5.19993C5.19929 5.19993 8.69871 3.52021 11.1343 1.39256C11.4308 1.1392 11.8081 1 12.1981 1C12.5882 1 12.9654 1.1392 13.2619 1.39256C15.7115 3.5342 19.1969 5.19993 21.9965 5.19993C22.3677 5.19993 22.7237 5.3474 22.9863 5.60991C23.2488 5.87242 23.3962 6.22845 23.3962 6.59969V16.398Z"
        fill="#FFD208"
      />
      <path
        d="M22.3965 6.59961C22.3965 6.49374 22.3541 6.39231 22.2793 6.31738C22.2043 6.24241 22.1021 6.2002 21.9961 6.2002C18.8771 6.20005 15.172 4.38716 12.6123 2.15234C12.4969 2.05387 12.35 2.00003 12.1982 2C12.0464 2 11.8997 2.05466 11.7842 2.15332L11.7832 2.15234C9.23832 4.37234 5.51912 6.2002 2.39941 6.2002C2.29352 6.20029 2.19208 6.24249 2.11719 6.31738C2.04232 6.39232 2.00002 6.49368 2 6.59961V16.3984C2.00009 19.6336 3.12049 22.0083 4.89453 23.8252C6.58336 25.5548 8.90443 26.8174 11.5332 27.7783L12.0625 27.9668L12.085 27.9746C12.1704 28.0064 12.2641 28.0073 12.3506 27.9785C15.1881 26.9888 17.704 25.6728 19.5029 23.8271C21.2757 22.0082 22.3964 19.6334 22.3965 16.3984V6.59961ZM17.1035 10.8926C17.5 10.5081 18.1331 10.5176 18.5176 10.9141C18.9019 11.3106 18.8915 11.9437 18.4951 12.3281L11.2012 19.4014C10.8133 19.7775 10.1965 19.7775 9.80859 19.4014L6.49316 16.1865C6.09668 15.8021 6.08721 15.1689 6.47168 14.7725C6.85614 14.376 7.48927 14.3656 7.88574 14.75L10.5049 17.29L17.1035 10.8926ZM24.3965 16.3984C24.3964 20.1618 23.0668 23.036 20.9346 25.2236C18.8295 27.3833 15.9858 28.8304 13.0029 29.8701L12.9951 29.873C12.4799 30.0476 11.9214 30.0401 11.4102 29.8555V29.8574C8.41944 28.8247 5.57133 27.3809 3.46387 25.2227C1.32923 23.0364 9.13742e-05 20.1617 0 16.3984V6.59961C2.17195e-05 5.96318 0.253102 5.35237 0.703125 4.90234C1.15305 4.45261 1.76325 4.20029 2.39941 4.2002C4.87533 4.2002 8.15048 2.67163 10.4766 0.639648L10.4844 0.631836C10.962 0.22378 11.57 0 12.1982 0C12.7479 2.58125e-05 13.2817 0.171938 13.7266 0.488281L13.9111 0.631836L13.9199 0.639648C16.2589 2.68459 19.5195 4.20004 21.9961 4.2002C22.6324 4.2002 23.2433 4.45244 23.6934 4.90234C24.1434 5.35237 24.3965 5.96318 24.3965 6.59961V16.3984Z"
        fill="white"
      />
    </svg>
  );
}

function SectionTitle({ title, action }: { title: string; action: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <span>{action}</span>
    </div>
  );
}

function CreateTokenModal({
  addedTokens,
  saveTokens,
  account,
  provider,
  actionLocked,
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>{tab === "add" ? "Add token" : "Create token"}</h2>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-tabs">
          <button className={tab === "add" ? "active" : ""} onClick={() => setTab("add")}>Add existing</button>
          <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>Create new</button>
        </div>
        {tab === "add" ? (
          <div className="form-grid">
            <select value={category} onChange={(event) => setCategory(event.target.value as AddedToken["category"])}>
              <option value="erc20">ERC20</option>
              <option value="verified-ctoken">ERC7984 / cToken wrapper</option>
            </select>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder={category === "erc20" ? "0x ERC20 address" : "0x ERC7984 wrapper address"} />
            <p className="result">{request.underlyingAddress && category === "verified-ctoken" ? `Add the ERC7984 wrapper for ${shortAddress(request.underlyingAddress)}.` : "Token type is detected automatically from the contract on-chain."}</p>
            <button className="primary wide" disabled={!isAddress(address)} onClick={addToken}>
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
          <div className="form-grid">
            <select value={createKind} onChange={(event) => setCreateKind(event.target.value as CreateKind)}>
              <option value="erc20">ERC20 (public underlying)</option>
              <option value="wrapper">Confidential token (ERC7984 wrapper)</option>
            </select>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={createKind === "wrapper" ? "Confidential token name" : "Token name"} />
            <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder={createKind === "wrapper" ? "Confidential symbol" : "Symbol"} />
            {createKind === "erc20" ? (
              <p className="result">Decimals are fixed at {DEFAULT_ERC20_DECIMALS}.</p>
            ) : (
              <input value={tokenURI} onChange={(event) => setTokenURI(event.target.value)} placeholder="Token URI (optional)" />
            )}
            {createKind === "wrapper" ? (
              <>
                <select value={underlying} onChange={(event) => setUnderlying(event.target.value)}>
                  <option value="">Select underlying ERC20…</option>
                  {pairs.map((pair) => (
                    <option key={pair.id} value={pair.underlying.address}>
                      {pair.underlying.symbol} · {shortAddress(pair.underlying.address)}
                    </option>
                  ))}
                </select>
                <input value={underlying} onChange={(event) => setUnderlying(event.target.value)} placeholder="or paste 0x ERC20 address" />
              </>
            ) : (
              <input
                value={mintAmount}
                onChange={(event) => setMintAmount(event.target.value)}
                inputMode="decimal"
                placeholder={DEFAULT_INITIAL_MINT_AMOUNT}
              />
            )}
            <p className="result">
              {createKind === "wrapper"
                ? "Deploys a real wrapper to Sepolia. Name and symbol are prefilled as c + the selected ERC20."
                : "Deploys a real ERC20 contract to Sepolia via your wallet, then mints the initial amount to you."}
            </p>
            {deployError ? <p className="warning">{deployError}</p> : null}
            <button className="primary wide" disabled={!createReady || deploying} onClick={() => void createToken()}>
              <Plus size={16} />
              {actionLocked ? "Connect Sepolia wallet" : deployPhase === "deploying" ? "Deploying…" : "Deploy token"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PairSelect({ pairs, value, setValue }: { pairs: TokenWrapperPair[]; value: string; setValue: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => setValue(event.target.value)}>
      {pairs.map((pair) => (
        <option key={pair.id} value={pair.id}>
          {pair.underlying.symbol} / {pair.confidential.symbol}
        </option>
      ))}
    </select>
  );
}

function FlowPairSelect({ pairs, value, setValue, side }: { pairs: TokenWrapperPair[]; value: string; setValue: (value: string) => void; side: "underlying" | "confidential" }) {
  return (
    <select className="token-selector" value={value} onChange={(event) => setValue(event.target.value)}>
      {pairs.map((pair) => {
        const token = side === "underlying" ? pair.underlying : pair.confidential;
        return (
          <option key={pair.id} value={pair.id}>
            {token.symbol}
          </option>
        );
      })}
    </select>
  );
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

function TokenBadge({ token, confidential, underlying }: { token: TokenMetadata; confidential?: boolean; underlying?: TokenMetadata }) {
  return (
    <span className="token-badge">
      <TokenAvatar token={token} confidential={confidential} underlying={underlying} />
      {token.symbol}
    </span>
  );
}

function FlowCard({
  title,
  token,
  underlying,
  balance,
  selector,
  children
}: {
  title: string;
  token?: TokenMetadata;
  underlying?: TokenMetadata;
  balance: string;
  selector?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flow-card">
      <div className="flow-card-head">
        <span>{title}</span>
        <div className="flow-card-selector">{selector ?? (token ? <TokenBadge token={token} confidential={title.includes("receive") && token.symbol.startsWith("c")} underlying={underlying} /> : null)}</div>
      </div>
      {children}
      <div className="flow-divider" />
      <p>Balance {balance}</p>
    </section>
  );
}

function UnifiedWrapPage({
  pairs,
  intent,
  account,
  provider,
  locked,
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
  const disabled = locked || !pair || parsed <= 0n || busy || (mode === "shield" && !actionable);
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
    <div className="stack">
      <section className="flow-page unified-flow">
        <FlowCard
          title={mode === "shield" ? "You shield" : "You unshield"}
          token={inputToken}
          underlying={pair?.underlying}
          balance={inputBalance}
          selector={<FlowPairSelect pairs={options} value={selectedPairId} setValue={setPairId} side={mode === "shield" ? "underlying" : "confidential"} />}
        >
          <input className="flow-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
        </FlowCard>
        <div className="flow-switch-row">
          <button className="flow-switch" onClick={swapMode} title={mode === "shield" ? "Switch to unshield" : "Switch to shield"}>
            <ArrowDownUp size={20} />
          </button>
        </div>
        <FlowCard
          title="You receive"
          token={outputToken}
          underlying={pair?.underlying}
          balance={outputBalance}
          selector={
            mode === "shield"
              ? actionable && pair
                ? <TokenBadge token={pair.confidential} confidential underlying={pair.underlying} />
                : <button className="mini-action" onClick={onCreateWrapper}>Create wrapper</button>
              : pair
                ? <TokenBadge token={pair.underlying} />
                : undefined
          }
        >
          <div className="flow-amount flow-output">{outputAmount}</div>
        </FlowCard>
        {mode === "shield" && pair && parsed > 0n && shieldOutput === 0n ? <p className="warning">Amount is below the wrapper rate and may mint zero confidential tokens.</p> : null}
        {mode === "shield" && !actionable && pair ? <p className="warning">No valid wrapper is available for this ERC20 yet. Create or add its cToken wrapper before shielding.</p> : null}
        <button className="primary flow-submit" disabled={disabled} onClick={() => void (mode === "shield" ? submitShield() : submitUnshield())}>
          {locked ? "Connect Sepolia wallet" : mode === "shield" && !actionable ? "Wrapper required" : submitLabel}
        </button>
        {mode === "shield" ? <FlowSteps steps={shieldSteps} /> : null}
        {mode === "shield" && error ? <p className="warning">{error}</p> : null}
        {mode === "shield" && shieldResult ? <ShieldResultPanel result={shieldResult} /> : null}
      </section>
      {pending.length ? (
        <section className="panel pending-panel">
          <SectionTitle title="Pending unwraps" action={`${pending.length} saved`} />
          <div className="activity-list">
            {pending.map((item) => (
              <div className="activity-item" key={item.requestId + item.createdTxHash}>
                <div>
                  <strong>{shortAddress(item.requestId)}</strong>
                  <span>{item.status}</span>
                </div>
                <button disabled={item.status === "finalized"} onClick={() => void finalize(item)}>Finalize</button>
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
  return (
    <div className="flow-steps" aria-label="Shield progress">
      {steps.map((step, index) => (
        <div className={`flow-step ${step.state}`} key={step.id}>
          <div className="flow-step-index">{index + 1}/2</div>
          <div className="flow-step-body">
            <div className="flow-step-title">
              <strong>{step.label}</strong>
              <span>{step.state}</span>
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
    <div className="flow-result-panel">
      <div className="flow-result-tabs">
        <button className="active">Result</button>
        <a href={transactionUrl(result.wrapTxHash)} target="_blank" rel="noreferrer">On-chain</a>
      </div>
      <div className="flow-result-grid">
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

function ShieldPage({
  pairs,
  intent,
  account,
  provider,
  locked,
  onCreateWrapper,
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  intent?: FlowIntent;
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
  onCreateWrapper: () => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
}) {
  const shieldOptions = uniqueShieldPairs(pairs);
  const [pairId, setPairId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [publicBalance, setPublicBalance] = useState<bigint>();
  const [confidentialHandle, setConfidentialHandle] = useState<Hex>();
  const [phase, setPhase] = useState<"idle" | "checking" | "approving" | "wrapping">("idle");
  const requestedPairId = findFlowPairId(shieldOptions, intent, "underlying");
  const selectedPairId = pairId || requestedPairId || shieldOptions[0]?.id || "";
  const pair = shieldOptions.find((item) => item.id === selectedPairId) ?? shieldOptions[0];
  const actionable = pairIsActionable(pair);
  const parsed = pair ? parseTokenAmount(amount, pair.underlying.decimals) : 0n;
  const output = pair && actionable ? estimateWrappedAmount(parsed, pair.rate) : 0n;

  useEffect(() => {
    if (requestedPairId) setPairId(requestedPairId);
  }, [requestedPairId, intent?.nonce]);

  useEffect(() => {
    if (!pairId && shieldOptions[0]) setPairId(shieldOptions[0].id);
  }, [pairId, shieldOptions.length]);

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

  async function submit() {
    if (!account || !provider || !pair || !actionable || parsed <= 0n) return;
    setBusy(true);
    setPhase("checking");
    try {
      const currentAllowance = await readAllowance(pair.underlying.address, account, pair.confidential.address);
      if (currentAllowance < parsed) {
        setPhase("approving");
        const approval = await approveToken(provider, pair.underlying.address, account, pair.confidential.address, parsed);
        pushActivity({ type: "approve", status: "pending", title: `Approve ${pair.underlying.symbol}`, txHash: approval });
        await waitForTransactionSuccess(approval);
        pushActivity({ type: "approve", status: "success", title: `Approved ${pair.underlying.symbol}`, txHash: approval });

        const updatedAllowance = await readAllowance(pair.underlying.address, account, pair.confidential.address);
        if (updatedAllowance < parsed) {
          throw new Error(`Approval confirmed, but allowance is still below ${amount} ${pair.underlying.symbol}.`);
        }
      }

      setPhase("wrapping");
      const txHash = await wrapToken(provider, pair.confidential.address, account, parsed);
      pushActivity({ type: "wrap", status: "pending", title: `Shield ${pair.underlying.symbol}`, detail: `${amount} ${pair.underlying.symbol}`, txHash });
    } catch (error) {
      pushActivity({ type: "wrap", status: "failed", title: "Shield failed", detail: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      setPhase("idle");
    }
  }

  const submitLabel = phase === "checking" ? "Checking allowance" : phase === "approving" ? "Approving" : phase === "wrapping" ? "Shielding" : "Shield";
  const confidentialBalance = pair ? confidentialBalancePreview(confidentialHandle, pair.confidential.symbol) : "-";

  return (
    <section className="flow-page">
      <FlowCard
        title="You shield"
        token={pair?.underlying}
        balance={pair ? `${formatTokenAmount(publicBalance, pair.underlying.decimals)} ${pair.underlying.symbol}` : "-"}
        selector={<FlowPairSelect pairs={shieldOptions} value={selectedPairId} setValue={setPairId} side="underlying" />}
      >
        <input className="flow-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
      </FlowCard>
      <FlowCard
        title="You receive"
        token={actionable ? pair?.confidential : undefined}
        underlying={pair?.underlying}
        balance={actionable ? confidentialBalance : "No cToken wrapper"}
        selector={actionable && pair ? <TokenBadge token={pair.confidential} confidential underlying={pair.underlying} /> : <button className="mini-action" onClick={onCreateWrapper}>Create wrapper</button>}
      >
        <div className="flow-amount flow-output">{actionable ? formatTokenAmount(output, pair?.confidential.decimals ?? 6) : "0.00"}</div>
      </FlowCard>
      {pair && parsed > 0n && output === 0n ? <p className="warning">Amount is below the wrapper rate and may mint zero confidential tokens.</p> : null}
      {!actionable && pair ? <p className="warning">No valid wrapper is available for this ERC20 yet. Create or add its cToken wrapper before shielding.</p> : null}
      <button className="primary flow-submit" disabled={locked || !pair || !actionable || parsed <= 0n || busy} onClick={() => void submit()}>
        {locked ? "Connect Sepolia wallet" : !actionable ? "Wrapper required" : submitLabel}
      </button>
    </section>
  );
}

function UnshieldPage({
  pairs,
  intent,
  account,
  provider,
  locked,
  pending,
  savePending,
  pushActivity,
}: {
  pairs: TokenWrapperPair[];
  intent?: FlowIntent;
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
  pending: PendingUnwrap[];
  savePending: (items: PendingUnwrap[]) => void;
  pushActivity: (item: Omit<ActivityItem, "id" | "createdAt" | "chainId" | "account">) => void;
}) {
  const validPairs = uniqueUnshieldPairs(pairs);
  const [pairId, setPairId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [publicBalance, setPublicBalance] = useState<bigint>();
  const [confidentialHandle, setConfidentialHandle] = useState<Hex>();
  const requestedPairId = findFlowPairId(validPairs, intent, "confidential");
  const selectedPairId = pairId || requestedPairId || validPairs[0]?.id || "";
  const pair = validPairs.find((item) => item.id === selectedPairId) ?? validPairs[0];
  const parsed = pair ? parseTokenAmount(amount, pair.confidential.decimals) : 0n;

  useEffect(() => {
    if (requestedPairId) setPairId(requestedPairId);
  }, [requestedPairId, intent?.nonce]);

  useEffect(() => {
    if (!pairId && validPairs[0]) setPairId(validPairs[0].id);
  }, [pairId, validPairs.length]);

  useEffect(() => {
    if (!account || !pair) return;
    let cancelled = false;
    Promise.all([
      publicClient.readContract({ address: pair.underlying.address, abi: erc20Abi, functionName: "balanceOf", args: [account] }).catch(() => undefined),
      readConfidentialHandle(publicClient, pair.confidential.address, account).catch(() => undefined)
    ]).then(([publicValue, handle]) => {
      if (cancelled) return;
      setPublicBalance(publicValue);
      setConfidentialHandle(handle as Hex | undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [account, pair?.id]);

  async function submit() {
    if (!account || !provider || !pair || parsed <= 0n) return;
    setBusy(true);
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

  return (
    <div className="stack">
      <section className="flow-page">
        <FlowCard
          title="You unshield"
          token={pair?.confidential}
          underlying={pair?.underlying}
          balance={pair ? confidentialBalancePreview(confidentialHandle, pair.confidential.symbol) : "-"}
          selector={<FlowPairSelect pairs={validPairs} value={selectedPairId} setValue={setPairId} side="confidential" />}
        >
          <input className="flow-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
        </FlowCard>
        <FlowCard
          title="You receive"
          token={pair?.underlying}
          balance={pair ? `${formatTokenAmount(publicBalance, pair.underlying.decimals)} ${pair.underlying.symbol}` : "-"}
          selector={pair ? <TokenBadge token={pair.underlying} /> : undefined}
        >
          <div className="flow-amount flow-output">{amount || "0.00"}</div>
        </FlowCard>
        <button className="primary flow-submit" disabled={locked || !pair || parsed <= 0n || busy} onClick={() => void submit()}>
          {locked ? "Connect Sepolia wallet" : busy ? "Requesting" : "Request unshield"}
        </button>
      </section>
      <section className="panel">
        <SectionTitle title="Pending unwraps" action={`${pending.length} saved`} />
        <div className="activity-list">
          {pending.map((item) => (
            <div className="activity-item" key={item.requestId + item.createdTxHash}>
              <div>
                <strong>{shortAddress(item.requestId)}</strong>
                <span>{item.status}</span>
              </div>
              <button disabled={item.status === "finalized"} onClick={() => void finalize(item)}>Finalize</button>
            </div>
          ))}
        </div>
      </section>
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
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  standaloneTokens: StandaloneConfidentialToken[];
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
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
    <section className="send-page">
      <div className="send-header">
        <h2>Send Tokens</h2>
        <p>Send confidential tokens to another address.</p>
      </div>
      <FlowCard
        title="Amount"
        token={selected?.metadata}
        underlying={selected?.underlying}
        balance={`${balanceLabel}`}
        selector={
          <select value={selected?.address ?? ""} onChange={(event) => setTokenAddress(event.target.value)}>
            {tokens.length === 0 ? <option value="">No confidential tokens</option> : null}
            {tokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.metadata.symbol}
              </option>
            ))}
          </select>
        }
      >
        <input className="flow-amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0.00" />
      </FlowCard>
      <section className="flow-card">
        <div className="flow-card-head">
          <span>To</span>
        </div>
        <input className="recipient-input" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Wallet address or ENS name" />
        <div className="flow-divider" />
        {recipient && !recipientValid ? <p className="warning">Enter a valid wallet address.</p> : null}
      </section>
      {error ? <p className="warning">{error}</p> : null}
      <button className="primary flow-submit send-submit" disabled={locked || !selected || parsed <= 0n || !recipientValid || busy} onClick={() => void submit()}>
        {locked ? "Connect Sepolia wallet" : busy ? "Sending…" : "Send confidential tokens"}
      </button>
    </section>
  );
}

const DEMO_VAULTS = [
  { name: "Steakhouse Confidential USDC", token: "cUSDC", apy: "7.24%", tvl: "$12.4M", deposit: "0 cUSDC" },
  { name: "Confidential ETH Yield", token: "cWETH", apy: "3.98%", tvl: "$5.1M", deposit: "0 cWETH" },
  { name: "Confidential USDT Prime", token: "cUSDT", apy: "6.55%", tvl: "$8.7M", deposit: "0 cUSDT" }
];

function EarnPage() {
  return (
    <div className="earn-page">
      <div className="demo-banner">Demo — vault integration coming soon. Buttons below are not wired to real contracts.</div>
      <div className="earn-list">
        {DEMO_VAULTS.map((vault) => (
          <div className="earn-card" key={vault.name}>
            <div className="earn-info">
              <strong>{vault.name}</strong>
              <span>{vault.token}</span>
            </div>
            <div className="earn-stats">
              <div className="earn-stat">
                <em>APY</em>
                <span className="earn-apy">{vault.apy}</span>
              </div>
              <div className="earn-stat">
                <em>TVL</em>
                <span>{vault.tvl}</span>
              </div>
              <div className="earn-stat">
                <em>Your deposit</em>
                <span>{vault.deposit}</span>
              </div>
            </div>
            <div className="earn-actions">
              <button className="primary" disabled title="Demo only">Deposit</button>
              <button className="ghost" disabled title="Demo only">Withdraw</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaucetPage({
  pairs,
  account,
  provider,
  locked,
  pushActivity
}: {
  pairs: TokenWrapperPair[];
  account?: Address;
  provider?: EthereumProvider;
  locked: boolean;
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
    <ActionPanel icon={Banknote} locked={locked} title="Claim mock underlying" disabled={!pair || !allowed || busy} submitLabel={busy ? "Claiming" : "Claim"} onSubmit={submit}>
      <PairSelect pairs={faucetPairs} value={pair?.id ?? ""} setValue={setPairId} />
      <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
      {error ? <p className="warning">{error}</p> : null}
      <div className="quote">
        <span>Per-call limit</span>
        <strong>1,000,000 {pair?.underlying.symbol}</strong>
      </div>
      {!allowed && amount ? <p className="warning">Enter an amount from 0 to 1,000,000 tokens.</p> : null}
    </ActionPanel>
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

function ActivityPage({ items }: { items: ActivityItem[] }) {
  return (
    <section className="panel">
      <SectionTitle title="Local activity" action={`${items.length} events`} />
      <div className="activity-list">
        {items.map((item) => (
          <div className="activity-item" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail ?? item.status}</span>
            </div>
            {item.txHash ? <a href={transactionUrl(item.txHash)} target="_blank" rel="noreferrer">{shortAddress(item.txHash)}</a> : <em>{new Date(item.createdAt).toLocaleTimeString()}</em>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ActionPanel({
  icon: Icon,
  locked,
  title,
  children,
  disabled,
  submitLabel,
  onSubmit
}: {
  icon: typeof Shield;
  locked: boolean;
  title: string;
  children: React.ReactNode;
  disabled: boolean;
  submitLabel: string;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <section className="action-panel">
      <div className="action-head">
        <Icon size={24} />
        <h2>{title}</h2>
      </div>
      <div className="form-grid">{children}</div>
      <button className="primary wide" disabled={locked || disabled} onClick={() => void onSubmit()}>
        <ArrowDownUp size={17} />
        {locked ? "Connect Sepolia wallet" : submitLabel}
        <ChevronRight size={17} />
      </button>
    </section>
  );
}

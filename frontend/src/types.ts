import type { Address, Hex } from "viem";

export type PairSource = "official" | "registry" | "local" | "user";

export type TokenMetadata = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  iconUrl?: string;
};

export type LocalPairConfig = {
  id: string;
  source: PairSource;
  underlyingAddress: Address;
  confidentialAddress: Address;
  underlying?: Partial<Omit<TokenMetadata, "address">>;
  confidential?: Partial<Omit<TokenMetadata, "address">>;
  supportsFaucet?: boolean;
  faucetRestricted?: boolean;
  notes?: string;
};

export type ConfidentialKind = "wrapper" | "standalone";

export type TokenWrapperPair = {
  id: string;
  source: PairSource;
  kind: ConfidentialKind;
  underlying: TokenMetadata;
  confidential: TokenMetadata;
  isValid: boolean;
  rate: bigint;
  supportsFaucet: boolean;
  faucetRestricted: boolean;
  notes?: string;
};

export type StandaloneConfidentialToken = {
  id: string;
  source: PairSource;
  confidential: TokenMetadata;
  isValid: boolean;
};

export type BalanceState = {
  publicBalance?: bigint;
  confidentialHandle?: Hex;
  decryptedValue?: bigint;
  lastDecryptedAt?: number;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
};

export type PendingUnwrap = {
  chainId: number;
  wrapper: Address;
  requestId: Hex;
  encryptedHandle?: Hex;
  receiver: Address;
  createdTxHash: Hex;
  status: "requested" | "decrypting" | "ready-to-finalize" | "finalized" | "failed";
  clearValue?: string;
  proof?: Hex;
  createdAt: number;
};

export type ActivityItem = {
  id: string;
  chainId: number;
  account?: Address;
  type: "faucet" | "approve" | "wrap" | "unwrap-request" | "unwrap-finalize" | "decrypt" | "add-token" | "send";
  status: "pending" | "success" | "failed" | "info";
  title: string;
  detail?: string;
  txHash?: Hex;
  createdAt: number;
  // Optional structured fields for the Activity table (token column + amount column).
  tokenSymbol?: string;
  tokenIconUrl?: string;
  tokenConfidential?: boolean;
  amount?: string;
};

export type AddedToken = {
  id: string;
  category: "erc20" | "ctoken" | "verified-ctoken";
  address: Address;
  label?: string;
  iconUrl?: string;
  createdAt: number;
};

export type SdkState =
  | { status: "deferred" }
  | { status: "initializing" }
  | { status: "ready"; instance?: unknown }
  | { status: "failed"; error: string };

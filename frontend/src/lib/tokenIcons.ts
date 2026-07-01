import type { Address } from "viem";
import { SEPOLIA_CHAIN_ID } from "../config/chains";
import type { TokenMetadata } from "../types";

export type TokenIconSource = "local" | "token-list" | "user" | "fallback";

export type ResolvedTokenIcon = {
  url?: string;
  source: TokenIconSource;
};

export type TokenListEntry = {
  chainId: number;
  address: string;
  logoURI?: string;
};

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

const officialIconByAddress: Record<string, string> = {
  "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png",
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
  "0xff54739b16576fa5402f211d0b938469ab9a5f3f": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png",
  "0x24377ae4aa0c45ecee71225007f17c5d423dd940": "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x68749665FF8D2d112Fa859AA293F07A622782F38/logo.png"
};

export function normalizeIconUrl(url?: string): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("ipfs://")) return `${IPFS_GATEWAY}${trimmed.slice("ipfs://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;
  return undefined;
}

export function resolveTokenIcon(
  token: Pick<TokenMetadata, "address" | "iconUrl">,
  tokenList: TokenListEntry[] = [],
  chainId = SEPOLIA_CHAIN_ID
): ResolvedTokenIcon {
  const explicit = normalizeIconUrl(token.iconUrl);
  if (explicit) return { url: explicit, source: "user" };

  const local = officialIconByAddress[token.address.toLowerCase()];
  if (local) return { url: local, source: "local" };

  const listed = tokenList.find((entry) => entry.chainId === chainId && entry.address.toLowerCase() === token.address.toLowerCase());
  const listedUrl = normalizeIconUrl(listed?.logoURI);
  if (listedUrl) return { url: listedUrl, source: "token-list" };

  return { source: "fallback" };
}

export function iconForConfidentialToken(confidential: Pick<TokenMetadata, "address" | "iconUrl">, underlying?: Pick<TokenMetadata, "address" | "iconUrl">): ResolvedTokenIcon {
  const own = resolveTokenIcon(confidential);
  if (own.url) return own;
  return underlying ? resolveTokenIcon(underlying) : own;
}


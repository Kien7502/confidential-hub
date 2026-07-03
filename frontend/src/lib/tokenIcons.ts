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
  "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff": "/tokens/usdc.png",
  "0x7c5bf43b851c1dff1a4fee8db225b87f2c223639": "/tokens/usdc.png",
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0": "/tokens/usdt.png",
  "0x4e7b06d78965594eb5ef5414c357ca21e1554491": "/tokens/usdt.png",
  "0xff54739b16576fa5402f211d0b938469ab9a5f3f": "/tokens/weth.png",
  "0x46208622da27d91db4f0393733c8ba082ed83158": "/tokens/weth.png",
  "0x75355a85c6fb9df5f0c80ff54e8747eee9a0bf57": "/tokens/zama.png",
  "0xf2d628d2598af4eaf94cb76a437ff86ca78ffbfb": "/tokens/zama.png",
  "0x24377ae4aa0c45ecee71225007f17c5d423dd940": "/tokens/xaut.png",
  "0xe4fcf848739845bc81dee1d5352cf3844f0a60c7": "/tokens/xaut.png"
};

export function normalizeIconUrl(url?: string): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("ipfs://")) return `${IPFS_GATEWAY}${trimmed.slice("ipfs://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
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

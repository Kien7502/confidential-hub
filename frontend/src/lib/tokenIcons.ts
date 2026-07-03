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
  // USDC
  "0x9b5cd13b8efbb58dc25a05cf411d8056058adfff": "/tokens-icon/USDC.svg",
  "0x7c5bf43b851c1dff1a4fee8db225b87f2c223639": "/tokens-icon/USDC.svg",
  // USDT
  "0xa7da08fafdc9097cc0e7d4f113a61e31d7e8e9b0": "/tokens-icon/USDT.svg",
  "0x4e7b06d78965594eb5ef5414c357ca21e1554491": "/tokens-icon/USDT.svg",
  // WETH
  "0xff54739b16576fa5402f211d0b938469ab9a5f3f": "/tokens-icon/WETH.svg",
  "0x46208622da27d91db4f0393733c8ba082ed83158": "/tokens-icon/WETH.svg",
  // ZAMA
  "0x75355a85c6fb9df5f0c80ff54e8747eee9a0bf57": "/tokens-icon/ZAMA.svg",
  "0xf2d628d2598af4eaf94cb76a437ff86ca78ffbfb": "/tokens-icon/ZAMA.svg",
  // XAUt
  "0x24377ae4aa0c45ecee71225007f17c5d423dd940": "/tokens-icon/XAUt.svg",
  "0xe4fcf848739845bc81dee1d5352cf3844f0a60c7": "/tokens-icon/XAUt.svg",
  // BRON
  "0xff021fb13ca64e5354c62c954b949a88cfdeb25e": "/tokens-icon/BRON.png",
  "0xaa5612fa27c927a0c7961f5aefee5ba3a0f9c891": "/tokens-icon/BRON.png",
  // tGBP mock
  "0x93c931278a2aad1916783f952f94276ea5111442": "/tokens-icon/tGBP.svg",
  "0xfce5c7069c5525ef6c8c2b2e35a745ba20a2f7cc": "/tokens-icon/tGBP.svg",
  // tGBP official
  "0xf6ef9adb61a48e29e36bc873070a46a3d2667ff3": "/tokens-icon/tGBP.svg",
  "0x167dc962808b32cfffc7e14b5018c0be06a3a208": "/tokens-icon/tGBP.svg"
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

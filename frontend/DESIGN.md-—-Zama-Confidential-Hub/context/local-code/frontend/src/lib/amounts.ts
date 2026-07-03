import { formatUnits, parseUnits } from "viem";

export function parseTokenAmount(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!normalized || Number(normalized) <= 0) return 0n;
  return parseUnits(normalized, decimals);
}

export function formatTokenAmount(value: bigint | undefined, decimals: number, maxFraction = 6): string {
  if (value === undefined) return "-";
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function estimateWrappedAmount(underlyingAmount: bigint, rate: bigint): bigint {
  if (rate <= 0n) return 0n;
  return underlyingAmount / rate;
}

export function isFaucetAmountAllowed(amount: bigint, decimals: number, maxWholeTokens: bigint): boolean {
  return amount > 0n && amount <= maxWholeTokens * 10n ** BigInt(decimals);
}

export function cacheKey(chainId: number, account: string, token: string, handle: string): string {
  return `${chainId}:${account.toLowerCase()}:${token.toLowerCase()}:${handle.toLowerCase()}`;
}

import type { AddedToken, StandaloneConfidentialToken, TokenMetadata, TokenWrapperPair } from "../types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type DashboardRow = {
  id: string;
  pair?: TokenWrapperPair;
  underlying?: TokenMetadata;
  confidential?: TokenMetadata;
  source: TokenWrapperPair["source"];
  complete: boolean;
  canShield: boolean;
  canUnshield: boolean;
};

function sameAddress(a?: string, b?: string) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function hasToken(token?: TokenMetadata) {
  return Boolean(token && token.address.toLowerCase() !== ZERO_ADDRESS);
}

export function pairIsActionable(pair?: TokenWrapperPair) {
  if (!pair || pair.kind !== "wrapper" || !hasToken(pair.underlying) || !hasToken(pair.confidential)) return false;
  if (pair.source === "user" || pair.source === "local") return true;
  return pair.isValid;
}

export function buildOfficialRows(pairs: TokenWrapperPair[]): DashboardRow[] {
  return pairs.map((pair) => ({
    id: pair.id,
    pair,
    underlying: pair.underlying,
    confidential: pair.confidential,
    source: pair.source,
    complete: hasToken(pair.underlying) && hasToken(pair.confidential),
    canShield: pairIsActionable(pair),
    canUnshield: pairIsActionable(pair)
  }));
}

function pairScore(pair: TokenWrapperPair) {
  return (pairIsActionable(pair) ? 4 : 0) + (hasToken(pair.confidential) ? 2 : 0) + (pair.isValid ? 1 : 0);
}

function bestByAddress(pairs: TokenWrapperPair[], addressFor: (pair: TokenWrapperPair) => string) {
  const byAddress = new Map<string, TokenWrapperPair>();
  for (const pair of pairs) {
    const key = addressFor(pair).toLowerCase();
    const existing = byAddress.get(key);
    if (!existing || pairScore(pair) > pairScore(existing)) {
      byAddress.set(key, pair);
    }
  }
  return Array.from(byAddress.values());
}

export function uniqueShieldPairs(pairs: TokenWrapperPair[]) {
  return bestByAddress(
    pairs.filter((pair) => hasToken(pair.underlying)),
    (pair) => pair.underlying.address
  );
}

export function uniqueUnshieldPairs(pairs: TokenWrapperPair[]) {
  return bestByAddress(
    pairs.filter((pair) => pairIsActionable(pair)),
    (pair) => pair.confidential.address
  );
}

export function buildUserRows(addedTokens: AddedToken[], addedPairs: TokenWrapperPair[], standaloneTokens: StandaloneConfidentialToken[]): DashboardRow[] {
  const rows: DashboardRow[] = [];
  const used = new Set<string>();

  for (const token of addedTokens) {
    if (token.category !== "erc20") continue;
    const erc20Pair = addedPairs.find((pair) => pair.id === token.id || sameAddress(pair.underlying.address, token.address));
    if (!erc20Pair) continue;
    const matchingWrapper = addedPairs.find((pair) => pair.id !== erc20Pair.id && hasToken(pair.confidential) && sameAddress(pair.underlying.address, erc20Pair.underlying.address));
    const pair = matchingWrapper ?? erc20Pair;
    used.add(erc20Pair.id);
    if (matchingWrapper) used.add(matchingWrapper.id);
    rows.push({
      id: `user-erc20-${token.id}`,
      pair,
      underlying: erc20Pair.underlying,
      confidential: matchingWrapper?.confidential,
      source: "user",
      complete: Boolean(matchingWrapper),
      canShield: pairIsActionable(matchingWrapper),
      canUnshield: pairIsActionable(matchingWrapper)
    });
  }

  for (const token of addedTokens) {
    if (token.category === "erc20") continue;
    const wrapperPair = addedPairs.find((pair) => pair.id === token.id || sameAddress(pair.confidential.address, token.address));
    if (!wrapperPair || used.has(wrapperPair.id)) continue;
    const matchingUnderlying = addedPairs.find((pair) => pair.id !== wrapperPair.id && sameAddress(pair.underlying.address, wrapperPair.underlying.address) && !hasToken(pair.confidential));
    rows.push({
      id: `user-ctoken-${token.id}`,
      pair: wrapperPair,
      underlying: matchingUnderlying?.underlying,
      confidential: wrapperPair.confidential,
      source: "user",
      complete: Boolean(matchingUnderlying),
      canShield: Boolean(matchingUnderlying) && pairIsActionable(wrapperPair),
      canUnshield: pairIsActionable(wrapperPair)
    });
  }

  for (const token of standaloneTokens) {
    rows.push({
      id: `standalone-${token.id}`,
      confidential: token.confidential,
      source: token.source,
      complete: false,
      canShield: false,
      canUnshield: false
    });
  }

  return rows;
}

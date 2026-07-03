export type TokenPriceMap = Record<string, number>;

const COINGECKO_IDS: Record<string, string> = {
  USDC: "usd-coin",
  USDT: "tether",
  WETH: "weth",
  ETH: "ethereum",
  XAUT: "tether-gold",
  ZAMA: "zama"
};

export function priceLookupSymbol(symbol?: string) {
  if (!symbol) return undefined;
  const normalized = symbol.replace(/^c/i, "").replace(/mock$/i, "").toUpperCase();
  return COINGECKO_IDS[normalized] ? normalized : undefined;
}

export async function loadTokenPrices(symbols: string[]): Promise<TokenPriceMap> {
  const uniqueSymbols = Array.from(new Set(symbols.map(priceLookupSymbol).filter(Boolean) as string[]));
  const ids = uniqueSymbols.map((symbol) => COINGECKO_IDS[symbol]).filter(Boolean);
  if (ids.length === 0) return {};

  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`);
  if (!response.ok) throw new Error(`Price request failed: ${response.status}`);
  const payload = (await response.json()) as Record<string, { usd?: number }>;

  return uniqueSymbols.reduce<TokenPriceMap>((prices, symbol) => {
    const price = payload[COINGECKO_IDS[symbol]]?.usd;
    if (typeof price === "number" && Number.isFinite(price)) {
      prices[symbol] = price;
    }
    return prices;
  }, {});
}

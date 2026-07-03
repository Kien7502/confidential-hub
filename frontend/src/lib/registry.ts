import { createPublicClient, getAddress, http, type Address, type PublicClient } from "viem";
import { erc20Abi, erc7984Abi, registryAbi, wrapperAbi } from "../config/abis";
import { WRAPPERS_REGISTRY_ADDRESS, sepolia } from "../config/chains";
import { localPairs } from "../config/localPairs";
import { officialPairs } from "../config/officialPairs";
import type { AddedToken, LocalPairConfig, PairSource, StandaloneConfidentialToken, TokenMetadata, TokenWrapperPair } from "../types";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

type RegistryPair = {
  tokenAddress: Address;
  confidentialTokenAddress: Address;
  isValid: boolean;
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

async function readString(client: PublicClient, address: Address, abi: typeof erc20Abi, name: "name" | "symbol", fallback: string): Promise<string> {
  try {
    return (await client.readContract({ address, abi, functionName: name })) as string;
  } catch {
    return fallback;
  }
}

async function readDecimals(client: PublicClient, address: Address, abi: typeof erc20Abi, fallback: number): Promise<number> {
  try {
    return Number(await client.readContract({ address, abi, functionName: "decimals" }));
  } catch {
    return fallback;
  }
}

async function metadata(client: PublicClient, address: Address, overrides?: Partial<Omit<TokenMetadata, "address">>): Promise<TokenMetadata> {
  const fallbackSymbol = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return {
    address,
    name: overrides?.name ?? (await readString(client, address, erc20Abi, "name", fallbackSymbol)),
    symbol: overrides?.symbol ?? (await readString(client, address, erc20Abi, "symbol", fallbackSymbol)),
    decimals: overrides?.decimals ?? (await readDecimals(client, address, erc20Abi, 18)),
    iconUrl: overrides?.iconUrl
  };
}

async function readRegistryPairs(client: PublicClient): Promise<RegistryPair[]> {
  try {
    return (await client.readContract({
      address: WRAPPERS_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "getTokenConfidentialTokenPairs"
    })) as RegistryPair[];
  } catch {
    const length = Number(await client.readContract({
      address: WRAPPERS_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "getTokenConfidentialTokenPairsLength"
    }));
    if (length === 0) return [];
    return (await client.readContract({
      address: WRAPPERS_REGISTRY_ADDRESS,
      abi: registryAbi,
      functionName: "getTokenConfidentialTokenPairsSlice",
      args: [0n, BigInt(length)]
    })) as RegistryPair[];
  }
}

export function mergePairConfigs(registryPairs: RegistryPair[], configPairs: LocalPairConfig[]): LocalPairConfig[] {
  const merged = new Map<string, LocalPairConfig>();
  for (const pair of configPairs) {
    merged.set(pair.confidentialAddress.toLowerCase(), pair);
  }
  for (const pair of registryPairs) {
    if (sameAddress(pair.tokenAddress, zeroAddress) || sameAddress(pair.confidentialTokenAddress, zeroAddress)) continue;
    const key = pair.confidentialTokenAddress.toLowerCase();
    const existing = merged.get(key);
    merged.set(key, {
      id: existing?.id ?? `registry-${pair.confidentialTokenAddress.toLowerCase()}`,
      source: existing?.source === "official" ? "official" : "registry",
      underlyingAddress: getAddress(pair.tokenAddress),
      confidentialAddress: getAddress(pair.confidentialTokenAddress),
      underlying: existing?.underlying,
      confidential: existing?.confidential,
      supportsFaucet: existing?.supportsFaucet ?? false,
      faucetRestricted: existing?.faucetRestricted ?? false,
      notes: existing?.notes
    });
  }
  return [...merged.values()];
}

export async function loadPairs(client = publicClient): Promise<TokenWrapperPair[]> {
  let registryPairs: RegistryPair[] = [];
  try {
    registryPairs = await readRegistryPairs(client);
  } catch {
    registryPairs = [];
  }

  // Only surface pairs backed by our curated config (official + local).
  // Registry-only entries (e.g. third-party vault tokens like steakcUSDC)
  // are dropped so the app shows a clean, known token set.
  const configs = mergePairConfigs(registryPairs, [...officialPairs, ...localPairs]).filter(
    (config) => config.source !== "registry"
  );
  return Promise.all(
    configs.map(async (config) => {
      const [underlying, confidential, rate, isValid] = await Promise.all([
        metadata(client, config.underlyingAddress, config.underlying),
        metadata(client, config.confidentialAddress, config.confidential),
        client.readContract({ address: config.confidentialAddress, abi: wrapperAbi, functionName: "rate" }).catch(() => 1n),
        client
          .readContract({
            address: WRAPPERS_REGISTRY_ADDRESS,
            abi: registryAbi,
            functionName: "isConfidentialTokenValid",
            args: [config.confidentialAddress]
          })
          .catch(() => config.source === "official")
      ]);
      return {
        id: config.id,
        source: config.source as PairSource,
        kind: "wrapper" as const,
        underlying,
        confidential,
        isValid: Boolean(isValid),
        rate: BigInt(rate),
        supportsFaucet: Boolean(config.supportsFaucet),
        faucetRestricted: Boolean(config.faucetRestricted),
        notes: config.notes
      };
    })
  );
}

export async function readConfidentialHandle(client: PublicClient, token: Address, account: Address) {
  return client.readContract({ address: token, abi: erc7984Abi, functionName: "confidentialBalanceOf", args: [account] });
}

export type AddedTokenKind = "wrapper" | "standalone" | "erc20";

/**
 * Detects the on-chain kind of a token by feature-probing:
 * - `wrapper`: exposes `underlying()` returning a non-zero address (ERC7984ERC20Wrapper).
 * - `standalone`: exposes `confidentialBalanceOf()` (plain ERC7984, no wrap/unwrap).
 * - `erc20`: neither confidential entrypoint responds (a plain public ERC20).
 */
export async function detectAddedTokenKind(client: PublicClient, address: Address): Promise<AddedTokenKind> {
  const underlying = await client
    .readContract({ address, abi: wrapperAbi, functionName: "underlying" })
    .catch(() => undefined);
  if (underlying && !sameAddress(underlying as string, zeroAddress)) return "wrapper";

  const confidential = await readConfidentialHandle(client, address, zeroAddress as Address).catch(() => undefined);
  if (confidential !== undefined) return "standalone";

  return "erc20";
}

/**
 * Resolves user-added token addresses into dashboard entries, detecting each token's
 * kind on-chain. A single bad token never breaks the whole list (each probe is guarded).
 */
export async function loadAddedTokens(
  added: AddedToken[],
  client = publicClient
): Promise<{ pairs: TokenWrapperPair[]; standalone: StandaloneConfidentialToken[] }> {
  const pairs: TokenWrapperPair[] = [];
  const standalone: StandaloneConfidentialToken[] = [];

  await Promise.all(
    added.map(async (token) => {
      try {
        const kind = await detectAddedTokenKind(client, token.address);

        if (kind === "wrapper") {
          const underlyingAddress = getAddress(
            (await client.readContract({ address: token.address, abi: wrapperAbi, functionName: "underlying" })) as string
          );
          const [underlying, confidential, rate, isValid] = await Promise.all([
            metadata(client, underlyingAddress),
            metadata(client, token.address, { iconUrl: token.iconUrl }),
            client.readContract({ address: token.address, abi: wrapperAbi, functionName: "rate" }).catch(() => 1n),
            client
              .readContract({ address: WRAPPERS_REGISTRY_ADDRESS, abi: registryAbi, functionName: "isConfidentialTokenValid", args: [token.address] })
              .catch(() => false)
          ]);
          pairs.push({
            id: token.id,
            source: "user",
            kind: "wrapper",
            underlying,
            confidential,
            isValid: Boolean(isValid),
            rate: BigInt(rate),
            supportsFaucet: false,
            faucetRestricted: false,
            notes: token.label
          });
          return;
        }

        if (kind === "standalone") {
          const confidential = await metadata(client, token.address, { iconUrl: token.iconUrl });
          standalone.push({ id: token.id, source: "user", confidential, isValid: true });
          return;
        }

        // Plain ERC20: render as a pair missing its confidential side (State 2).
        const underlying = await metadata(client, token.address, { iconUrl: token.iconUrl });
        pairs.push({
          id: token.id,
          source: "user",
          kind: "wrapper",
          underlying,
          confidential: { address: zeroAddress as Address, name: "", symbol: "", decimals: 0 },
          isValid: false,
          rate: 1n,
          supportsFaucet: false,
          faucetRestricted: false,
          notes: token.label
        });
      } catch {
        // Skip tokens that fail to resolve rather than breaking the dashboard.
      }
    })
  );

  return { pairs, standalone };
}

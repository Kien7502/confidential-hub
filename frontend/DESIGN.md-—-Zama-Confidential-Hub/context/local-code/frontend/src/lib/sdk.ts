import type { SdkState } from "../types";
import type { Address, Hex } from "viem";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

let sdkCoreReady: Promise<unknown> | undefined;

function formatSdkError(error: unknown): string {
  if (error instanceof Error) {
    const cause = "cause" in error && error.cause instanceof Error ? ` (${error.cause.message})` : "";
    return `${error.message}${cause}`;
  }
  return "Unable to initialize Zama SDK";
}

export async function initializeZamaSdk(): Promise<SdkState> {
  try {
    const sdk = await import("@zama-fhe/relayer-sdk/web");
    if (!sdkCoreReady && typeof sdk.initSDK === "function") {
      // Run single-threaded by default. The multi-threaded TFHE path relies on
      // SharedArrayBuffer, which needs cross-origin isolation (COOP/COEP) headers
      // and otherwise fails with "memory import N pages smaller than declared".
      // Enabling COEP would also break Privy/WalletConnect popups, so we opt out
      // unless VITE_ZAMA_THREADS is explicitly set.
      const threadEnv = Number(import.meta.env.VITE_ZAMA_THREADS);
      const thread = Number.isFinite(threadEnv) && threadEnv > 0 ? threadEnv : 0;
      sdkCoreReady = Promise.resolve(sdk.initSDK({ thread }));
    }
    await sdkCoreReady;
    return { status: "ready" };
  } catch (error) {
    return { status: "failed", error: formatSdkError(error) };
  }
}

export async function createZamaInstance(provider?: EthereumProvider): Promise<FhevmInstance> {
  if (!provider) throw new Error("Wallet provider not found");
  const coreState = await initializeZamaSdk();
  if (coreState.status === "failed") {
    throw new Error(coreState.error);
  }
  if (coreState.status !== "ready") {
    throw new Error("Zama SDK is still initializing");
  }
  const sdk = await import("@zama-fhe/relayer-sdk/web");
  // SepoliaConfig (0.4.x) already targets relayer.testnet.zama.org with the v2
  // route, so no relayerUrl override is needed anymore.
  return sdk.createInstance({ ...sdk.SepoliaConfig, network: provider });
}

export type UserDecryptPermit = {
  privateKey: string;
  publicKey: string;
  signature: Hex;
  contractAddresses: Address[];
  startTimestamp: number;
  durationDays: number;
};

export type TypedDataSigner = (typedData: unknown) => Promise<Hex>;

// createEIP712 (relayer-sdk 0.4.x) returns a typed-data object whose
// domain.chainId is a bigint. Both JSON.stringify (for eth_signTypedData_v4)
// and most wallet signers choke on BigInt, so normalize them to a JSON-safe
// form: numbers when within safe-integer range, otherwise decimal strings.
function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "bigint"
        ? (val <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(val) : val.toString())
        : val
    )
  );
}

export async function signUserDecryptPermit(
  instance: FhevmInstance,
  provider: EthereumProvider,
  account: Address,
  contractAddresses: Address[],
  signer?: TypedDataSigner
): Promise<UserDecryptPermit> {
  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 7;
  const eip712 = toJsonSafe(instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays));
  const signature = signer
    ? await signer(eip712)
    : (await provider.request({
        method: "eth_signTypedData_v4",
        params: [account, JSON.stringify(eip712)]
      })) as Hex;

  return {
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    signature,
    contractAddresses,
    startTimestamp,
    durationDays
  };
}

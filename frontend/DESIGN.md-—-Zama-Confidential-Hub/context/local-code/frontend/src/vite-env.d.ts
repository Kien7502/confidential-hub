/// <reference types="vite/client" />

declare module "@zama-fhe/relayer-sdk/web" {
  export const SepoliaConfig: Record<string, unknown> & {
    chainId: number;
    verifyingContractAddressDecryption: string;
    relayerUrl: string;
  };
  export function initSDK(options?: {
    tfheParams?: unknown;
    kmsParams?: unknown;
    thread?: number;
  }): Promise<boolean>;
  export function createInstance(config: Record<string, unknown>): Promise<FhevmInstance>;

  export type FhevmInstance = {
    createEncryptedInput(contractAddress: string, userAddress: string): any;
    generateKeypair(): { publicKey: string; privateKey: string };
    createEIP712(
      publicKey: string,
      contractAddresses: string[],
      startTimestamp: number,
      durationDays: number
    ): unknown;
    userDecrypt(
      handles: { handle: string; contractAddress: string }[],
      privateKey: string,
      publicKey: string,
      signature: string,
      contractAddresses: string[],
      userAddress: string,
      startTimestamp: number,
      durationDays: number
    ): Promise<Record<string, string | bigint | boolean>>;
    publicDecrypt(handles: (string | Uint8Array)[]): Promise<any>;
  };
}

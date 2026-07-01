import { createWalletClient, custom, decodeEventLog, encodeFunctionData, getAddress, type Abi, type Address, type Hex } from "viem";
import { erc20Abi, erc7984Abi, wrapperAbi } from "../config/abis";
import { sepolia } from "../config/chains";
import type { EthereumProvider } from "./sdk";
import { publicClient } from "./registry";

export function walletClient(provider?: EthereumProvider) {
  if (!provider) throw new Error("Wallet provider not found");
  return createWalletClient({ chain: sepolia, transport: custom(provider) });
}

export async function mintFaucet(provider: EthereumProvider, token: Address, account: Address, amount: bigint): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account,
    to: token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "mint", args: [account, amount] })
  });
}

/** Mint a cleartext amount of a standalone ERC7984 token (uint64 raw units). */
export async function mintConfidential(provider: EthereumProvider, token: Address, account: Address, amount: bigint): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account,
    to: token,
    data: encodeFunctionData({ abi: erc7984Abi, functionName: "mint", args: [account, amount] })
  });
}

/** Send confidential tokens to `to` using an encrypted amount handle + input proof. */
export async function confidentialTransfer(
  provider: EthereumProvider,
  token: Address,
  account: Address,
  to: Address,
  encryptedHandle: Hex,
  inputProof: Hex
): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account,
    to: token,
    data: encodeFunctionData({ abi: erc7984Abi, functionName: "confidentialTransfer", args: [to, encryptedHandle, inputProof] })
  });
}

export async function readAllowance(token: Address, owner: Address, spender: Address): Promise<bigint> {
  return publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
}

export async function approveToken(provider: EthereumProvider, token: Address, owner: Address, spender: Address, amount: bigint): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account: owner,
    to: token,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] })
  });
}

export async function waitForTransactionSuccess(hash: Hex): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${hash}`);
  }
}

export async function wrapToken(provider: EthereumProvider, wrapper: Address, account: Address, amount: bigint): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account,
    to: wrapper,
    data: encodeFunctionData({ abi: wrapperAbi, functionName: "wrap", args: [account, amount] })
  });
}

export async function requestUnwrap(provider: EthereumProvider, wrapper: Address, account: Address, encryptedHandle: Hex, inputProof: Hex): Promise<{ txHash: Hex; requestId?: Hex }> {
  const client = walletClient(provider);
  const txHash = await client.sendTransaction({
    account,
    to: wrapper,
    data: encodeFunctionData({ abi: wrapperAbi, functionName: "unwrap", args: [account, account, encryptedHandle, inputProof] })
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const decoded = receipt.logs
    .filter((log) => log.address.toLowerCase() === wrapper.toLowerCase())
    .map((log) => {
      try {
        return decodeEventLog({ abi: wrapperAbi, data: log.data, topics: log.topics });
      } catch {
        return undefined;
      }
    })
    .find((log) => log?.eventName === "UnwrapRequested");
  const requestId = decoded?.args?.unwrapRequestId as Hex | undefined;
  return { txHash, requestId };
}

export async function finalizeUnwrap(provider: EthereumProvider, wrapper: Address, account: Address, requestId: Hex, clearValue: bigint, proof: Hex): Promise<Hex> {
  const client = walletClient(provider);
  return client.sendTransaction({
    account,
    to: getAddress(wrapper),
    data: encodeFunctionData({ abi: wrapperAbi, functionName: "finalizeUnwrap", args: [requestId, clearValue, proof] })
  });
}

export async function deployContract(
  provider: EthereumProvider,
  account: Address,
  artifact: { abi: Abi; bytecode: Hex | string },
  args: unknown[]
): Promise<{ txHash: Hex; address: Address }> {
  const client = walletClient(provider);
  const txHash = await client.deployContract({
    account,
    abi: artifact.abi,
    bytecode: artifact.bytecode as Hex,
    args
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Contract deployment failed: ${txHash}`);
  }
  return { txHash, address: getAddress(receipt.contractAddress) };
}

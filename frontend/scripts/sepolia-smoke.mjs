import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  parseUnits
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const registryAddress = "0x2f0750Bbb0A246059d80e94c454586a7F27a128e";

const pairs = {
  cUSDCMock: {
    underlying: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
    wrapper: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639"
  },
  cUSDTMock: {
    underlying: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
    wrapper: "0x4E7B06D78965594eB5EF5414c357ca21E1554491"
  },
  cWETHMock: {
    underlying: "0xff54739b16576FA5402F211D0b938469Ab9A5f3F",
    wrapper: "0x46208622DA27d91db4f0393733C8BA082ed83158"
  },
  cBRONMock: {
    underlying: "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E",
    wrapper: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891"
  },
  cZAMAMock: {
    underlying: "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57",
    wrapper: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB"
  },
  ctGBPMock: {
    underlying: "0x93c931278A2aad1916783F952f94276eA5111442",
    wrapper: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC"
  },
  cXAUtMock: {
    underlying: "0x24377AE4AA0C45ecEe71225007f17c5D423dd940",
    wrapper: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7"
  }
};

const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }
];

const erc7984Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bytes32" }] }
];

const registryAbi = [
  { type: "function", name: "getTokenConfidentialTokenPairsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getConfidentialTokenAddress", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "isValid", type: "bool" }, { name: "confidentialToken", type: "address" }] },
  { type: "function", name: "isConfidentialTokenValid", stateMutability: "view", inputs: [{ name: "confidentialToken", type: "address" }], outputs: [{ type: "bool" }] }
];

const wrapperAbi = [
  { type: "function", name: "rate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "underlying", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "wrap", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }
];

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.test.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function env(name, fallback) {
  return process.env[name] ?? fallback;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.includes("0000000000000000000000000000000000000000000000000000000000000000")) {
    throw new Error(`Missing ${name}. Copy .env.test.local.example to .env.test.local and fill it.`);
  }
  return value.startsWith("0x") ? value : `0x${value}`;
}

async function wait(client, hash, confirmations) {
  console.log(`  tx: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations });
  console.log(`  status: ${receipt.status}, gasUsed: ${receipt.gasUsed}`);
  if (receipt.status !== "success") throw new Error(`Transaction failed: ${hash}`);
  return receipt;
}

async function main() {
  loadLocalEnv();
  const privateKey = requiredEnv("SEPOLIA_PRIVATE_KEY");
  const rpcUrl = env("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com");
  const pairName = env("SEPOLIA_TEST_PAIR", "cUSDCMock");
  const pair = pairs[pairName];
  if (!pair) throw new Error(`Unknown SEPOLIA_TEST_PAIR=${pairName}`);

  const enableTxs = env("SEPOLIA_ENABLE_TXS", "false").toLowerCase() === "true";
  const confirmations = Number(env("SEPOLIA_CONFIRMATIONS", "1"));
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });

  console.log(`Sepolia smoke account: ${account.address}`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Pair: ${pairName}`);

  const chainId = await publicClient.getChainId();
  if (chainId !== 11155111) throw new Error(`RPC returned chain ${chainId}, expected Sepolia 11155111`);

  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance: ${formatEther(ethBalance)} ETH`);
  if (ethBalance === 0n) throw new Error("Account has no Sepolia ETH for gas.");

  const registryLength = await publicClient.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getTokenConfidentialTokenPairsLength"
  });
  console.log(`Registry pairs length: ${registryLength}`);

  const [isMappedValid, mappedWrapper] = await publicClient.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getConfidentialTokenAddress",
    args: [pair.underlying]
  });
  console.log(`Registry mapping valid: ${isMappedValid}, wrapper: ${mappedWrapper}`);
  if (getAddress(mappedWrapper) !== getAddress(pair.wrapper)) {
    throw new Error(`Registry wrapper mismatch. Expected ${pair.wrapper}, got ${mappedWrapper}`);
  }

  const isWrapperValid = await publicClient.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "isConfidentialTokenValid",
    args: [pair.wrapper]
  });
  if (!isWrapperValid) throw new Error(`${pair.wrapper} is not valid in registry.`);

  const [underlyingSymbol, underlyingDecimals, wrapperSymbol, wrapperDecimals, rate, wrapperUnderlying] = await Promise.all([
    publicClient.readContract({ address: pair.underlying, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address: pair.underlying, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: pair.wrapper, abi: erc7984Abi, functionName: "symbol" }),
    publicClient.readContract({ address: pair.wrapper, abi: erc7984Abi, functionName: "decimals" }),
    publicClient.readContract({ address: pair.wrapper, abi: wrapperAbi, functionName: "rate" }),
    publicClient.readContract({ address: pair.wrapper, abi: wrapperAbi, functionName: "underlying" })
  ]);

  console.log(`Underlying: ${underlyingSymbol} decimals=${underlyingDecimals}`);
  console.log(`Wrapper: ${wrapperSymbol} decimals=${wrapperDecimals} rate=${rate}`);
  if (getAddress(wrapperUnderlying) !== getAddress(pair.underlying)) {
    throw new Error(`Wrapper underlying mismatch. Expected ${pair.underlying}, got ${wrapperUnderlying}`);
  }

  const amount = parseUnits(env("SEPOLIA_TEST_AMOUNT", "1"), underlyingDecimals);
  const beforeUnderlying = await publicClient.readContract({
    address: pair.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  });
  const beforeHandle = await publicClient.readContract({
    address: pair.wrapper,
    abi: erc7984Abi,
    functionName: "confidentialBalanceOf",
    args: [account.address]
  });
  console.log(`Underlying balance before: ${formatUnits(beforeUnderlying, underlyingDecimals)} ${underlyingSymbol}`);
  console.log(`Confidential handle before: ${beforeHandle}`);

  if (!enableTxs) {
    console.log("Read-only smoke completed. Set SEPOLIA_ENABLE_TXS=true to mint, approve, and wrap.");
    return;
  }

  console.log(`Minting ${formatUnits(amount, underlyingDecimals)} ${underlyingSymbol}`);
  await wait(
    publicClient,
    await walletClient.writeContract({
      address: pair.underlying,
      abi: erc20Abi,
      functionName: "mint",
      args: [account.address, amount]
    }),
    confirmations
  );

  const allowance = await publicClient.readContract({
    address: pair.underlying,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, pair.wrapper]
  });
  if (allowance < amount) {
    console.log(`Approving ${wrapperSymbol} to spend ${underlyingSymbol}`);
    await wait(
      publicClient,
      await walletClient.writeContract({
        address: pair.underlying,
        abi: erc20Abi,
        functionName: "approve",
        args: [pair.wrapper, amount]
      }),
      confirmations
    );
  } else {
    console.log("Existing allowance is sufficient.");
  }

  console.log(`Wrapping ${formatUnits(amount, underlyingDecimals)} ${underlyingSymbol}`);
  await wait(
    publicClient,
    await walletClient.writeContract({
      address: pair.wrapper,
      abi: wrapperAbi,
      functionName: "wrap",
      args: [account.address, amount]
    }),
    confirmations
  );

  const afterUnderlying = await publicClient.readContract({
    address: pair.underlying,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address]
  });
  const afterHandle = await publicClient.readContract({
    address: pair.wrapper,
    abi: erc7984Abi,
    functionName: "confidentialBalanceOf",
    args: [account.address]
  });
  console.log(`Underlying balance after: ${formatUnits(afterUnderlying, underlyingDecimals)} ${underlyingSymbol}`);
  console.log(`Confidential handle after: ${afterHandle}`);
  console.log("Tx smoke completed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

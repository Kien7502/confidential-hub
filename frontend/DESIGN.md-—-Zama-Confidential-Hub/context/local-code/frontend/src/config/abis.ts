export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }
] as const;

export const erc7984Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint64" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "confidentialTransfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "encryptedAmount", type: "bytes32" }, { name: "inputProof", type: "bytes" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "supportsInterface", stateMutability: "view", inputs: [{ name: "interfaceId", type: "bytes4" }], outputs: [{ type: "bool" }] }
] as const;

export const wrapperAbi = [
  { type: "function", name: "underlying", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "rate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "wrap", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "unwrap", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "encryptedAmount", type: "bytes32" }, { name: "inputProof", type: "bytes" }], outputs: [] },
  { type: "function", name: "finalizeUnwrap", stateMutability: "nonpayable", inputs: [{ name: "unwrapRequestId", type: "bytes32" }, { name: "unwrapAmountCleartext", type: "uint64" }, { name: "decryptionProof", type: "bytes" }], outputs: [] },
  { type: "event", name: "UnwrapRequested", inputs: [{ name: "receiver", type: "address", indexed: true }, { name: "unwrapRequestId", type: "bytes32", indexed: true }, { name: "amount", type: "bytes32", indexed: false }] }
] as const;

export const registryAbi = [
  { type: "function", name: "getConfidentialTokenAddress", stateMutability: "view", inputs: [{ name: "token", type: "address" }], outputs: [{ name: "isValid", type: "bool" }, { name: "confidentialToken", type: "address" }] },
  { type: "function", name: "getTokenAddress", stateMutability: "view", inputs: [{ name: "confidentialToken", type: "address" }], outputs: [{ name: "isValid", type: "bool" }, { name: "token", type: "address" }] },
  { type: "function", name: "isConfidentialTokenValid", stateMutability: "view", inputs: [{ name: "confidentialToken", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "getTokenConfidentialTokenPairs", stateMutability: "view", inputs: [], outputs: [{ type: "tuple[]", components: [{ name: "tokenAddress", type: "address" }, { name: "confidentialTokenAddress", type: "address" }, { name: "isValid", type: "bool" }] }] },
  { type: "function", name: "getTokenConfidentialTokenPairsLength", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTokenConfidentialTokenPairsSlice", stateMutability: "view", inputs: [{ name: "fromIndex", type: "uint256" }, { name: "toIndex", type: "uint256" }], outputs: [{ type: "tuple[]", components: [{ name: "tokenAddress", type: "address" }, { name: "confidentialTokenAddress", type: "address" }, { name: "isValid", type: "bool" }] }] }
] as const;

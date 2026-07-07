# Zama Documentation Notes

Sources reviewed:
- Challenge: `docs/challenge.md`
- Wrapper Registry: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry.md
- Confidential Wrapper: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper.md
- Sepolia addresses: https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md
- SDK sitemap: https://docs.zama.org/protocol/sitemap.md
- Relayer SDK: https://github.com/zama-ai/relayer-sdk

## Challenge Goal

Confidential Hub is a public Sepolia dApp for the Zama Confidential Wrapper Registry bounty. It must let users browse official wrapper pairs, claim mock faucet tokens, wrap ERC-20 tokens into ERC-7984 confidential tokens, unwrap back to ERC-20, decrypt connected-wallet balances, and decrypt arbitrary pasted ERC-7984 tokens.

Registry data uses a hybrid source model:
- Primary source: the onchain Sepolia Wrappers Registry.
- Secondary source: local config for custom or development-only pairs.

The README must cover the live URL, supported networks, registry sourcing, how to add a new pair, and deployment scripts.

## Sepolia Addresses

Wrappers Registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`

Official confidential wrappers on Sepolia:

| Name | Symbol | Wrapper | Underlying | Faucet |
| --- | --- | --- | --- | --- |
| Confidential USDC (Mock) | `cUSDCMock` | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` | Public mint, 1M/call |
| Confidential USDT (Mock) | `cUSDTMock` | `0x4E7B06D78965594eB5EF5414c357ca21E1554491` | `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0` | Public mint, 1M/call |
| Confidential WETH (Mock) | `cWETHMock` | `0x46208622DA27d91db4f0393733C8BA082ed83158` | `0xff54739b16576FA5402F211D0b938469Ab9A5f3F` | Public mint, 1M/call |
| Confidential BRON (Mock) | `cBRONMock` | `0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891` | `0xFf021fB13cA64e5354c62c954b949a88cfDEb25E` | Public mint, 1M/call |
| Confidential ZAMA (Mock) | `cZAMAMock` | `0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB` | `0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57` | Public mint, 1M/call |
| Confidential tGBP (Mock) | `ctGBPMock` | `0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC` | `0x93c931278A2aad1916783F952f94276eA5111442` | Public mint, 1M/call |
| Confidential XAUt (Mock) | `cXAUtMock` | `0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7` | `0x24377AE4AA0C45ecEe71225007f17c5D423dd940` | Public mint, 1M/call |
| Confidential tGBP | `ctGBP` | `0x167DC962808B32CFFFc7e14B5018c0bE06A3A208` | `0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3` | Restricted |

Official mock underlyings expose `mint(address to, uint256 amount)` with a documented 1,000,000 token per-call limit.

## Registry Flow

Pairs are stored as:

```solidity
struct TokenWrapperPair {
    address tokenAddress;
    address confidentialTokenAddress;
    bool isValid;
}
```

Required reads:

```solidity
getConfidentialTokenAddress(address token) returns (bool isValid, address confidentialToken)
getTokenAddress(address confidentialToken) returns (bool isValid, address token)
isConfidentialTokenValid(address confidentialToken) returns (bool)
getTokenConfidentialTokenPairs() returns (TokenWrapperPair[] memory)
getTokenConfidentialTokenPairsLength() returns (uint256)
getTokenConfidentialTokenPair(uint256 index) returns (TokenWrapperPair memory)
getTokenConfidentialTokenPairsSlice(uint256 fromIndex, uint256 toIndex) returns (TokenWrapperPair[] memory)
```

Important rule: a non-zero wrapper mapping can still be revoked. The UI and transaction flows must check `isValid` before offering wrap or unwrap actions.

## Wrap And Unwrap Flow

Wrap:
- Check ERC-20 allowance for the wrapper before sending `wrap`.
- If allowance is insufficient, send `approve` and wait for the receipt.
- Call `wrapper.wrap(to, amount)` with the underlying ERC-20 decimals.
- Wrapper confidential decimals are capped at 6, so small amounts can round down.

Unwrap:
- Request unwrap with an encrypted amount and input proof.
- Store the `UnwrapRequested` request id.
- Finalize later with the cleartext amount and decryption proof.

## User Decryption / SDK

Relevant SDK surfaces:
- `useConfidentialBalance`, `useConfidentialBalances`
- `useGrantPermit`, `useHasPermit`, `useDecryptValues`
- `useShield`, `useUnshield`, `useResumeUnshield`
- `useWrapperDiscovery`, `useTokenPairsRegistry`, `useListPairs`
- `useUnderlyingAllowance`, `useMetadata`

EIP-712 user decryption requires a signed permit before decrypting confidential values. The UI should not trigger wallet prompts automatically; decrypt is a user action.

Legacy relayer SDK install:

```bash
npm install @zama-fhe/relayer-sdk
```

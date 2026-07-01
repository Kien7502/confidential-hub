# Zama Confidential Wrapper Registry App

Production-oriented Sepolia dApp for the Zama Developer Program Season 3 Confidential Wrapper Registry bounty.

Live URL: `TODO: add Vercel deployment URL`

## What It Does

- Browses ERC-20 to ERC-7984 wrapper pairs from the Sepolia Wrappers Registry.
- Merges onchain registry pairs with local custom/dev-only pair config.
- Claims official mock underlying tokens through public faucet `mint(address,uint256)`.
- Shields ERC-20 tokens into ERC-7984 confidential wrappers.
- Starts the async unshield flow and stores pending unwrap requests for resume.
- Reads and caches confidential balance ciphertext handles.
- Supports pasted ERC-7984 token addresses for balance-handle lookup and permit-gated decrypt.
- Lets users add ERC20, regular cToken, and official/verified cToken entries locally.
- Provides a guided create-token config snippet for ERC20 and advanced cToken planning.

## Network

Sepolia only.

- Chain ID: `11155111`
- Wrappers Registry: `0x2f0750Bbb0A246059d80e94c454586a7F27a128e`

Actions are disabled unless the connected wallet is on Sepolia. Read-only registry loading uses a public Sepolia RPC.

## Registry Source Model

The onchain Wrappers Registry is the primary source of truth. The app reads registry pairs, validates each cToken through `isConfidentialTokenValid`, and enriches rows with metadata and wrapper `rate()`.

Local config is used only to surface official documented pairs during slow reads and to add custom/dev-only pairs:

- `frontend/src/config/officialPairs.ts`
- `frontend/src/config/localPairs.ts`

Example local pair:

```ts
{
  id: "my-dev-pair",
  source: "local",
  underlyingAddress: "0xYourErc20",
  confidentialAddress: "0xYourWrapper",
  underlying: { symbol: "DEV", decimals: 18 },
  confidential: { symbol: "cDEV", decimals: 6 },
  supportsFaucet: false
}
```

## Run Locally

```bash
cd frontend
Copy-Item .env.example .env.local
# edit .env.local and set VITE_PRIVY_APP_ID from the Privy dashboard
npm install
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

Tests:

```bash
cd frontend
npm test
```

Sepolia smoke test with a funded disposable wallet:

```bash
cd frontend
Copy-Item .env.test.local.example .env.test.local
# edit .env.test.local and set SEPOLIA_PRIVATE_KEY
npm run test:sepolia
```

`SEPOLIA_ENABLE_TXS=false` runs read-only checks: Sepolia RPC, wallet ETH balance, registry mapping, pair validity, metadata, wrapper rate, balances, and confidential balance handle.

Set `SEPOLIA_ENABLE_TXS=true` only when you want the script to send transactions. The transaction path mints official mock underlying tokens, approves the wrapper if needed, wraps the configured amount, and reads the new confidential balance handle.

## Deploy

Vercel static frontend:

```bash
cd frontend
npm install
npm run build
npx vercel deploy --prod
```

Use `frontend/dist` as the build output.

## Demo Checklist

1. Open the dashboard and browse official registry-backed pairs.
2. Connect a Sepolia wallet.
3. Claim one mock underlying token from Faucet.
4. Shield the mock ERC20 into its cToken wrapper.
5. Read/cache the confidential balance handle.
6. Paste a cToken address in Decrypt and sign the EIP-712 permit when using a compatible relayer SDK build.
7. Request unshield and show the pending unwrap resume list.
8. Show how a custom pair is added in `localPairs.ts`.

## Known Limitations

- Create token is a guided UI/config workflow; it does not deploy a factory or token contract in this version.
- The restricted official `ctGBP` pair is listed, but its faucet is not public.
- Final user decrypt and public unwrap proof generation depend on the installed `@zama-fhe/relayer-sdk` runtime API and an injected wallet provider.
- Activity, added tokens, decrypt cache, and pending unwrap requests are localStorage-backed.
- CLI Sepolia smoke tests cover registry, faucet mint, approve, wrap, and encrypted-handle reads. Full EIP-712 user decrypt and async unwrap proof finalization still need browser wallet/manual verification or an SDK-compatible EIP-1193 test provider.

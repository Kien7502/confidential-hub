# Sepolia Smoke Test Report

Date: 2026-07-01

## Environment

- App: Zama Confidential Wrapper Registry frontend
- Network: Sepolia (`11155111`)
- RPC: `https://ethereum-sepolia-rpc.publicnode.com`
- Test wallet: `0x3D2366D56CB697c80B15Fe1C56b98C243284ff9a`
- Test pair: `cUSDCMock`
- Underlying: `USDCMock`
- Wrapper: `cUSDCMock`
- Test amount: `1 USDCMock`
- Transaction smoke flag: `SEPOLIA_ENABLE_TXS=true`

Private key was not printed or written to this report.

## Commands Run

```powershell
cd frontend
npm test
npm run build
npm run test:sepolia
Invoke-WebRequest -Uri http://127.0.0.1:5174/ -UseBasicParsing
```

## Results

| Area | Status | Evidence |
| --- | --- | --- |
| Unit tests | PASS | 2 test files, 5 tests passed |
| Production build | PASS | `npm run build` completed successfully |
| Local app server | PASS | `http://127.0.0.1:5174/` returned HTTP 200 |
| Sepolia chain/RPC | PASS | RPC returned Sepolia and account balance |
| Test wallet gas | PASS | Wallet had `2.287363061997969135 ETH` before tx smoke |
| Registry discovery | PASS | Registry pair length returned `8` |
| Pair mapping | PASS | `USDCMock -> cUSDCMock` registry mapping returned valid |
| Wrapper validity | PASS | `isConfidentialTokenValid(cUSDCMock)` passed in smoke script |
| Metadata reads | PASS | `USDCMock decimals=6`, `cUSDCMock decimals=6` |
| Wrapper rate | PASS | `rate=1` |
| Confidential handle read | PASS | Read zero handle before wrap and non-zero handle after wrap |
| Faucet mint | PASS | Mint transaction succeeded |
| ERC20 approve | PASS | Approval transaction succeeded |
| Wrap / shield | PASS | Wrap transaction succeeded |
| User decrypt | NOT AUTOMATED | Requires browser wallet EIP-712 permit flow; CLI SDK relayer init failed |
| Unwrap request/finalize | NOT AUTOMATED | Requires SDK encrypted input and public decrypt proof; CLI SDK relayer init failed |

## Sepolia Transactions

- Faucet mint: `0x9c973f8a7e187eb8dc440be32367e81fdfabd3e180d275100c4da5a6505ad73b`
  - Status: success
  - Gas used: `51756`
- Approve wrapper: `0x4e0c9fdf541dbe25ff0e3f16b4499ba676367de2902329cc06f43fabfbfba244`
  - Status: success
  - Gas used: `46353`
- Wrap / shield: `0x0da0f530dcd0059b386be9120f7eba6eac52b06819160c7f12b5c7b8085735b7`
  - Status: success
  - Gas used: `364572`

## Balance / Handle Checks

- Underlying balance before: `0 USDCMock`
- Confidential handle before: `0x0000000000000000000000000000000000000000000000000000000000000000`
- Underlying balance after: `0 USDCMock`
- Confidential handle after: `0xf32ac430355cd0a2f391d61820fd684ba396512f71ff0000000000aa36a70500`

The after-wrap handle is non-zero, which confirms the account received an encrypted confidential balance handle.

## SDK Automation Finding

An additional Node-side SDK check was attempted with `@zama-fhe/relayer-sdk/node` to automate encrypted input generation for unwrap and relayer-backed decrypt flows. It failed while creating the SDK instance:

```text
Error: Relayer didn't response correctly. Bad JSON.
operation: KEY_URL
cause: TypeError: fetch failed
```

The same check was rerun with escalated network permission and failed the same way. This means the current CLI smoke environment cannot reliably automate:

- EIP-712 user decrypt
- encrypted unwrap request generation
- public decrypt proof generation
- finalize unwrap with proof

These should be manually verified in the browser with an injected wallet and a working Zama relayer connection, or covered by a later SDK-compatible EIP-1193 test provider.

## Build Notes

`npm run build` emits a Vite chunk-size warning because the Zama relayer SDK includes WASM assets:

- `tfhe_bg-*.wasm`
- `kms_lib_bg-*.wasm`
- SDK JS chunk over 500 kB

This is a warning, not a build failure.


# Ghi chú docs Zama cần dùng

Nguồn đã đọc:
- Challenge: `docs/challenge.md`
- Registry: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry.md
- Confidential wrapper: https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper.md
- Sepolia addresses: https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md
- Sitemap/SDK index: https://docs.zama.org/protocol/sitemap.md
- Relayer SDK README: https://github.com/zama-ai/relayer-sdk

## Mục tiêu challenge

Ứng dụng cần là web dApp public, chạy Sepolia, cho phép browse registry, faucet token mock, wrap, unwrap, decrypt balance ERC-7984 của ví đang kết nối và decrypt token ERC-7984 bất kỳ bằng paste address hoặc auto-detect.

Registry phải dùng hybrid source:
- Nguồn chính: official onchain Wrappers Registry.
- Nguồn phụ: local config cho custom/dev-only pairs.

README cuối cùng phải có live URL, supported networks, cách lấy registry, cách thêm pair mới, ví dụ thêm pair và deployment scripts.

## Sepolia addresses quan trọng

Wrappers Registry:

`0x2f0750Bbb0A246059d80e94c454586a7F27a128e`

Official confidential wrappers trên Sepolia:

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

Ghi chú faucet: các mocked wrapper dùng underlying ERC-20 test token có hàm `mint(address to, uint256 amount)` public, giới hạn 1,000,000 token mỗi lần gọi.

## Registry flow

Các pair được lưu dạng:

```solidity
struct TokenWrapperPair {
    address tokenAddress;
    address confidentialTokenAddress;
    bool isValid;
}
```

Hàm cần dùng:

```solidity
getConfidentialTokenAddress(address token) returns (bool isValid, address confidentialToken)
getTokenAddress(address confidentialToken) returns (bool isValid, address token)
isConfidentialTokenValid(address confidentialToken) returns (bool)
getTokenConfidentialTokenPairs() returns (TokenWrapperPair[])
getTokenConfidentialTokenPairsLength() returns (uint256)
getTokenConfidentialTokenPair(uint256 index) returns (TokenWrapperPair)
getTokenConfidentialTokenPairsSlice(uint256 fromIndex, uint256 toIndex) returns (TokenWrapperPair[])
```

Rule quan trọng: địa chỉ wrapper khác zero vẫn có thể đã bị revoke, nên UI/action phải kiểm tra `isValid`.

## Wrap/unwrap flow

Wrap:
- Trước khi wrap phải approve wrapper contract trên underlying ERC-20.
- Gọi `wrapper.wrap(to, amount)`.
- `amount` dùng decimals của underlying token.
- Wrapper có giới hạn decimals confidential tối đa hiện tại là 6, nên amount có thể bị round down và phần dư được refund.

Unwrap:
- Đây là flow async 2 bước.
- Bước 1: request unwrap bằng `unwrap(...)`, burn encrypted amount và emit `UnwrapRequested(receiver, unwrapRequestId, amount)`.
- Bước 2: public decrypt encrypted amount, lấy cleartext/proof, rồi gọi `finalizeUnwrap(unwrapRequestId, unwrapAmountCleartext, decryptionProof)`.
- Cần lưu `unwrapRequestId` để resume/finalize.

## User decryption / SDK

SDK docs hiện có các hook/API phù hợp:
- `useConfidentialBalance`, `useConfidentialBalances`
- `useGrantPermit`, `useHasPermit`, `useDecryptValues`
- `useShield`, `useUnshield`, `useResumeUnshield`
- `useWrapperDiscovery`, `useTokenPairsRegistry`, `useListPairs`
- `useUnderlyingAllowance`, `useMetadata`

EIP-712 user decryption phải có signed permit trước khi decrypt. UI không nên tự bật query decrypt nếu chưa có permit, tránh bật wallet prompt bất ngờ.

Legacy relayer SDK repo ghi package cài đặt:

```bash
npm install @zama-fhe/relayer-sdk
```

## UI từ wireframe và yêu cầu dev

Wireframe có:
- Sidebar `Confidential Hub`.
- Nav `Dash Board`, `Faucet`.
- Dashboard title lớn.
- Section `Your Token` và `Official Token`.
- Mỗi row chia ERC20 bên trái, cToken bên phải, action wrap/unwrap ở giữa.
- Nút `Decrypt` cạnh balance cToken.
- Row dấu cộng để add token.

Yêu cầu thêm:
- Tông icon giống Zama, dùng yellow accent/black/gray.
- Có add token 3 loại: ERC20, CToken thường, CToken xịn.
- Có create token 2 loại: ERC20, CToken xịn.
- Có cache/mapping byte32 balance handle để tránh phải decrypt lại mỗi lần vào app.

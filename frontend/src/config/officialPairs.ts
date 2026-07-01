import type { LocalPairConfig } from "../types";

export const FAUCET_MAX_TOKENS = 1_000_000n;

export const officialPairs: LocalPairConfig[] = [
  {
    id: "cusdc-mock",
    source: "official",
    underlyingAddress: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
    confidentialAddress: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
    underlying: { name: "USDC Mock", symbol: "USDCMock", decimals: 6 },
    confidential: { name: "Confidential USDC Mock", symbol: "cUSDCMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "cusdt-mock",
    source: "official",
    underlyingAddress: "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0",
    confidentialAddress: "0x4E7B06D78965594eB5EF5414c357ca21E1554491",
    underlying: { name: "USDT Mock", symbol: "USDTMock", decimals: 6 },
    confidential: { name: "Confidential USDT Mock", symbol: "cUSDTMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "cweth-mock",
    source: "official",
    underlyingAddress: "0xff54739b16576FA5402F211D0b938469Ab9A5f3F",
    confidentialAddress: "0x46208622DA27d91db4f0393733C8BA082ed83158",
    underlying: { name: "WETH Mock", symbol: "WETHMock", decimals: 18 },
    confidential: { name: "Confidential WETH Mock", symbol: "cWETHMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "cbron-mock",
    source: "official",
    underlyingAddress: "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E",
    confidentialAddress: "0xaa5612FA27c927a0c7961f5AEFEE5ba3A0F9C891",
    underlying: { name: "BRON Mock", symbol: "BRONMock", decimals: 18 },
    confidential: { name: "Confidential BRON Mock", symbol: "cBRONMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "czama-mock",
    source: "official",
    underlyingAddress: "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57",
    confidentialAddress: "0xf2D628d2598aF4eAF94CB76a437Ff86CA78FfbFB",
    underlying: { name: "ZAMA Mock", symbol: "ZAMAMock", decimals: 18 },
    confidential: { name: "Confidential ZAMA Mock", symbol: "cZAMAMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "ctgbp-mock",
    source: "official",
    underlyingAddress: "0x93c931278A2aad1916783F952f94276eA5111442",
    confidentialAddress: "0xfCE5c7069c5525eF6c8C2b2E35A745bA20a2F7CC",
    underlying: { name: "tGBP Mock", symbol: "tGBPMock", decimals: 18 },
    confidential: { name: "Confidential tGBP Mock", symbol: "ctGBPMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "cxaut-mock",
    source: "official",
    underlyingAddress: "0x24377AE4AA0C45ecEe71225007f17c5D423dd940",
    confidentialAddress: "0xe4FcF848739845BC81Dee1d5352cf3844F0a60C7",
    underlying: { name: "XAUt Mock", symbol: "XAUtMock", decimals: 6 },
    confidential: { name: "Confidential XAUt Mock", symbol: "cXAUtMock", decimals: 6 },
    supportsFaucet: true
  },
  {
    id: "ctgbp",
    source: "official",
    underlyingAddress: "0xf6Ef9ADB61A48E29E36bc873070A46A3D2667ff3",
    confidentialAddress: "0x167DC962808B32CFFFc7e14B5018c0bE06A3A208",
    underlying: { name: "tGBP", symbol: "tGBP", decimals: 18 },
    confidential: { name: "Confidential tGBP", symbol: "ctGBP", decimals: 6 },
    supportsFaucet: false,
    faucetRestricted: true,
    notes: "Restricted official pair; faucet is not public."
  }
];

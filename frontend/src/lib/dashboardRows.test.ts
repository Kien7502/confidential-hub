import { describe, expect, it } from "vitest";
import type { AddedToken, StandaloneConfidentialToken, TokenMetadata, TokenWrapperPair } from "../types";
import { buildUserRows, pairIsActionable, uniqueShieldPairs, uniqueUnshieldPairs } from "./dashboardRows";

const zero = "0x0000000000000000000000000000000000000000";

function token(address: string, symbol: string): TokenMetadata {
  return {
    address: address as TokenMetadata["address"],
    name: symbol,
    symbol,
    decimals: 18
  };
}

function pair(id: string, underlying: TokenMetadata, confidential: TokenMetadata, isValid = false): TokenWrapperPair {
  return {
    id,
    source: "user",
    kind: "wrapper",
    underlying,
    confidential,
    isValid,
    rate: 1n,
    supportsFaucet: false,
    faucetRestricted: false
  };
}

describe("dashboard user rows", () => {
  it("keeps an ERC20-only user token on the left and disables wrapper actions", () => {
    const erc20 = token("0x1111111111111111111111111111111111111111", "VIP");
    const rows = buildUserRows(
      [{ id: "vip", category: "erc20", address: erc20.address, createdAt: 1 }],
      [pair("vip", erc20, token(zero, "cVIP"))],
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].underlying?.symbol).toBe("VIP");
    expect(rows[0].confidential).toBeUndefined();
    expect(rows[0].canShield).toBe(false);
    expect(rows[0].canUnshield).toBe(false);
  });

  it("shows a user-added wrapper cToken with its detected underlying token", () => {
    const underlying = token("0x2222222222222222222222222222222222222222", "VIP");
    const confidential = token("0x3333333333333333333333333333333333333333", "cVIP");
    const rows = buildUserRows(
      [{ id: "cvip", category: "ctoken", address: confidential.address, createdAt: 1 }],
      [pair("cvip", underlying, confidential)],
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].underlying?.symbol).toBe("VIP");
    expect(rows[0].confidential?.symbol).toBe("cVIP");
    expect(rows[0].complete).toBe(true);
    expect(rows[0].canShield).toBe(true);
    expect(rows[0].canUnshield).toBe(true);
    expect(pairIsActionable(rows[0].pair)).toBe(true);
  });

  it("merges separately added ERC20 and cToken entries into one complete user row", () => {
    const underlying = token("0x4444444444444444444444444444444444444444", "VIP");
    const confidential = token("0x5555555555555555555555555555555555555555", "cVIP");
    const rows = buildUserRows(
      [
        { id: "vip", category: "erc20", address: underlying.address, createdAt: 1 },
        { id: "cvip", category: "verified-ctoken", address: confidential.address, createdAt: 2 }
      ],
      [pair("vip", underlying, token(zero, "cVIP")), pair("cvip", underlying, confidential)],
      []
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].complete).toBe(true);
    expect(rows[0].underlying?.symbol).toBe("VIP");
    expect(rows[0].confidential?.symbol).toBe("cVIP");
    expect(rows[0].canShield).toBe(true);
    expect(rows[0].canUnshield).toBe(true);
  });

  it("renders standalone confidential tokens without wrap or unwrap actions", () => {
    const standalone: StandaloneConfidentialToken = {
      id: "standalone",
      source: "user",
      confidential: token("0x6666666666666666666666666666666666666666", "cSOLO"),
      isValid: true
    };
    const rows = buildUserRows([], [], [standalone]);

    expect(rows).toHaveLength(1);
    expect(rows[0].confidential?.symbol).toBe("cSOLO");
    expect(rows[0].pair).toBeUndefined();
    expect(rows[0].canShield).toBe(false);
    expect(rows[0].canUnshield).toBe(false);
  });

  it("deduplicates Shield options by underlying and prefers the complete wrapper", () => {
    const underlying = token("0x7777777777777777777777777777777777777777", "T1");
    const placeholder = pair("t1", underlying, token(zero, "cT1"));
    const wrapper = pair("ct1", underlying, token("0x8888888888888888888888888888888888888888", "cT1"));

    const rows = uniqueShieldPairs([placeholder, wrapper]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("ct1");
    expect(rows[0].confidential.symbol).toBe("cT1");
  });

  it("deduplicates Unshield options by confidential token", () => {
    const underlying = token("0x9999999999999999999999999999999999999999", "T1");
    const confidential = token("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "cT1");
    const first = pair("first", underlying, confidential);
    const second = pair("second", underlying, confidential, true);

    const rows = uniqueUnshieldPairs([first, second]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("second");
  });
});

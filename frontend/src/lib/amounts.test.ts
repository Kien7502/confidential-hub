import { describe, expect, it } from "vitest";
import { cacheKey, estimateWrappedAmount, isFaucetAmountAllowed, parseTokenAmount } from "./amounts";

describe("amount helpers", () => {
  it("converts decimal token input into units", () => {
    expect(parseTokenAmount("1.25", 6)).toBe(1_250_000n);
  });

  it("estimates wrapped output using wrapper rate", () => {
    expect(estimateWrappedAmount(1_500_000n, 1_000_000n)).toBe(1n);
  });

  it("enforces faucet limit", () => {
    expect(isFaucetAmountAllowed(1_000_000n * 10n ** 6n, 6, 1_000_000n)).toBe(true);
    expect(isFaucetAmountAllowed(1_000_001n * 10n ** 6n, 6, 1_000_000n)).toBe(false);
  });

  it("normalizes decrypt cache keys", () => {
    expect(cacheKey(11155111, "0xABC", "0xDEF", "0xAA")).toBe("11155111:0xabc:0xdef:0xaa");
  });
});

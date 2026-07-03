import { describe, expect, it } from "vitest";
import { priceLookupSymbol } from "./prices";

describe("priceLookupSymbol", () => {
  it("normalizes confidential mock symbols to their priced underlying symbol", () => {
    expect(priceLookupSymbol("cUSDTMock")).toBe("USDT");
    expect(priceLookupSymbol("cXAUtMock")).toBe("XAUT");
  });

  it("returns undefined for unsupported symbols", () => {
    expect(priceLookupSymbol("cBRONMock")).toBeUndefined();
  });
});

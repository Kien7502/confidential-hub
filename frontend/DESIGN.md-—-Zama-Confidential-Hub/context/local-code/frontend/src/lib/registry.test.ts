import { describe, expect, it } from "vitest";
import { mergePairConfigs } from "./registry";

describe("registry merge", () => {
  it("keeps official metadata while registry remains primary for addresses", () => {
    const merged = mergePairConfigs(
      [{ tokenAddress: "0x0000000000000000000000000000000000000003", confidentialTokenAddress: "0x0000000000000000000000000000000000000004", isValid: true }],
      [
        {
          id: "known",
          source: "official",
          underlyingAddress: "0x0000000000000000000000000000000000000001",
          confidentialAddress: "0x0000000000000000000000000000000000000004",
          confidential: { symbol: "cKNOWN" }
        }
      ]
    );
    expect(merged[0].source).toBe("official");
    expect(merged[0].underlyingAddress).toBe("0x0000000000000000000000000000000000000003");
    expect(merged[0].confidential?.symbol).toBe("cKNOWN");
  });
});

import { describe, expect, it } from "vitest";
import { SEPOLIA_CHAIN_ID } from "../config/chains";
import { normalizeIconUrl, resolveTokenIcon } from "./tokenIcons";

describe("token icon resolver", () => {
  it("normalizes supported icon URL schemes", () => {
    expect(normalizeIconUrl("ipfs://cid/logo.png")).toBe("https://ipfs.io/ipfs/cid/logo.png");
    expect(normalizeIconUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
    expect(normalizeIconUrl("/tokens/usdc.png")).toBe("/tokens/usdc.png");
  });

  it("rejects unsupported icon URL schemes", () => {
    expect(normalizeIconUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeIconUrl("data:image/svg+xml;base64,abc")).toBeUndefined();
    expect(normalizeIconUrl("http://example.com/logo.png")).toBeUndefined();
  });

  it("uses explicit user icon URL before local and list sources", () => {
    const resolved = resolveTokenIcon({
      address: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
      iconUrl: "ipfs://custom/logo.png"
    });

    expect(resolved).toEqual({
      url: "https://ipfs.io/ipfs/custom/logo.png",
      source: "user"
    });
  });

  it("resolves official mock icons from the local map", () => {
    const resolved = resolveTokenIcon({ address: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF" });

    expect(resolved.source).toBe("local");
    expect(resolved.url).toBe("/tokens/usdc.png");
  });

  it("resolves token-list entries only for the active chain", () => {
    const token = { address: "0x1111111111111111111111111111111111111111" as const };
    const entries = [
      { chainId: 1, address: token.address, logoURI: "https://example.com/mainnet.png" },
      { chainId: SEPOLIA_CHAIN_ID, address: token.address, logoURI: "https://example.com/sepolia.png" }
    ];

    expect(resolveTokenIcon(token, entries).url).toBe("https://example.com/sepolia.png");
    expect(resolveTokenIcon(token, entries, 1).url).toBe("https://example.com/mainnet.png");
  });
});

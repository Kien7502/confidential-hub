---
name: "zama-confidential-hub"
description: "Apply the Zama Confidential Hub design system — a dark, near-black confidential-token wallet / DeFi UI on Zama's FHE / ERC-7984 stack, with one bold Zama-yellow accent, shield-badged confidential tokens, and **** for encrypted balances. Use when building wallet dashboards, shield/unshield swap flows, send/decrypt/faucet screens, token pickers, or any confidential-finance product surface in this brand."
version: "1.1.0"
source: "https://zama-ctoken-shield.vercel.app/"
---

# Zama Confidential Hub — skill

Apply this when the task is a **confidential-token wallet / DeFi product surface** in the Zama cToken brand: wallet dashboard, shield/unshield flow, send, decrypt, faucet, add/create token, activity. It is a **product app**, not a marketing page.

## Bind these tokens first

```css
:root {
  --canvas:#000000; --input-bg:#0d0d0d; --panel:#141414; --modal:#1b1b1b; --hover:#202020;
  --border-subtle:#232323; --border:#2b2b2b; --border-card:#3a3a3a; --border-hover:#6f6f6f;
  --fg:#f4f4f1; --body:#b9b9b2; --muted:#9c9c95;
  --accent:#ffd208; --on-accent:#050505; --accent-tint:rgba(255,210,8,0.08); --accent-border:#806b24;
  --positive:#46c07a; --positive-border:#315f44; --warn-border:#6f5530; --danger:#d45757; --danger-fg:#ff8f66;
  --r-input:6px; --r-card:12px; --r-card-lg:16px; --r-pill:999px;
  --font:"Inter",system-ui,-apple-system,"Segoe UI","Helvetica Neue",Arial,sans-serif;
  --mono:"SFMono-Regular","SF Mono",Consolas,"Liberation Mono",Menlo,monospace;
}
```

`app.css` in this project already binds all of the above — copy it rather than re-deriving.

## Non-negotiable rules
1. **One accent only** — `#ffd208`, used sparingly (primary button, active nav, active step). Never a large wash. No second brand hue; reds/greens are status only.
2. **Confidential = shield badge**, on its own dark disc + canvas ring so it stays legible over any logo color.
3. **Encrypted balances render `****`** (mono), never a fake `0`. Decrypt reveals via a permit-then-decrypt step.
4. **Blocking reason on the CTA** — disable with the reason in the label (“Connect wallet to shield”, “Switch to Sepolia”); pending states use verb labels (Checking allowance, Approving, Shielding, Decrypting).
5. **Token pickers are custom listboxes** — logo + symbol + name + balance; never a bare native `<select>`.
6. **Actions live in centered cards/forms**, in a fixed-left-sidebar shell — never a marketing landing layout.
7. **A11y:** WCAG AA on dark, visible focus, aria labels on icon buttons, 44px hit targets.

## Component shapes (see `components.html` / `app.css`)
token avatar + shield badge · custom token dropdown · swap-style flow card + direction swap · encrypted-notice panel · asset row (Asset · Price · Balance · Value) · step progress (allowance→approve→shield / request→finalize) · network pill · modal.

## Workflow
1. Read `DESIGN.md` (principles) + `brand.json` (tokens/registry).
2. Copy `app.css` into `:root`; reuse its component classes.
3. Use `index.html` as the high-fidelity reference shell; match its IA.
4. Real token logos live in `assets/tokens/`; brand mark in `assets/zama-brand-icon.png`. Don’t redraw marks.
5. Self-check against the palette-only / typography / layout / logo rules before shipping.

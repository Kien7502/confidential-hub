---
name: "DESIGN.md — Zama Confidential Hub"
category: Brands
surface: web
version: "1.1.0"
source: "https://zama-ctoken-shield.vercel.app/"
colors:
  text-primary: "#f4f4f1"
  bg: "#000000"
  one-accent-only-zama-yellow: "#ffd208"
  surface-1: "#0b0b0b"
  border-subtle: "#232323"
  border-default: "#2b2b2b"
  text-secondary: "#b9b9b2"
---

# DESIGN.md — Zama Confidential Hub

> Category: Brands · Surface: web · A confidential-token wallet + DeFi tool on Zama's FHE / ERC-7984 stack (Sepolia testnet).

Users shield public ERC-20 tokens into their confidential counterparts, unshield back, send confidentially, decrypt encrypted balances, and mint from faucets — over a browsable registry of official confidential wrappers plus custom pairs.

**Product surface:** a fixed left-sidebar app shell (Dashboard, Faucet, Shield/Unshield, Send, Activity), brand mark top, wallet control pinned bottom. Actions live in centered cards/forms — never a marketing landing page. Core screens are a wallet dashboard (total balance, asset list with price/balance/value, per-asset detail modal) and a swap-style Shield/Unshield card (“You shield” → “You receive”).

**Visual identity:** dark, near-black shell with a single bold Zama-yellow accent. Confidential tokens carry a shield badge; encrypted balances that aren’t decrypted yet show as `****`, never a fake zero. High-contrast, fintech-precise, no decorative fluff.

**Voice:** direct, expert, calm. Action-first verb labels (Shield, Unshield, Send, Decrypt). Copy is short and states the current action plainly. Trust and privacy are the through-line — never overhype, never leak.

> **Provenance:** color, type, radius and layout in this file were re-measured from the app’s own `src/styles.css` and config (`officialPairs.ts`, `prices.ts`, `tokenIcons.ts`) during the AI Optimize pass. The seven frontmatter tokens are the **registered** palette and stay authoritative for registration; the extended roles below are measured from the same source and scoped as extensions. Anything not directly measured is marked *(inferred)*.

## Color

### Registered palette (authoritative)

| Token | Hex | OKLCH | Role |
| --- | --- | --- | --- |
| Canvas / `bg` | `#000000` | `oklch(0% 0 0)` | app + sidebar background |
| Text primary | `#f4f4f1` | `oklch(96.2% 0.002 106)` | headings, primary text |
| Zama yellow (accent) | `#ffd208` | `oklch(86.9% 0.174 96.3)` | primary actions, active state, emphasis — **one accent only** |
| Surface 1 | `#0b0b0b` | `oklch(12.9% 0 0)` | cards/panels (registered value; app also uses `#141414`) |
| Border subtle | `#232323` | `oklch(25.3% 0 0)` | row dividers, sidebar rule |
| Border default | `#2b2b2b` | `oklch(28.6% 0 0)` | control + panel borders |
| Text secondary | `#b9b9b2` | `oklch(76.8% 0.004 106)` | body, secondary lines/links |

> The accent is high-signal. Use it sparingly — one primary action, the active nav item, the active step. Never a large wash.

### Extended roles (measured from source, scoped as extensions)

Surfaces step up as elevation increases:

| Role | Hex | Use |
| --- | --- | --- |
| Input surface | `#0d0d0d` | inputs, dropdowns, inner wells |
| Panel | `#141414` | cards, panels |
| Modal | `#1b1b1b` | modals, elevated menus |
| Hover | `#202020` | hover fills on rows / menu items |

Borders climb with prominence: `#232323` subtle → `#2b2b2b` default → `#3a3a3a` card → `#6f6f6f` hover.

Text: `#f4f4f1` primary → `#b9b9b2` body → `#9c9c95` muted (labels, metadata).

Accent support: on-accent text `#050505`; accent tint `rgba(255,210,8,0.08–0.10)` for active steps/selected chips; accent border `#806b24`.

Status (not a second brand hue — reserved for state): positive `#46c07a` (border `#315f44`); warn border `#6f5530`; danger `#d45757`, danger text `#ff8f66`.

## Typography

- **Display / Body:** Inter — 400 / 600 / 700 — fallbacks `system-ui, -apple-system, Segoe UI, Helvetica Neue, Arial, sans-serif`. Single family for display and body is intentional (tech/utility posture). Loaded from `rsms.me/inter`; ships the fallback stack when the face isn’t web-loadable.
- **Mono:** `SFMono-Regular`, fallbacks `SF Mono, Consolas, Liberation Mono, Menlo, monospace`. Used for addresses, tx hashes, token amounts and the encrypted `****` mask.

**Scale (measured):** H1 30px · section H2 16–18px · balance hero 40px · flow amount input 44px · body 15px/1.5 · small 13px · caption 12px · micro 11px.

## Layout

- **Radius:** 6px inputs · 12–16px cards · 999px pills & avatars. Registered base token: 8px.
- **Border weight:** 1px throughout.
- **Spacing:** 4 / 8 / 12 / 16 / 20 / 24 on a 4px unit.
- **Shell:** fixed ~248px sidebar (brand top, nav, wallet pinned bottom) + fluid main; centered content cards max ~560px.

### Posture rules
- One accent, used at most twice per screen; never a large yellow wash.
- Every action CTA is disabled with its **blocking reason in the label** (“Connect wallet to shield”, “Switch to Sepolia”) until the wallet is connected on Sepolia.
- Pending states use verb labels: *Checking allowance, Approving, Shielding, Requesting, Finalizing, Decrypting*.
- Encrypted balances render `****` in mono; decrypt reveals via a permit-then-decrypt step — a masked balance is visually distinct from a real `0`.
- Multi-tx flows surface each step (pending → active spinner → done check → error) with a linked result panel.

## Components

- **Token avatar + shield badge** — circular logo on `#0d0d0d` with a 1px `#3a3a3a` ring. Confidential (ERC-7984) tokens add a shield badge on its own dark disc + canvas ring so it stays legible over bright logos (ZAMA yellow, XAUt gold). Logo-less tokens fall back to a 3-letter monogram.
- **Token dropdown** — custom listbox (never a native `<select>`): logo + symbol + full name + balance per row; confidential variants show the badge. Keyboard-navigable, closes on Esc / outside click.
- **Flow card** — swap-style “You shield / You receive” stacked cards with a circular direction-swap button between them, large amount input, MAX shortcut, live balance.
- **Encrypted-notice panel** — lock glyph + one-sentence permit explainer + single verb CTA; shown wherever a confidential balance is still masked.
- **Asset row** — Asset · Price (+24h) · Balance (public + confidential, masked if encrypted) · Value; whole row is a button → detail modal.
- **Step progress** — allowance → approve → shield (or request → finalize); states pending/active/done/error.
- **Pills** — network state: neutral (disconnected) · green (Sepolia) · amber (wrong network). **Buttons** — one primary (yellow), ghost/secondary on `#101010`. **Inputs** — 6px radius, `#0d0d0d`, hover border `#6f6f6f`.

## Voice & Tone

- **Adjectives:** direct, expert, calm, precise, trustworthy.
- **Use:** Shield · Unshield · Send · Decrypt · Confidential · Encrypted amount · Available to shield · You shield · You receive · Permit.
- **Avoid:** hype superlatives; “private” as a vague promise; a fake `0` for an undecrypted balance; emoji in product UI; marketing CTAs.

### Messaging pillars
- **Confidential by default** — shield public ERC-20 into ERC-7984 counterparts; encrypted balances stay encrypted until you decrypt.
- **Verb-first control** — every action is a plain verb: Shield, Unshield, Send, Decrypt, Mint.
- **Testnet-honest** — Sepolia only, mock tokens, real flows; blocking reasons are always stated on the control itself.

## Accessibility
- WCAG AA contrast on the dark shell; primary text `#f4f4f1` on `#000` ≈ 19:1, body `#b9b9b2` ≈ 11:1. *(inferred: yellow `#ffd208` is for large text / fills with `#050505` text, not small body copy on dark.)*
- Visible focus rings, aria labels on icon-only buttons, 44px min hit targets, keyboard-navigable menus and modals.

## Imagery
- **Style:** iconographic, not photographic — monoline ~2px stroke icons (Lucide-style) for nav/actions; filled shield glyph for the confidential badge.
- **Treatment:** token logos as circular avatars with a ring; confidential badge on its own disc.
- **Avoid:** stock photography, 3D coin renders, gradient-mesh backgrounds, hand-drawn illustration.
- **Samples:** `assets/tokens/{usdc,usdt,weth,zama,xaut}.png`, `assets/zama-brand-icon.png`.

## Logo
- Primary: `assets/zama-brand-icon.png` (real app icon), on a `#ffd208` rounded tile in the sidebar. Alternates: `logos/apple-touch-icon.png`, `logos/favicon-1.png`, `logos/favicon-2.ico`. No wordmark supplied by source.

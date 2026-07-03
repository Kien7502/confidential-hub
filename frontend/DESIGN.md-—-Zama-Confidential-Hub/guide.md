# DESIGN.md — Zama Confidential Hub — Brand Guide

*Design system tokens, rationale, and component guidance for a confidential-token app built on Zama's FHE / ERC-7984 stack (Sepolia testnet).*

Zama cToken App: a confidential-token wallet and DeFi tool built on Zama's FHE / ERC-7984 stack (Sepolia testnet). Users shield public ERC-20 tokens into their confidential counterparts, unshield back, send confidentially, decrypt encrypted balances, and mint from faucets — with a browsable registry of official confidential wrappers plus support for adding/creating custom token pairs.

Product surface: a left sidebar app shell (Dashboard/Wallet, Shield/Unshield, Send, Faucet, Decrypt, Activity, Add/Create token). All actions live in a centered card/form, never a marketing landing page. Core screens are a wallet dashboard (total balance, asset list with price/balance/value, per-asset detail) and a swap-style Shield/Unshield card ("You shield" → "You receive").

Visual identity: dark, near-black shell with a bold Zama yellow accent. Confidential (encrypted) tokens carry a shield badge; encrypted balances that aren't decrypted yet show as "****" rather than a fake zero. Clean, high-contrast, fintech-precise. No decorative fluff.

Voice: direct, expert, calm. Action-first verb labels (Shield, Unshield, Send, Decrypt). Copy is short and states the current action plainly ("Shield ERC-20 tokens into their confidential counterpart"). Trust and privacy are the through-line — never overhype, never leak.

Extracted from https://zama-ctoken-shield.vercel.app/.

## Color roles

- **Text primary** (`#f4f4f1`) — background: page canvas
- **Bg** (`#000000`) — foreground: body text and headings
- **One accent only — Zama yellow** (`#ffd208`) — accent: primary actions and emphasis
- **Surface 1** (`#0b0b0b`) — surface: cards and panels
- **Border subtle** (`#232323`) — muted: secondary text and metadata
- **Border default** (`#2b2b2b`) — border: rules and dividers
- **Text secondary** (`#b9b9b2`) — accent-secondary: secondary actions and links

## Typography

- Display: Inter
- Body: Inter
- Mono: SFMono

## Messaging pillars

- Zama cToken App: a confidential-token wallet and DeFi tool built on Zama's FHE / ERC-7984 stack (Sepolia testnet). Users shield public ERC-20 tokens into their confidential counterparts, unshield back, send confidentially, decrypt encrypted balances, and mint from faucets — with a browsable registry of official confidential wrappers plus support for adding/creating custom token pairs.

Product surface: a left sidebar app shell (Dashboard/Wallet, Shield/Unshield, Send, Faucet, Decrypt, Activity, Add/Create token). All actions live in a centered card/form, never a marketing landing page. Core screens are a wallet dashboard (total balance, asset list with price/balance/value, per-asset detail) and a swap-style Shield/Unshield card ("You shield" → "You receive").

Visual identity: dark, near-black shell with a bold Zama yellow accent. Confidential (encrypted) tokens carry a shield badge; encrypted balances that aren't decrypted yet show as "****" rather than a fake zero. Clean, high-contrast, fintech-precise. No decorative fluff.

Voice: direct, expert, calm. Action-first verb labels (Shield, Unshield, Send, Decrypt). Copy is short and states the current action plainly ("Shield ERC-20 tokens into their confidential counterpart"). Trust and privacy are the through-line — never overhype, never leak.
- Design system tokens, rationale, and component guidance for a confidential-token app built on Zama's FHE / ERC-7984 stack (Sepolia testnet). Theme follows the Zama app: near-black shell with a single bold yellow accent.

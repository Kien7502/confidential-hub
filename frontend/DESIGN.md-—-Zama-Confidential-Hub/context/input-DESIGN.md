# DESIGN.md — Zama Confidential Hub

Design system tokens, rationale, and component guidance for a confidential-token app
built on Zama's FHE / ERC-7984 stack (Sepolia testnet). Theme follows the Zama app:
near-black shell with a single bold yellow accent.

## Brand & rationale

- Dark, high-contrast fintech shell. Black canvas keeps focus on token cards and forms.
- One accent only — Zama yellow `#FFD208` — for primary actions, active states, brand mark,
  and the confidential (shield) badge. Never introduce a second accent hue.
- Confidential tokens always carry a shield badge. Encrypted balances that are not decrypted
  yet render as `****`, never a fake `0`.
- Copy is short and action-first (Shield, Unshield, Send, Decrypt). No marketing tone.

## Color tokens

### Surfaces (darkest → lightest)
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#000000` | App canvas, sidebar |
| `--surface-1` | `#0b0b0b` | Deepest cards (config/empty states) |
| `--surface-2` | `#0d0d0d` | Inputs, avatars, dropdown triggers |
| `--surface-3` | `#141414` | Panels, action cards, encrypted-notice |
| `--surface-4` | `#151515` | Default button background |
| `--surface-5` | `#161616` | Popover / dropdown menu |
| `--surface-6` | `#1b1b1b` | Modals, earn/list cards |
| `--surface-hover` | `#202020` | Row/item hover |

### Borders
| Token | Value | Use |
|-------|-------|-----|
| `--border-subtle` | `#232323` | Sidebar / structural dividers |
| `--border-default` | `#2b2b2b` | Buttons, panels |
| `--border-strong` | `#333333` | Inputs |
| `--border-emphasis` | `#3a3a3a` | Cards, dropdown menu, avatar ring |
| `--border-hover` | `#6f6f6f` | Interactive hover border |

### Text
| Token | Value | Use |
|-------|-------|-----|
| `--text-primary` | `#f4f4f1` | Headings, values |
| `--text-secondary` | `#b9b9b2` | Body copy, hints |
| `--text-muted` | `#9c9c95` | Labels, captions, table headers |

### Accent & status
| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#FFD208` | Primary CTA, active nav, brand, shield badge |
| `--accent-on` | `#050505` | Text/icon on accent fills |
| `--accent-soft` | `rgba(255,210,8,0.08–0.10)` | Active/selected tints |
| `--positive` | `#46c07a` | APY / success values |
| `--warn-border` | `#6f5530` | Wrong-network / warning outline |
| `--warn-bg` | `rgba(255,210,8,0.08)` | Warning banner fill |

## Typography

- Family: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Mono: `"SFMono-Regular", Consolas, "Liberation Mono", monospace` (addresses, tx hashes).
- Scale: display balance ~38–48px/800; H1 ~18px; body 13–15px; labels/captions 11–13px, `--text-muted`.
- Weights: 800 for CTAs and big balances, 600–700 for token symbols, 400 body.
- Uppercase micro-labels (`TOTAL BALANCE`, `PRICE`) with slight letter-spacing.

## Shape & spacing

- Radius: inputs/buttons `6px`; small chips/items `10–12px`; cards/panels `12–16px`;
  popovers `14px`; pills, avatars, and icon buttons fully round `999px`.
- Spacing rhythm: `4 · 8 · 12 · 16 · 20 · 24` px.
- Layout: fixed `220px` sidebar + fluid main. Content columns max-width ~620–720px, centered.
- Elevation: popovers/menus use `box-shadow: 0 12px 30px rgba(0,0,0,0.5)`.

## Components

- **Sidebar nav**: icon + label buttons; active item uses `--accent` text/tint. Brand mark
  (Zama Z) top, wallet menu pinned bottom.
- **Primary button**: `--accent` fill, `--accent-on` text, weight 800, min-height 44px, full-width in cards.
- **Secondary/ghost button**: `--surface-4` fill, `--border-default`, `--text-primary`.
- **Token avatar**: round `--surface-2` chip with logo image; letter fallback in `--accent`.
  Confidential variant overlays a yellow shield badge sitting on a dark round disc so it stays
  legible over any logo color.
- **Token dropdown**: custom (not native `<select>`) so each row shows avatar + symbol; trigger
  is a rounded pill, menu is `--surface-5` with hover `--surface-hover` and active `--accent-soft`.
- **Wallet asset row**: `Asset · Price · Balance · Value` grid, chevron affordance, click → detail modal.
- **Flow card** (Shield/Unshield/Send): stacked "You shield → You receive" cards, large amount input,
  token dropdown top-right, balance footer, full-width CTA, disabled until wallet on Sepolia.
- **Encrypted-notice panel**: `--surface-3` card, lock icon + "Encrypted amount" in `--accent`,
  explanatory body, full-width DECRYPT CTA that swaps to SIGNING / DECRYPTING while pending.
- **Warning text**: `--text-secondary`; banners use `--warn-border` + `--warn-bg`.
- **Pill (status)**: rounded `999px`; wrong-network uses `--warn-border`.

## States

- Disabled: `opacity: 0.45`, `not-allowed` cursor.
- Hover: lift border to `--border-hover` or surface to `--surface-hover`.
- Selected/active: `--accent` text on `--accent-soft` fill.
- Loading/pending: verb-in-progress labels ("Checking allowance", "Approving", "Shielding", "Decrypting").
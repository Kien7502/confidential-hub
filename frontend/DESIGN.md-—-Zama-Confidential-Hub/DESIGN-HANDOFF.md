# brand-zama-ctoken-shield-e072be implementation handoff

This archive is the source of truth for turning the design into production code. Start from `context/local-code/frontend/index.html`, then preserve the visual system, responsive behavior, and interactions found in the exported files.

## Implementation target
- Build production UI from the exported design, not a loose reinterpretation.
- Preserve typography scale, spacing rhythm, color tokens, border radii, shadows, motion timing, and component states.
- Replace static placeholders only when the target app has real data or functional equivalents.
- Keep generated product UI free of Open Design chrome, preview labels, or design-process annotations.
- Treat this handoff as a visual contract: if implementation choices conflict, match the exported pixels and behavior first, then refactor internals.

## Source map
- Primary entry: `context/local-code/frontend/index.html`
- HTML screens detected: 13
- Stylesheets detected: 5
- Script/component files detected: 26
- Supporting assets detected: 67

## Responsive contract
Validate the implementation across this 2025–2026 viewport matrix:
- Mobile compact: 360×800
- Mobile standard: 390×844
- Mobile large: 430×932
- Foldable / small tablet: 600×960
- Tablet portrait: 820×1180
- Tablet landscape: 1024×768
- Laptop: 1366×768
- Desktop: 1440×900
- Wide desktop: 1920×1080

For responsive web exports, treat these as a modern breakpoint system for one adaptive web experience, not three fixed screenshots. Do not split responsive web into unrelated native app screens unless the project explicitly includes native targets. Use semantic layout thresholds, fluid `clamp()` type/spacing, and container queries where component width matters more than viewport width. Preserve any CSS media queries, container queries, fluid `clamp()` scales, and layout changes already present in the exported files.

## Design fidelity contract
- Extract reusable tokens before writing components: background, surface, foreground, muted text, border, accent, radius, shadow, spacing, type scale, and motion duration/easing.
- Map product screens, in-app modules/components, optional landing page, and optional OS widget surfaces before coding. Keep these surfaces separate in the target architecture.
- Match layout geometry: max-widths, gutters, grid columns, card proportions, sticky/fixed elements, and viewport-specific navigation.
- Preserve real copy, labels, and data shown in the export. Do not replace specific text with generic marketing filler.
- Preserve interactive affordances: hover, focus, pressed, disabled, loading, validation, copy/share, tab/accordion, modal/sheet, and keyboard states where present.
- Preserve accessibility semantics when converting: headings stay hierarchical, controls remain buttons/links/inputs, focus states stay visible.
- Do not keep prototype-only annotations, frame labels, or Open Design chrome in the production UI.

## CJX-ready UX contract
- Use `DESIGN-MANIFEST.json` as the machine-readable map for screens, app modules, OS widgets, landing pages, tokens, interactions, and viewport checks.
- Screen-file-first: when multiple user-facing surfaces exist, implement each HTML screen as its own route/file. Treat `index.html` as a launcher/overview when the manifest marks it that way, not as a combined final UI.
- If `landing.html`, app screens, platform screens, or OS widget files exist, preserve those boundaries in the target app instead of merging them into one page.
- A single self-contained `context/local-code/frontend/index.html` is acceptable only when the export truly contains one user-facing screen and its CSS/JS are structured enough to extract tokens, components, states, and behavior.
- If separate `css/` or `js/` files exist, treat them as source of truth for token/component/interactions before porting to React, Vue, SwiftUI, Compose, or another target stack.
- In-app modules/components are product UI blocks inside the app. OS widgets are home-screen/lock-screen/quick-access surfaces outside the app. Do not merge those concepts.

## Color and brand contract
- Use the exported design tokens and product/domain context as the color source of truth.
- Do not introduce warm beige / cream / peach / pink / orange-brown background washes unless they are already explicit brand/reference colors in the export.
- A stylesheet or design/token file was detected; inspect it for canonical color variables before choosing framework theme tokens.

## Implementation sequence for AI coding tools
1. Open `context/local-code/frontend/index.html` and `DESIGN-MANIFEST.json`; identify every screen file, launcher/overview file, app module, and interaction before coding.
2. If multiple HTML screens exist, map them to separate routes/surfaces first; do not merge `landing.html`, product app screens, platform screens, or OS widgets into one route.
3. Extract a token table from CSS/root styles and inline styles before building framework components.
4. Build product screens and domain-specific in-app modules from largest layout regions down to controls; avoid starting with isolated atoms that lose spatial intent.
5. Port responsive behavior across the modern viewport matrix and test each semantic breakpoint before cleanup.
6. Port interactions and states, then replace static placeholders only with real app data or functional equivalents.
7. Keep optional landing page and OS widget surfaces as separate surfaces if present.
8. Compare final screenshots against the export at 360×800, 390×844, 430×932, 820×1180, 1024×768, 1366×768, 1440×900, and 1920×1080 before declaring done.

## Entry points
- `brand.html`
- `components.html`
- `context/local-code/frontend/index.html`
- `index.html`
- `system/artifacts/deck.html`
- `system/artifacts/email.html`
- `system/artifacts/form.html`
- `system/artifacts/landing.html`
- `system/artifacts/newsletter.html`
- `system/artifacts/poster.html`
- `system/index.html`
- `system/kit.dark.html`
- `system/kit.html`

## Styles
- `app.css`
- `context/local-code/frontend/src/styles.css`
- `system/variables.css`
- `system/variables.dark.css`
- `tokens.css`

## Scripts/components
- `app.js`
- `context/local-code/frontend/scripts/sepolia-smoke.mjs`
- `context/local-code/frontend/src/App.tsx`
- `context/local-code/frontend/src/config/abis.ts`
- `context/local-code/frontend/src/config/artifacts.ts`
- `context/local-code/frontend/src/config/chains.ts`
- `context/local-code/frontend/src/config/localPairs.ts`
- `context/local-code/frontend/src/config/officialPairs.ts`
- `context/local-code/frontend/src/lib/amounts.test.ts`
- `context/local-code/frontend/src/lib/amounts.ts`
- `context/local-code/frontend/src/lib/dashboardRows.test.ts`
- `context/local-code/frontend/src/lib/dashboardRows.ts`
- `context/local-code/frontend/src/lib/prices.test.ts`
- `context/local-code/frontend/src/lib/prices.ts`
- `context/local-code/frontend/src/lib/registry.test.ts`
- `context/local-code/frontend/src/lib/registry.ts`
- `context/local-code/frontend/src/lib/sdk.ts`
- `context/local-code/frontend/src/lib/storage.ts`
- `context/local-code/frontend/src/lib/tokenIcons.test.ts`
- `context/local-code/frontend/src/lib/tokenIcons.ts`
- `context/local-code/frontend/src/lib/transactions.ts`
- `context/local-code/frontend/src/main.tsx`
- `context/local-code/frontend/src/types.ts`
- `context/local-code/frontend/src/vite-env.d.ts`
- `context/local-code/frontend/vite.config.ts`
- `system/scripts/apply-design-tokens.mjs`

## Assets and supporting files
- `apply-guide.md`
- `assets/tokens/usdc.png`
- `assets/tokens/usdt.png`
- `assets/tokens/weth.png`
- `assets/tokens/xaut.png`
- `assets/tokens/zama.png`
- `assets/zama-brand-icon.png`
- `brand.json`
- `context/input-DESIGN.md`
- `context/local-code/frontend/_env.example`
- `context/local-code/frontend/_env.local`
- `context/local-code/frontend/_env.local.example`
- `context/local-code/frontend/_env.test.local`
- `context/local-code/frontend/_env.test.local.example`
- `context/local-code/frontend/_gitignore`
- `context/local-code/frontend/package-lock.json`
- `context/local-code/frontend/package.json`
- `context/local-code/frontend/public/apple-touch-icon.png`
- `context/local-code/frontend/public/favicon.ico`
- `context/local-code/frontend/public/favicon.png`
- `context/local-code/frontend/public/icon-192.png`
- `context/local-code/frontend/public/icon-512.png`
- `context/local-code/frontend/public/site.webmanifest`
- `context/local-code/frontend/public/tokens/usdc.png`
- `context/local-code/frontend/public/tokens/usdt.png`
- `context/local-code/frontend/public/tokens/weth.png`
- `context/local-code/frontend/public/tokens/xaut.png`
- `context/local-code/frontend/public/tokens/zama.png`
- `context/local-code/frontend/public/zama-app-icon.png`
- `context/local-code/frontend/public/zama-brand-icon.png`
- `context/local-code/frontend/tsconfig.json`
- `context/local-code/frontend/tsconfig.node.json`
- `context/local-code/frontend/tsconfig.node.tsbuildinfo`
- `context/local-code/frontend/tsconfig.tsbuildinfo`
- `context/local-code/frontend/vite-dev-5174.err.log`
- `context/local-code/frontend/vite-dev-5174.log`
- `context/local-code/frontend/vite-dev.err.log`
- `context/local-code/frontend/vite-dev.log`
- `context/source-context.md`
- `DESIGN.md`
- `guide.md`
- `logos/apple-touch-icon.png`
- `logos/favicon-1.png`
- `logos/favicon-2.ico`
- `plugin-source/zama-confidential-hub-design-system-mr4u1j09/open-design.json`
- `plugin-source/zama-confidential-hub-design-system-mr4u1j09/references/provenance.json`
- `plugin-source/zama-confidential-hub-design-system-mr4u1j09/references/source-1-README.md`
- `plugin-source/zama-confidential-hub-design-system-mr4u1j09/references/source-2-SKILL.md`
- `plugin-source/zama-confidential-hub-design-system-mr4u1j09/SKILL.md`
- `plugin-source/zama-confidential-hub-design-system-mr4u41e1/open-design.json`
- `plugin-source/zama-confidential-hub-design-system-mr4u41e1/references/provenance.json`
- `plugin-source/zama-confidential-hub-design-system-mr4u41e1/references/source-1-README.md`
- `plugin-source/zama-confidential-hub-design-system-mr4u41e1/references/source-2-SKILL.md`
- `plugin-source/zama-confidential-hub-design-system-mr4u41e1/SKILL.md`
- `plugin-source/zama-confidential-hub-design-system-mr4ud1ds/open-design.json`
- `plugin-source/zama-confidential-hub-design-system-mr4ud1ds/references/provenance.json`
- `plugin-source/zama-confidential-hub-design-system-mr4ud1ds/references/source-1-README.md`
- `plugin-source/zama-confidential-hub-design-system-mr4ud1ds/references/source-2-SKILL.md`
- `plugin-source/zama-confidential-hub-design-system-mr4ud1ds/SKILL.md`
- `README.md`
- `SKILL.md`
- `system/BRAND-SYSTEM.md`
- `system/seed.json`
- `system/theme.json`
- `system/tokens.compact.json`
- `system/tokens.dark.json`
- `system/tokens.default.json`

## Coding checklist for AI tools
1. Inspect `context/local-code/frontend/index.html` and `DESIGN-MANIFEST.json` first and identify reusable components before coding.
2. Implement each user-facing screen file as its own route/surface; keep launcher, landing, app, platform, and OS widget files separate.
3. Extract design tokens into the target stack: colors, type scale, spacing, radius, shadows, and motion.
4. Implement layout with real 2025–2026 responsive breakpoints, fluid type/spacing, and container-query-aware component behavior; test with no horizontal overflow.
5. Preserve interactive controls, hover/focus/pressed states, form behavior, validation, and copy actions where present.
6. Implement domain-specific in-app modules with real states; do not flatten them into generic cards.
7. Keep landing page, product screens, and OS widget/quick-access surfaces separate when present.
8. Confirm the production result visually matches the exported design before refactoring internals.
9. Reject implementation shortcuts that flatten the design into generic cards, generic gradients, placeholder stats, or framework-default typography.
10. If a detail is ambiguous, keep the exported HTML/CSS/JS behavior rather than inventing a new pattern.

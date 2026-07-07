# Project Progress

## Current Submission Cleanup

- Removed generated design handoff artifacts from the tracked repository.
- Removed tracked local environment files that should not be published.
- Replaced Vietnamese Zama notes with English challenge-critical notes.
- Preparing README and documentation for public GitHub submission.

## Verification Targets

- `npm test` from `frontend/`
- `npm run build` from `frontend/`
- Optional Sepolia smoke test with a funded disposable wallet: `npm run test:sepolia`

## Remaining Manual Submission Items

- Record a real-person demo video under 3 minutes.
- Publish an X thread or article introducing Confidential Hub.

## Repository And Live URL Rename
- Renamed GitHub repository to Kien7502/confidential-hub and updated local origin remote.
- Renamed Vercel project to confidential-hub.
- Added live alias https://confidential-hub.vercel.app/ and verified HTTP 200.
- Updated README live app and repository links.

## README Source Attribution
- Added Zama challenge and official documentation links to README.
- Expanded registry sourcing notes with the Zama Sepolia Wrappers Registry URL and official cTokenMock address source.
- Removed the old README constraints section for the final public submission copy.

## User cToken Row Pairing
- Updated user-added cToken rows to display the detected underlying ERC20 token together with the confidential wrapper.
- Added test coverage so a pasted ERC7984 wrapper appears as a complete Shield/Unshield pair.
- Fixed Shield/Unshield pair selection so stale pair ids are ignored when switching between modes with different token-side option lists.
- Added transaction-driven balance refresh after shield, unshield, faucet, and send actions so custom cToken rows do not keep stale zero confidential handles after wrapping.
- Added cToken address labels to token dropdowns and kept multiple wrappers for the same underlying token visible in Shield selection.
- Fixed detail-panel Shield/Unshield navigation to carry the selected cToken wrapper address so duplicate wrappers for one underlying token open the correct flow option.
- Added custom token removal controls in asset details and the add-token modal, removing only wallet-local custom entries.
- Updated detail-panel decrypt to refresh the modal balance and dashboard row immediately after user-decrypt writes the cache.

Zama Developer Program Mainnet Season 3 - Bounty Track
Welcome to the Zama Developer Program - Bounty Track!

Each month, we reward developers to create templates and resources for the Zama developer ecosystem

For this season, the challenge is to build a Confidential Wrapper Registry App — a production-ready app that surfaces every ERC-20 ↔ ERC-7984 wrapper pair on testnet, lets users wrap/unwrap, decrypt any ERC-7984 balance, and includes a Sepolia faucet for the official cTokenMocks.
Build the Confidential Wrapper Registry App
Objective
Build a production-ready dApp that turns the Zama Wrappers Registry into a usable product for every developer and user in the ecosystem.



When a user opens your app and connects a wallet, they should be able to:

* Browse the registry: See every official ERC-20 ↔ ERC-7984 wrapper pair on Sepolia.
* Wrap and unwrap: Convert any registry ERC-20 into its ERC-7984 confidential equivalent and back again, with a clean UX.
* Decrypt balances: View the decrypted balance of any ERC-7984 token in their wallet (not just registry tokens) via the EIP-712 user-decryption flow.
* Use the faucet (Sepolia): Claim the official cTokenMock test tokens listed in the Sepolia wrappers registry so they can immediately try the wrap/unwrap flow.



Deadline: July 7th, 23:59 AOE

Why this matters
Today, many developers spin up their own ERC-20 testnet tokens and ERC-7984 wrappers instead of using the ones that already exist in the official Zama Wrappers Registry. That fragments the ecosystem: every team ships against a slightly different set of tokens, integrations don't compose, and users end up with a wallet full of look-alike confidential assets that don't actually interoperate.



A great submission solves this by turning the official registry into a usable product — an app that every developer and user can point to, where the canonical ERC-20 ↔ ERC-7984 pairs are easy to find, easy to wrap/unwrap, easy to decrypt, and easy to extend with new pairs through a documented process. The goal is to make using existing wrappers the path of least resistance and reduce fragmentation across the ecosystem.

Requirements
Your submission must:

* Be a web dApp with a publicly accessible live URL where judges can connect a wallet and try every feature.

* Support Sepolia. Shield / unshield / decrypt must work.
* Source the wrapper registry as a hybrid: read the official onchain Wrappers Registry as the primary source of truth, and additionally support a local config to declare custom or dev-only pairs.
* Include every official cTokenMock listed in the Sepolia Wrappers Registry docs
* Support wrap (ERC-20 → ERC-7984) and unwrap (ERC-7984 → ERC-20) for every registry pair.
* Support user decryption of the connected wallet's balance for any ERC-7984 token, not only registered ones (paste-an-address or auto-detect flow).
* Provide a documented process for adding new ERC-20 ↔ ERC-7984 pairs to the app. The exact mechanism (local config, onchain registration, admin UI) is the submitter's choice, but the README must spell it out clearly with an example.
* Be open source in a public GitHub repository.
Topics to cover

Your dApp and its accompanying README should demonstrate:

* Reading the onchain Wrappers Registry and rendering pairs with token metadata (symbol, decimals, name, addresses on both networks)
* Faucet interaction with the official cTokenMocks on Sepolia
* Wrap flow: ERC-20 approval → wrap call → confirmation
* Unwrap flow: ERC-7984 → ERC-20 with the correct allowance / access-control setup
* EIP-712 user-decryption of ERC-7984 balances (the connected wallet's own balances, on any ERC-7984 token)
* Frontend integration with the FHEVM relayer SDK / fhevmjs
* Sensible error handling for missing approvals, insufficient balance, network mismatch, and unsupported tokens

Submission requirements
Your submission must include:

1. GitHub repository (public, open-source):
* Full source code of the App 
* README covering: live URL, supported networks, how the registry is sourced, how to add a new pair, and any deployment scripts

2. Live deployment
* A publicly accessible URL where judges can connect a wallet and use every feature on Sepolia

3. Demonstration video
* Maximum 3 minutes (real-person pitch only; AI-generated video or voice will not be considered)
* Show: browsing the registry, claiming from the Sepolia faucet, wrapping a cTokenMock, decrypting the resulting ERC-7984 balance, unwrapping back, and decrypting an arbitrary ERC-7984 token outside the registry
* Briefly explain how a new ERC-20 ↔ ERC-7984 pair would be added
4. A thread or article published on X introducing your project.
Judging criteria
Coverage: Are all official cTokenMocks (Sepolia) in the registry surfaced and working?
Correctness: Do wrap, unwrap, and user-decrypt produce the expected results onchain? Are EIP-712 flows implemented correctly?
Extensibility: How clean and well-documented is the path to adding a new ERC-20 ↔ ERC-7984 pair?
UX: Is the app pleasant to use? Does it handle approvals, network switching, and errors gracefully?
Code quality: Is the codebase clean, readable, well-typed, and well-documented?
Production-readiness: Is the live deployment stable on both networks? Could a real user trust it today?

Developer Resources:
* FHEVM Solidity Library
* Zama SDK and Legacy Relayer SDK
* Confidential token wrapper documentation
* Registry documentation

* Testnet addresses: Wrappers Registry (Sepolia)
* Mainnet addresses: Wrappers Registry (Ethereum)

https://docs.zama.org/protocol/sdk
https://github.com/zama-ai/relayer-sdk
https://docs.zama.org/protocol/protocol-apps/confidential-tokens/wrapper-registry
https://docs.zama.org/protocol/protocol-apps/confidential-tokens/confidential-wrapper
https://docs.zama.org/protocol/solidity-guides
https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia#wrappers-registry
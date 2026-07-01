// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

/**
 * @dev A standalone confidential ERC7984 token (no ERC20 wrapping).
 * Provides both a cleartext `mint` (convenient for testing) and a proof-based
 * `mint` for encrypted inputs.
 */
contract StandaloneCERC7984 is ERC7984, ZamaEthereumConfig {
    constructor(
        string memory name_,
        string memory symbol_,
        string memory tokenURI_,
        uint64 initialAmount_
    ) ERC7984(name_, symbol_, tokenURI_) {
        if (initialAmount_ > 0) {
            _mint(msg.sender, FHE.asEuint64(initialAmount_));
        }
    }

    /// @dev Mint from a cleartext amount. The caller reveals the amount on-chain.
    function mint(address to, uint64 amount) external returns (euint64) {
        return _mint(to, FHE.asEuint64(amount));
    }

    /// @dev Mint from an encrypted external input with its proof.
    function mint(address to, externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64) {
        return _mint(to, FHE.fromExternal(encryptedAmount, inputProof));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/**
 * @dev A confidential ERC7984 token that wraps an existing ERC20 (`token`).
 * Supports wrap/unwrap and the two-step unwrap finalization from
 * {ERC7984ERC20Wrapper}. All confidential logic is inherited; we only wire up
 * the constructors (the wrapper does not forward name/symbol/uri to ERC7984).
 */
contract CERC20Wrapper is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    constructor(
        IERC20 token,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984ERC20Wrapper(token) ERC7984(name_, symbol_, tokenURI_) {}
}

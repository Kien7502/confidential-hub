// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20, ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";

/**
 * @dev Public ERC20 (with ERC1363) used as the underlying token for wrapping.
 * Exposes a permissionless `mint` so the app faucet can fund test wallets.
 */
contract PublicERC20 is ERC1363 {
    uint8 private immutable _decimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        if (initialSupply_ > 0) {
            _mint(msg.sender, initialSupply_);
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

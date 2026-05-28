// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/AidenReactiveHandler.sol";

contract DeployHandler is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_ADDRESS");
        uint256 pk    = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        AidenReactiveHandler handler = new AidenReactiveHandler(agent);
        vm.stopBroadcast();

        console.log("Handler deployed to:", address(handler));
    }
}

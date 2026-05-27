// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Script is Foundry's base for deploy scripts — gives us vm.startBroadcast etc.
import "forge-std/Script.sol";
import "../src/AidenAgent.sol";

/// @notice Deploys AidenAgent to Somnia Testnet and registers the first NPC.
/// @dev Run with:
///   forge script script/Deploy.s.sol \
///     --rpc-url https://dream-rpc.somnia.network \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    function run() external {
        // vm.envUint reads an environment variable and parses it as a uint256.
        // We use this for the private key so it is NEVER hardcoded in source.
        // Export it before running: export PRIVATE_KEY=0x...
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // vm.startBroadcast / vm.stopBroadcast wrap the calls we want to send
        // as real transactions (vs. simulation-only).
        vm.startBroadcast(deployerKey);

        // 1. Deploy the contract
        AidenAgent agent = new AidenAgent();

        // 2. Register NPC id=0 ("Aiden") immediately so the web client
        //    can use npcId=0 without an extra setup step.
        agent.registerNPC("Aiden");

        vm.stopBroadcast();

        // console.log prints to stdout during --broadcast so you can copy
        // the address into web/src/abi.js.
        console.log("AidenAgent deployed at:", address(agent));
        console.log("NPC 0 ('Aiden') registered. Web client is ready.");
    }
}

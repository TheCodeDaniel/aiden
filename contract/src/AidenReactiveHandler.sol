// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {AidenAgent} from "./AidenAgent.sol";

/// @title AidenReactiveHandler
/// @notice Receives callbacks from the Somnia reactivity precompile whenever
///         AidenAgent emits an Interacted event. If the action was Betray AND
///         the player's standing is below -10, it autonomously applies an
///         additional -10 penalty — no human triggers this.
contract AidenReactiveHandler is SomniaEventHandler {

    bytes32 public constant INTERACTED_SIG =
        keccak256("Interacted(uint256,address,uint8,int256)");

    uint8   public constant BETRAY           = 2;
    int256  public constant REACTIVE_PENALTY = -10;
    int256  public constant THRESHOLD        = -10;

    AidenAgent public immutable agent;

    constructor(address agentAddress) {
        agent = AidenAgent(agentAddress);
    }

    /// @notice Called exclusively by the Somnia reactivity precompile (0x0100)
    ///         once a live subscription is registered.
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        if (emitter != address(agent)) return;
        if (eventTopics.length < 3) return;
        if (eventTopics[0] != INTERACTED_SIG) return;

        uint256 npcId  = uint256(eventTopics[1]);
        address player = address(uint160(uint256(eventTopics[2])));

        (uint8 action, int256 newStanding) = abi.decode(data, (uint8, int256));

        if (action != BETRAY) return;
        if (newStanding >= THRESHOLD) return;

        agent.applyReactivePenalty(npcId, player, REACTIVE_PENALTY);
    }

    /// @notice Demo function — mirrors exactly what the precompile would call.
    ///         Anyone can call this to demonstrate the autonomous retaliation
    ///         chain without needing the 32 STT subscription.
    ///         Pass the npcId, player address, action (2=Betray), and the
    ///         newStanding that was emitted by the Interacted event.
    /// @notice Demo function — runs the exact same logic as _onEvent would when
    ///         triggered by the precompile, without needing the 32 STT subscription.
    function simulatePrecompile(
        uint256 npcId,
        address player,
        uint8   action,
        int256  newStanding
    ) external {
        if (action != BETRAY) return;
        if (newStanding >= THRESHOLD) return;
        agent.applyReactivePenalty(npcId, player, REACTIVE_PENALTY);
    }

    receive() external payable {}
}

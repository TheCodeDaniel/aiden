// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {SomniaEventHandler} from "@somnia-chain/reactivity-contracts/contracts/SomniaEventHandler.sol";
import {SomniaExtensions} from "@somnia-chain/reactivity-contracts/contracts/interfaces/SomniaExtensions.sol";
import {AidenAgent} from "./AidenAgent.sol";

/// @title AidenReactiveHandler
/// @notice Receives callbacks from the Somnia reactivity precompile whenever
///         AidenAgent emits an Interacted event. If the action was Betray AND
///         the player's standing is below -10, it autonomously applies an
///         additional -10 penalty — no human triggers this.
contract AidenReactiveHandler is SomniaEventHandler {

    // Interacted(uint256 indexed npcId, address indexed player, ActionType action, int256 newStanding)
    bytes32 public constant INTERACTED_SIG =
        keccak256("Interacted(uint256,address,uint8,int256)");

    uint8 public constant BETRAY = 2;

    int256 public constant REACTIVE_PENALTY = -10;

    // Standing threshold that triggers retaliation — avoids reacting to every Betray
    int256 public constant THRESHOLD = -10;

    AidenAgent public immutable agent;

    constructor(address agentAddress) {
        agent = AidenAgent(agentAddress);
    }

    /// @notice Called by the Somnia reactivity precompile (address 0x0100) when
    ///         AidenAgent emits an Interacted event matching the subscription filter.
    /// @param emitter      The contract that emitted the event (must equal agent).
    /// @param eventTopics  [0]=event sig, [1]=npcId, [2]=player address.
    /// @param data         ABI-encoded (ActionType action, int256 newStanding).
    function _onEvent(
        address emitter,
        bytes32[] calldata eventTopics,
        bytes calldata data
    ) internal override {
        // Only process events from our own agent contract
        if (emitter != address(agent)) return;

        // Confirm this is the Interacted event
        if (eventTopics.length < 3) return;
        if (eventTopics[0] != INTERACTED_SIG) return;

        uint256 npcId  = uint256(eventTopics[1]);
        address player = address(uint160(uint256(eventTopics[2])));

        (uint8 action, int256 newStanding) = abi.decode(data, (uint8, int256));

        // React only to Betray that has pushed standing below the threshold
        if (action != BETRAY) return;
        if (newStanding >= THRESHOLD) return;

        agent.applyReactivePenalty(npcId, player, REACTIVE_PENALTY);
    }

    /// @notice Register a Somnia Reactivity subscription so the precompile calls
    ///         _onEvent whenever AidenAgent emits Interacted.
    /// @dev    The caller (owner) needs >= 32 STT balance. Send STT to this
    ///         contract before calling, then withdraw any excess after.
    function registerSubscription() external returns (uint256 subscriptionId) {
        SomniaExtensions.SubscriptionFilter memory filter = SomniaExtensions.SubscriptionFilter({
            eventTopics: [INTERACTED_SIG, bytes32(0), bytes32(0), bytes32(0)],
            origin: address(0),
            emitter: address(agent)
        });

        subscriptionId = SomniaExtensions.subscribe(
            address(this),
            filter,
            SomniaExtensions.defaultSubscriptionOptions()
        );
    }

    receive() external payable {}
}

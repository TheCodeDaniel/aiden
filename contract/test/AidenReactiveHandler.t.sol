// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../src/AidenAgent.sol";
import "../src/AidenReactiveHandler.sol";

/// @notice Tests for the Somnia Reactivity handler.
/// The precompile is at address 0x0100 — vm.prank fakes a call from it.
contract AidenReactiveHandlerTest is Test {

    AidenAgent agent;
    AidenReactiveHandler handler;

    address constant PRECOMPILE = address(0x0100);
    address constant PLAYER     = address(0xBEEF);

    function setUp() public {
        agent   = new AidenAgent();
        handler = new AidenReactiveHandler(address(agent));

        // Register NPC id=0
        agent.registerNPC("Aiden");

        // Authorize the handler so it can call applyReactivePenalty
        agent.authorizeHandler(address(handler));
    }

    // -------------------------------------------------------------------------
    // Helper — build the topics/data the precompile would pass for Interacted
    // -------------------------------------------------------------------------
    function _makeTopics(uint256 npcId, address player)
        internal pure returns (bytes32[] memory topics)
    {
        topics = new bytes32[](3);
        topics[0] = keccak256("Interacted(uint256,address,uint8,int256)");
        topics[1] = bytes32(npcId);
        topics[2] = bytes32(uint256(uint160(player)));
    }

    function _makeData(uint8 action, int256 newStanding)
        internal pure returns (bytes memory)
    {
        return abi.encode(action, newStanding);
    }

    // -------------------------------------------------------------------------
    // 1. onEvent can only be called by the precompile
    // -------------------------------------------------------------------------
    function testOnEventRevertsForNonPrecompile() public {
        bytes32[] memory topics = _makeTopics(0, PLAYER);
        bytes memory data = _makeData(2, -20);

        vm.expectRevert();
        handler.onEvent(address(agent), topics, data);
    }

    // -------------------------------------------------------------------------
    // 2. Betray below threshold → penalty applied and NpcReacted emitted
    // -------------------------------------------------------------------------
    function testBetrayBelowThresholdAppliesPenalty() public {
        // Bring PLAYER's standing to -15 (one Betray from zero)
        vm.prank(PLAYER);
        agent.interact(0, AidenAgent.ActionType.Betray);
        assertEq(agent.getStanding(0, PLAYER), -15);

        // Simulate precompile calling the handler
        bytes32[] memory topics = _makeTopics(0, PLAYER);
        bytes memory data = _makeData(2, -15); // newStanding = -15 < -10 → should react

        vm.expectEmit(true, true, false, true);
        emit AidenAgent.NpcReacted(0, PLAYER, "Aiden retaliates", -25);

        vm.prank(PRECOMPILE);
        handler.onEvent(address(agent), topics, data);

        // Standing should be -15 + (-10) = -25
        assertEq(agent.getStanding(0, PLAYER), -25);
    }

    // -------------------------------------------------------------------------
    // 3. Betray above threshold (standing >= -10) → no reaction
    // -------------------------------------------------------------------------
    function testBetrayAboveThresholdNoReaction() public {
        // Give PLAYER +20 standing first, then Betray → standing = +5 (above -10)
        vm.prank(PLAYER);
        agent.interact(0, AidenAgent.ActionType.Help); // +10
        vm.prank(PLAYER);
        agent.interact(0, AidenAgent.ActionType.Help); // +20
        vm.prank(PLAYER);
        agent.interact(0, AidenAgent.ActionType.Betray); // -15 → +5
        assertEq(agent.getStanding(0, PLAYER), 5);

        bytes32[] memory topics = _makeTopics(0, PLAYER);
        bytes memory data = _makeData(2, 5); // newStanding = 5 >= -10 → no reaction

        vm.prank(PRECOMPILE);
        handler.onEvent(address(agent), topics, data); // should not revert, no effect

        // Standing unchanged
        assertEq(agent.getStanding(0, PLAYER), 5);
    }

    // -------------------------------------------------------------------------
    // 4. Non-Betray action → no reaction
    // -------------------------------------------------------------------------
    function testHelpEventNoReaction() public {
        bytes32[] memory topics = _makeTopics(0, PLAYER);
        bytes memory data = _makeData(1, 10); // action=1 (Help), standing=10

        vm.prank(PRECOMPILE);
        handler.onEvent(address(agent), topics, data); // silent no-op

        assertEq(agent.getStanding(0, PLAYER), 0);
    }

    // -------------------------------------------------------------------------
    // 5. Wrong emitter → no reaction
    // -------------------------------------------------------------------------
    function testWrongEmitterNoReaction() public {
        bytes32[] memory topics = _makeTopics(0, PLAYER);
        bytes memory data = _makeData(2, -20);

        vm.prank(PRECOMPILE);
        handler.onEvent(address(0xDEAD), topics, data); // wrong emitter

        assertEq(agent.getStanding(0, PLAYER), 0);
    }

    // -------------------------------------------------------------------------
    // 6. applyReactivePenalty reverts if not called by handler
    // -------------------------------------------------------------------------
    function testApplyPenaltyRevertsForNonHandler() public {
        vm.expectRevert(bytes("not handler"));
        agent.applyReactivePenalty(0, PLAYER, -10);
    }
}

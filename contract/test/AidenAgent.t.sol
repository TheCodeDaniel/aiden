// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Foundry's test base. Gives us vm cheatcodes, assertion helpers, etc.
import "forge-std/Test.sol";
import "../src/AidenAgent.sol";

/// @notice Unit tests for AidenAgent.
/// Run with: forge test
/// Each test function must start with "test" for Foundry to pick it up.
contract AidenAgentTest is Test {

    AidenAgent agent; // the contract under test

    /// @notice setUp() runs before EVERY test function — a fresh contract each time.
    function setUp() public {
        agent = new AidenAgent();
    }

    // -------------------------------------------------------------------------
    // 1. Register an NPC and verify the stored data
    // -------------------------------------------------------------------------
    function testRegisterNPC() public {
        agent.registerNPC("Aiden");

        // npcCount should now be 1 (we registered one NPC)
        assertEq(agent.npcCount(), 1);

        // getNPC returns (id, name, exists) — destructure with named vars
        (uint256 id, string memory name, bool exists) = agent.getNPC(0);
        assertEq(id, 0);
        assertEq(name, "Aiden");
        assertTrue(exists);
    }

    // -------------------------------------------------------------------------
    // 2. First NPC always gets id 0
    // -------------------------------------------------------------------------
    function testFirstNpcIdIsZero() public {
        // registerNPC returns the assigned id
        uint256 id = agent.registerNPC("First");
        assertEq(id, 0);
    }

    // -------------------------------------------------------------------------
    // 3. Help adds +10 to standing
    // -------------------------------------------------------------------------
    function testHelpIncreasesStanding() public {
        agent.registerNPC("Aiden");
        // address(this) is the test contract itself — it acts as "the player" here
        agent.interact(0, AidenAgent.ActionType.Help);
        assertEq(agent.getStanding(0, address(this)), 10);
    }

    // -------------------------------------------------------------------------
    // 4. Betray subtracts 15 — standing can go negative
    // -------------------------------------------------------------------------
    function testBetrayDecreasesStanding() public {
        agent.registerNPC("Aiden");
        agent.interact(0, AidenAgent.ActionType.Betray);
        assertEq(agent.getStanding(0, address(this)), -15);
    }

    // -------------------------------------------------------------------------
    // 5. Trade adds +2 to standing
    // -------------------------------------------------------------------------
    function testTradeIncreasesStanding() public {
        agent.registerNPC("Aiden");
        agent.interact(0, AidenAgent.ActionType.Trade);
        assertEq(agent.getStanding(0, address(this)), 2);
    }

    // -------------------------------------------------------------------------
    // 6. Multiple interactions accumulate: Help(10) + Help(10) + Betray(-15) = 5
    // -------------------------------------------------------------------------
    function testStandingAccumulates() public {
        agent.registerNPC("Aiden");
        agent.interact(0, AidenAgent.ActionType.Help);   // +10 → 10
        agent.interact(0, AidenAgent.ActionType.Help);   // +10 → 20
        agent.interact(0, AidenAgent.ActionType.Betray); // -15 → 5
        assertEq(agent.getStanding(0, address(this)), 5);
    }

    // -------------------------------------------------------------------------
    // 7. Interacting with an unregistered NPC must revert
    // -------------------------------------------------------------------------
    function testInteractRevertsForMissingNPC() public {
        // vm.expectRevert tells Foundry: "the NEXT call must revert with this message"
        // If the call doesn't revert, or reverts with a different message, the test fails.
        vm.expectRevert(bytes("NPC does not exist"));
        agent.interact(99, AidenAgent.ActionType.Help); // id 99 was never registered
    }

    // -------------------------------------------------------------------------
    // 8. Each player has their own standing — no cross-contamination
    // -------------------------------------------------------------------------
    function testStandingIsPerPlayer() public {
        agent.registerNPC("Aiden");

        address alice = address(0xA11CE);
        address bob   = address(0xB0B);

        // vm.prank makes the NEXT external call come from the specified address.
        // It's like temporarily impersonating a different wallet.
        vm.prank(alice);
        agent.interact(0, AidenAgent.ActionType.Help); // alice: +10

        vm.prank(bob);
        agent.interact(0, AidenAgent.ActionType.Betray); // bob: -15

        // Their standings must be completely independent
        assertEq(agent.getStanding(0, alice), 10);
        assertEq(agent.getStanding(0, bob), -15);
    }

    // -------------------------------------------------------------------------
    // 9. The Interacted event fires with the correct arguments
    // -------------------------------------------------------------------------
    function testInteractedEventEmitted() public {
        agent.registerNPC("Aiden");

        // vm.expectEmit(checkTopic1, checkTopic2, checkTopic3, checkData)
        // The four bools say which parts of the event to verify:
        //   topic1 = first indexed param (npcId)
        //   topic2 = second indexed param (player)
        //   topic3 = third indexed param (none in this event, so false)
        //   data   = non-indexed params (action, newStanding)
        // We check all parts.
        vm.expectEmit(true, true, false, true);

        // Emit what we EXPECT to see. Foundry compares the next real event against this.
        emit AidenAgent.Interacted(
            0,               // npcId
            address(this),   // player (the test contract)
            AidenAgent.ActionType.Help,
            10               // newStanding after Help
        );

        // Trigger the real event
        agent.interact(0, AidenAgent.ActionType.Help);
    }
}

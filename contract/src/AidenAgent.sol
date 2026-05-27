// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AidenAgent — autonomous NPC agents with persistent onchain memory
/// @notice This contract lets game NPCs remember how each player has treated them.
///         Every Help, Trade, or Betray action is stored on the blockchain, so the
///         NPC's memory persists across sessions and across any game engine.
contract AidenAgent {

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice The three actions a player can take toward an NPC.
    /// Solidity enums are stored as uint8 under the hood (Trade=0, Help=1, Betray=2).
    enum ActionType { Trade, Help, Betray }

    /// @notice All the data we store for one NPC.
    struct NPC {
        uint256 id;     // unique id, assigned sequentially starting from 0
        string  name;   // display name, e.g. "Aiden"
        bool    exists; // guard flag so we can detect unregistered ids
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Look up an NPC by its id.
    /// Public: Solidity auto-generates a getter so anyone can read npcs[id].
    mapping(uint256 => NPC) public npcs;

    /// @notice The persistent memory: npcId → player address → standing value.
    /// int256 (signed) lets standing go negative after betrayals.
    mapping(uint256 => mapping(address => int256)) public standing;

    /// @notice How many NPCs have been registered. Also the id that the NEXT
    ///         registerNPC call will assign (ids start at 0).
    uint256 public npcCount;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Fires when a new NPC is created.
    /// @param npcId  The id assigned to the new NPC.
    /// @param name   The name passed to registerNPC.
    event NPCRegistered(uint256 indexed npcId, string name);

    /// @notice Fires every time a player interacts with an NPC.
    /// Clients (web, mobile, Unity…) can watch this event to update the UI
    /// without re-reading the contract.
    /// @param npcId       Which NPC was interacted with.
    /// @param player      The wallet address of the player.
    /// @param action      Trade, Help, or Betray.
    /// @param newStanding The player's standing with this NPC after the action.
    event Interacted(
        uint256 indexed npcId,
        address indexed player,
        ActionType action,
        int256 newStanding
    );

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    /// @notice Register a new NPC with the given name.
    /// @dev    Uses post-increment on npcCount so the first NPC gets id 0.
    /// @param  name The NPC's display name.
    /// @return id   The id assigned to the new NPC.
    function registerNPC(string calldata name) external returns (uint256) {
        // npcCount++ returns the CURRENT value, then increments.
        // So the first call returns 0 and leaves npcCount == 1.
        uint256 id = npcCount++;
        npcs[id] = NPC({ id: id, name: name, exists: true });
        emit NPCRegistered(id, name);
        return id;
    }

    /// @notice Record an action by the caller toward the specified NPC.
    /// @dev    Reverts if the NPC has not been registered yet.
    ///         Uses msg.sender as the player identity — no parameter needed.
    /// @param npcId  The id of the NPC being interacted with.
    /// @param action Trade (0), Help (1), or Betray (2).
    function interact(uint256 npcId, ActionType action) external {
        // Guard: reject interactions with NPCs that don't exist yet.
        require(npcs[npcId].exists, "NPC does not exist");

        // Add the standing delta for this action to the running total.
        // += works on int256, so the value can go negative.
        standing[npcId][msg.sender] += _delta(action);

        emit Interacted(npcId, msg.sender, action, standing[npcId][msg.sender]);
    }

    /// @notice Read the standing a specific player has with a specific NPC.
    /// @param npcId  The NPC's id.
    /// @param player The player's wallet address.
    /// @return       The standing value (can be negative).
    function getStanding(uint256 npcId, address player)
        external view returns (int256)
    {
        return standing[npcId][player];
    }

    /// @notice Read the metadata for a registered NPC.
    /// @param npcId  The NPC's id.
    /// @return id     The NPC's id (same as the input).
    /// @return name   The NPC's display name.
    /// @return exists True if this NPC has been registered; false otherwise.
    function getNPC(uint256 npcId)
        external view returns (uint256 id, string memory name, bool exists)
    {
        NPC memory n = npcs[npcId];
        return (n.id, n.name, n.exists);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /// @notice Map an ActionType to its standing delta.
    /// @dev    Pure: reads no state, modifies no state.
    ///         Trade is the default/fallback — no else branch needed.
    function _delta(ActionType action) internal pure returns (int256) {
        if (action == ActionType.Help)   return  10; // generous reward
        if (action == ActionType.Betray) return -15; // heavy penalty, drives negative
        return 2; // Trade — small positive, the default
    }
}

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
    enum ActionType { Trade, Help, Betray }

    /// @notice All the data we store for one NPC.
    struct NPC {
        uint256 id;
        string  name;
        bool    exists;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(uint256 => NPC) public npcs;
    mapping(uint256 => mapping(address => int256)) public standing;
    uint256 public npcCount;

    /// @notice The AidenReactiveHandler contract authorised to call applyReactivePenalty.
    address public reactiveHandler;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event NPCRegistered(uint256 indexed npcId, string name);

    event Interacted(
        uint256 indexed npcId,
        address indexed player,
        ActionType action,
        int256 newStanding
    );

    /// @notice Emitted by applyReactivePenalty — signals that the NPC retaliated
    ///         autonomously in response to a player's Betray action.
    event NpcReacted(
        uint256 indexed npcId,
        address indexed player,
        string  reaction,
        int256  newStanding
    );

    // -------------------------------------------------------------------------
    // Functions
    // -------------------------------------------------------------------------

    function registerNPC(string calldata name) external returns (uint256) {
        uint256 id = npcCount++;
        npcs[id] = NPC({ id: id, name: name, exists: true });
        emit NPCRegistered(id, name);
        return id;
    }

    function interact(uint256 npcId, ActionType action) external {
        require(npcs[npcId].exists, "NPC does not exist");
        standing[npcId][msg.sender] += _delta(action);
        emit Interacted(npcId, msg.sender, action, standing[npcId][msg.sender]);
    }

    function getStanding(uint256 npcId, address player)
        external view returns (int256)
    {
        return standing[npcId][player];
    }

    function getNPC(uint256 npcId)
        external view returns (uint256 id, string memory name, bool exists)
    {
        NPC memory n = npcs[npcId];
        return (n.id, n.name, n.exists);
    }

    /// @notice Set the reactive handler contract address. Owner-only via simple
    ///         deployer pattern — the deployer address is stored at construction.
    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    /// @notice Authorise the AidenReactiveHandler to call applyReactivePenalty.
    function authorizeHandler(address handler) external {
        require(msg.sender == owner, "not owner");
        reactiveHandler = handler;
    }

    /// @notice Called by the authorised reactive handler to apply an autonomous
    ///         standing penalty after a Betray event crosses the threshold.
    ///         The handler is invoked by the Somnia reactivity precompile — no
    ///         human triggers this function.
    function applyReactivePenalty(
        uint256 npcId,
        address player,
        int256  delta
    ) external {
        require(msg.sender == reactiveHandler, "not handler");
        require(npcs[npcId].exists, "NPC does not exist");
        standing[npcId][player] += delta;
        emit NpcReacted(npcId, player, "Aiden retaliates", standing[npcId][player]);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _delta(ActionType action) internal pure returns (int256) {
        if (action == ActionType.Help)   return  10;
        if (action == ActionType.Betray) return -15;
        return 2;
    }
}

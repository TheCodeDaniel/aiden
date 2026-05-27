# Aiden — Build Specification for Claude Code

**Read this entire document before writing code. Build in the order given. Do not skip the acceptance checks.**

This spec describes two deliverables in one repository:
1. **The contract** — `AidenAgent`, a Solidity smart contract on Somnia (Foundry project, fully tested).
2. **The 3D web client** — a minimal Three.js game that calls the deployed contract.

A third piece (a Flutter SDK) exists separately and is **out of scope for this build** — do not touch it.

The person you are building for is a Flutter/Dart engineer, new to Solidity and to Three.js. **Comment generously. Explain every non-obvious line.** Favor clarity over cleverness.

---

## 0. What Aiden is

Aiden turns game NPCs into autonomous onchain agents. Each NPC has an onchain identity and a persistent memory: its "standing" toward each player. When a player acts toward an NPC (trade, help, or betray), a transaction updates that memory onchain and the contract emits an event. The NPC remembers across sessions because the memory lives on the blockchain, not in any app.

The contract is the product. Clients (the web game here; a Flutter app elsewhere) are interchangeable callers. Build accordingly: the contract's public interface must be clean and engine-neutral.

---

## 1. Repository structure

Create this exact layout:

```
aiden/
├── README.md                  # top-level: what Aiden is + how to run both parts
├── contract/                  # Foundry project (Deliverable 1)
│   ├── foundry.toml
│   ├── src/
│   │   └── AidenAgent.sol
│   ├── test/
│   │   └── AidenAgent.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── README.md              # contract-specific: the API docs (functions + events)
└── web/                       # Three.js client (Deliverable 2)
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── src/
    │   ├── main.js            # entry: sets up scene + chain, wires them
    │   ├── scene.js           # Three.js 3D scene
    │   ├── chain.js           # all contract interaction (viem)
    │   └── abi.js             # contract ABI + deployed address
    └── README.md              # web-specific: how to run, how to configure address
```

---

## 2. Somnia network configuration (use these exact values)

| Item | Value |
|---|---|
| Network | Somnia Shannon Testnet |
| Chain ID | `50312` |
| RPC URL | `https://dream-rpc.somnia.network` |
| Native token | STT |
| Explorer | `https://shannon-explorer.somnia.network` |
| Solidity version | `0.8.28` |

Somnia is fully EVM-compatible — standard Foundry, viem, and Solidity all work without modification.

---

# DELIVERABLE 1 — The Contract

## 3. Contract specification: `AidenAgent.sol`

`pragma solidity ^0.8.28;` · SPDX MIT license.

### Data
- `enum ActionType { Trade, Help, Betray }`
- `struct NPC { uint256 id; string name; bool exists; }`
- `mapping(uint256 => NPC) public npcs;`
- `mapping(uint256 => mapping(address => int256)) public standing;` — the persistent memory: npcId → player → standing value.
- `uint256 public npcCount;` — total NPCs registered; also used as the next id.

### Events
- `event NPCRegistered(uint256 indexed npcId, string name);`
- `event Interacted(uint256 indexed npcId, address indexed player, ActionType action, int256 newStanding);`

### Functions
| Function | Signature | Behavior |
|---|---|---|
| Register | `registerNPC(string calldata name) external returns (uint256)` | Assigns `id = npcCount`, increments `npcCount`, stores the NPC, emits `NPCRegistered`, returns the id. |
| Interact | `interact(uint256 npcId, ActionType action) external` | Reverts with `"NPC does not exist"` if the NPC isn't registered. Applies the standing delta for `msg.sender`. Emits `Interacted` with the new standing. |
| Read standing | `getStanding(uint256 npcId, address player) external view returns (int256)` | Returns `standing[npcId][player]`. |
| Read NPC | `getNPC(uint256 npcId) external view returns (uint256 id, string memory name, bool exists)` | Returns NPC metadata. |

### Standing deltas (internal pure helper `_delta`)
- `Help` → `+10`
- `Betray` → `-15`
- `Trade` → `+2`

### Constraints
- No constructor arguments.
- No external dependencies (no OpenZeppelin) — keep it self-contained.
- `int256` for standing so betrayal can drive it negative.
- Comment every state variable, event, and function with a plain-English explanation aimed at a Solidity beginner.

### Reference implementation
Use this as the basis. You may add comments and NatSpec; do not change the interface.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AidenAgent — autonomous NPC agents with persistent onchain memory
contract AidenAgent {
    enum ActionType { Trade, Help, Betray }

    struct NPC { uint256 id; string name; bool exists; }

    mapping(uint256 => NPC) public npcs;
    mapping(uint256 => mapping(address => int256)) public standing;
    uint256 public npcCount;

    event NPCRegistered(uint256 indexed npcId, string name);
    event Interacted(
        uint256 indexed npcId,
        address indexed player,
        ActionType action,
        int256 newStanding
    );

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

    function _delta(ActionType action) internal pure returns (int256) {
        if (action == ActionType.Help)   return  10;
        if (action == ActionType.Betray) return -15;
        return 2; // Trade
    }
}
```

## 4. Contract tests: `AidenAgent.t.sol`

Foundry tests, run with `forge test`. Cover at minimum:

1. `testRegisterNPC` — register an NPC, assert `npcCount` incremented and `getNPC` returns the right name and `exists == true`.
2. `testFirstNpcIdIsZero` — the first registered NPC has id `0`.
3. `testHelpIncreasesStanding` — register, interact `Help`, assert standing `== 10`.
4. `testBetrayDecreasesStanding` — register, interact `Betray`, assert standing `== -15` (negative works).
5. `testTradeIncreasesStanding` — register, interact `Trade`, assert standing `== 2`.
6. `testStandingAccumulates` — multiple interactions accumulate correctly (e.g. Help + Help + Betray == 5).
7. `testInteractRevertsForMissingNPC` — `interact` on an unregistered id reverts with `"NPC does not exist"`. Use `vm.expectRevert`.
8. `testStandingIsPerPlayer` — two different addresses (`vm.prank`) interacting with the same NPC keep separate standings.
9. `testInteractedEventEmitted` — use `vm.expectEmit` to assert the `Interacted` event fires with correct args.

All tests must pass. Do not deploy until `forge test` is green.

## 5. Deploy script: `Deploy.s.sol`

A Foundry script that deploys `AidenAgent`. Reads the deployer private key from an environment variable (`PRIVATE_KEY`) — never hardcode a key.

Provide, in `contract/README.md`, the exact commands:
- Install Foundry.
- `forge build`
- `forge test`
- Deploy: `forge script script/Deploy.s.sol --rpc-url https://dream-rpc.somnia.network --private-key $PRIVATE_KEY --broadcast`
- Where to get STT test tokens (Somnia faucet / Discord `#dev-chat`).
- After deploy: copy the contract address — it goes into `web/src/abi.js`.

## 6. Contract README = the API docs

`contract/README.md` must document, for any future game developer in any engine:
- The deployed contract address (placeholder until deployed).
- Each public function: signature, parameters, return value, plain-English description.
- Both events and their fields.
- A short note: "Any EVM-capable engine — Unity, Unreal, web — calls these same functions. This is Aiden's engine-agnostic API."

---

# DELIVERABLE 2 — The 3D Web Client

## 7. Purpose and hard scope limits

This is a **test harness, not a game.** Its only job: prove the contract works and is engine-agnostic, in a visual way. 

**Build exactly this and nothing more:**
- A flat ground plane and basic lighting.
- A player object (a simple capsule or box) controlled with WASD / arrow keys.
- One NPC object (a distinct colored shape) at a fixed position.
- When the player is within a set distance of the NPC, an interaction panel appears with three buttons: **Trade**, **Help**, **Betray**.
- The NPC displays its current standing toward the player (a number, as an HTML overlay above or near the NPC).
- The NPC's color reflects standing: green when positive, red when negative, neutral grey near zero.
- A small status line showing wallet connection and the last transaction state.

**Do NOT build:** multiple levels, combat, inventory, quests, plot, sound, loaded 3D models, animations, physics engines, multiplayer. If a feature is not in the list above, do not build it.

## 8. Web stack
- **Three.js** — the 3D scene.
- **viem** — all blockchain interaction.
- **Vite** — dev server and build.
- Plain JavaScript (ES modules). No React, no framework.

## 9. Chain integration: `chain.js`

All contract logic lives here, isolated from the scene. It must:
- Define the Somnia Shannon Testnet chain object for viem (id `50312`, RPC `https://dream-rpc.somnia.network`).
- Connect to a wallet via the browser injected provider (`window.ethereum`, e.g. MetaMask) — a `connectWallet()` function that prompts connection and switches/adds the Somnia network if needed.
- Expose async functions:
  - `connectWallet()` → returns the connected address.
  - `getStanding(npcId)` → reads standing for the connected player.
  - `interact(npcId, action)` → sends the `interact` transaction; `action` is `0|1|2` for Trade/Help/Betray; waits for the receipt.
  - `watchInteractions(npcId, callback)` → subscribes to the `Interacted` event and calls `callback` with the new standing on each event.
- Handle the no-wallet case gracefully: if `window.ethereum` is absent, show a clear message in the UI ("Install MetaMask and add Somnia Testnet"), and let the rest of the scene still render.

`abi.js` exports the contract ABI (derived from `AidenAgent.sol`) and a `CONTRACT_ADDRESS` constant with a clearly-marked placeholder to be filled after deployment.

## 10. Scene: `scene.js`
- Standard Three.js setup: scene, perspective camera, renderer, resize handling, animation loop.
- Ground plane, ambient + directional light.
- Player mesh; keyboard movement in the animation loop. Keep the camera following the player (simple offset follow is fine).
- NPC mesh at a fixed position.
- Each frame: compute player–NPC distance; expose whether the player is "in range".
- Provide a `setNpcStanding(value)` method that updates the NPC color and the standing label.

## 11. Wiring: `main.js`
- Initialize the scene and the chain module.
- On load: connect wallet (or show the no-wallet message), then `getStanding` and display it.
- Show the interaction panel only when the player is in range of the NPC.
- Button handlers call `chain.interact(...)`; while a tx is pending, disable buttons and show "pending"; on success, update the standing display.
- Call `watchInteractions` so the standing updates live from the event as well as from the tx receipt.

## 12. The NPC needs to exist onchain first
The contract starts with zero NPCs. Before the web client can interact, one NPC must be registered. Handle this in **one** of these ways and document which in `web/README.md`:
- Preferred: add a step to the deploy script (or a second small script) that calls `registerNPC("Aiden")` right after deploy, so NPC id `0` always exists.
- The web client then uses `npcId = 0` throughout.

## 13. Web README
`web/README.md` must explain: how to `npm install` and `npm run dev`; where to paste the deployed contract address; that MetaMask with Somnia Testnet and some STT is required; and the expected flow (connect → walk to NPC → act → standing changes → reload → standing persists).

---

## 14. Build order (follow exactly)

1. Scaffold the repo structure (section 1).
2. Foundry project: write `AidenAgent.sol` (section 3).
3. Write `AidenAgent.t.sol` (section 4). Run `forge test`. **All green before continuing.**
4. Write `Deploy.s.sol` + NPC registration (sections 5, 12) and `contract/README.md` (section 6).
5. Scaffold the Vite + Three.js + viem project in `web/`.
6. `abi.js` and `chain.js` (section 9) — get wallet connect + read working first.
7. `scene.js` (section 10) — get the 3D scene + movement working.
8. `main.js` (section 11) — wire them together.
9. `web/README.md` (section 13) and the top-level `README.md`.

## 15. Acceptance criteria — the build is done when ALL are true

**Contract**
- [ ] `forge build` succeeds with Solidity 0.8.28.
- [ ] `forge test` passes every test in section 4.
- [ ] `Deploy.s.sol` runs and the deploy command is documented.
- [ ] `contract/README.md` documents every function and event as a usable API.

**Web client**
- [ ] `npm install && npm run dev` starts the app with no errors.
- [ ] The 3D scene renders: ground, player, NPC; WASD moves the player.
- [ ] The interaction panel appears only when in range of the NPC.
- [ ] With MetaMask on Somnia Testnet, clicking Help/Betray/Trade sends a real transaction and the NPC's standing updates.
- [ ] Reloading the page shows the same standing (proves onchain persistence).
- [ ] No-wallet case shows a clear message instead of crashing.

**Both**
- [ ] Every file has comments explaining non-obvious code (the reader is new to Solidity and Three.js).
- [ ] The top-level `README.md` explains the whole project and how the two parts relate.

---

## 16. Notes for the builder

- The person reviewing your code is learning Solidity and Three.js by reading it. Over-comment. When you use a Foundry cheatcode (`vm.prank`, `vm.expectRevert`, `vm.expectEmit`) or a viem concept (public client, wallet client), add a one-line comment saying what it does and why.
- Keep `chain.js` strictly separate from `scene.js` — the whole point of Aiden is that the chain logic is independent of any client. The separation is the architecture, not a detail.
- Do not add scope. If something seems like it would be "nice," it is out of scope. The contract and the test-harness scene, working and tested, is the entire job.
- Out of scope entirely: the Flutter SDK. Do not create, modify, or reference Flutter/Dart files.
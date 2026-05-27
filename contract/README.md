# AidenAgent — Contract API

> Any EVM-capable engine — Unity, Unreal, web, Flutter — calls these same functions.
> This is Aiden's engine-agnostic API. The contract is the product; clients are interchangeable.

---

## Deployed Address

```
REPLACE_WITH_DEPLOYED_ADDRESS
```

After deploying with the script below, paste the printed address here and into `web/src/abi.js`.

Network: **Somnia Shannon Testnet** (Chain ID `50312`)
Explorer: https://shannon-explorer.somnia.network

---

## Quick Start

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Build

```bash
cd contract
forge build
```

### 3. Test

```bash
forge test
# Expected: 9 tests passed, 0 failed
```

### 4. Deploy to Somnia Testnet

```bash
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY
forge script script/Deploy.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --broadcast
```

The script deploys the contract **and** registers NPC id=0 ("Aiden") in the same transaction batch. The web client uses `npcId=0` throughout.

### 5. Get STT test tokens

- Somnia faucet: https://faucet.somnia.network
- Or ask in the Somnia Discord `#dev-chat` channel.

---

## Functions

### `registerNPC(string calldata name) → uint256`

Registers a new NPC with the given display name.

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | The NPC's display name, e.g. `"Aiden"` |

Returns the **id** assigned to the new NPC (starts at 0, increments by 1).

Emits: `NPCRegistered(npcId, name)`

---

### `interact(uint256 npcId, ActionType action)`

Records a player action toward the specified NPC. Updates the caller's standing with that NPC.

| Parameter | Type | Description |
|---|---|---|
| `npcId` | `uint256` | The id of the NPC to interact with |
| `action` | `ActionType` | `0` = Trade (+2), `1` = Help (+10), `2` = Betray (-15) |

Reverts with `"NPC does not exist"` if the NPC hasn't been registered.

Emits: `Interacted(npcId, player, action, newStanding)`

---

### `getStanding(uint256 npcId, address player) → int256`

Returns the player's current standing with the specified NPC.

| Parameter | Type | Description |
|---|---|---|
| `npcId` | `uint256` | The NPC's id |
| `player` | `address` | The player's wallet address |

Returns a signed integer — can be negative after betrayals.

---

### `getNPC(uint256 npcId) → (uint256 id, string name, bool exists)`

Returns metadata for the specified NPC.

| Return | Type | Description |
|---|---|---|
| `id` | `uint256` | Same as the input `npcId` |
| `name` | `string` | The NPC's display name |
| `exists` | `bool` | `true` if registered, `false` if not |

---

## Events

### `NPCRegistered(uint256 indexed npcId, string name)`

Fired when `registerNPC` succeeds.

| Field | Description |
|---|---|
| `npcId` (indexed) | The id assigned to the new NPC |
| `name` | The NPC's display name |

---

### `Interacted(uint256 indexed npcId, address indexed player, ActionType action, int256 newStanding)`

Fired on every successful `interact` call.

| Field | Description |
|---|---|
| `npcId` (indexed) | Which NPC was involved |
| `player` (indexed) | The player's wallet address |
| `action` | `0`=Trade, `1`=Help, `2`=Betray |
| `newStanding` | The player's standing with this NPC after the action |

---

## Standing Deltas

| Action | Delta |
|---|---|
| Help | +10 |
| Trade | +2 |
| Betray | −15 |

Standing accumulates over all interactions. It is stored as `int256` and can go negative.

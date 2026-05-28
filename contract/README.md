# AidenAgent — Contract

The smart contract that gives NPCs persistent onchain memory.

> Any EVM-capable engine — Unity, Unreal, web, Flutter — calls these same functions.
> This is Aiden's engine-agnostic API. The contract is the product; clients are interchangeable.

**Deployed address (Somnia Shannon Testnet):**
```
0xa0838cf368F6262583F488e95d3803A8A4BF3D87
```
View on explorer: https://shannon-explorer.somnia.network

---

## Prerequisites

### Install Foundry

Foundry is the Solidity development toolkit (compiler, test runner, deploy tool).

**macOS / Linux:**
```bash
curl -L https://foundry.paradigm.xyz | bash
# Close and reopen your terminal, then run:
foundryup
```

**Windows (PowerShell — run as Administrator):**
```powershell
# Option 1: Use WSL2 (recommended — run the macOS/Linux command above inside WSL)

# Option 2: Native Windows via Foundryup
curl.exe -L https://foundry.paradigm.xyz/foundryup.ps1 | powershell
```
> On Windows, WSL2 (Ubuntu) is strongly recommended. All commands below work identically inside WSL.

**Verify install:**
```bash
forge --version
# Expected: forge 1.x.x
```

---

## Setup

```bash
# 1. Enter the contract directory
cd contract

# 2. Install forge-std (the test/script library) — needed after a fresh clone
forge install foundry-rs/forge-std

# 3. Build
forge build
# Expected: "Compiler run successful!"

# 4. Run tests
forge test
# Expected: 9 tests passed, 0 failed
```

---

## Deploy to Somnia Testnet

### Step 1 — Get a wallet and STT tokens

1. Install [MetaMask](https://metamask.io) in your browser
2. Create a **new dedicated wallet** for deploying (don't use your main wallet)
3. Copy your wallet address
4. Visit https://faucet.somnia.network and request STT tokens to that address

### Step 2 — Export your private key

In MetaMask: click the three dots next to your account → **Account Details** → **Show private key** → enter your password → copy the key.

> ⚠️ Never share your private key. Never commit it to git. Use a throwaway wallet for testnet deploys.

### Step 3 — Set the environment variable

**macOS / Linux / WSL:**
```bash
export PRIVATE_KEY=0xYourPrivateKeyHere
```

**Windows (Command Prompt):**
```cmd
set PRIVATE_KEY=0xYourPrivateKeyHere
```

**Windows (PowerShell):**
```powershell
$env:PRIVATE_KEY = "0xYourPrivateKeyHere"
```

> This only lasts for the current terminal session. It is never saved to any file.

### Step 4 — Deploy

```bash
forge create src/AidenAgent.sol:AidenAgent \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy \
  --broadcast
```

**Windows (Command Prompt — no line continuation):**
```cmd
forge create src/AidenAgent.sol:AidenAgent --rpc-url https://dream-rpc.somnia.network --private-key %PRIVATE_KEY% --legacy --broadcast
```

Output:
```
Deployer:    0xYourWalletAddress
Deployed to: 0xYourContractAddress   ← copy this
Transaction hash: 0x...
```

### Step 5 — Register NPC id=0

```bash
cast send 0xYourContractAddress \
  "registerNPC(string)" "Aiden" \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy
```

**Windows (Command Prompt):**
```cmd
cast send 0xYourContractAddress "registerNPC(string)" "Aiden" --rpc-url https://dream-rpc.somnia.network --private-key %PRIVATE_KEY% --legacy
```

Output should show `status: 1 (success)`.

### Step 6 — Paste the address into the web client

Open `web/src/abi.js` and update line 10:
```js
export const CONTRACT_ADDRESS = '0xYourContractAddress';
```

---

## Verify deployment

Check the contract exists on-chain:
```bash
cast code 0xYourContractAddress --rpc-url https://dream-rpc.somnia.network
# Should return a long hex string (bytecode), NOT just "0x"
```

Check the NPC was registered:
```bash
cast call 0xYourContractAddress "getNPC(uint256)(uint256,string,bool)" 0 \
  --rpc-url https://dream-rpc.somnia.network
# Expected: 0  "Aiden"  true
```

---

## Contract API

### Functions

#### `registerNPC(string name) → uint256`
Registers a new NPC. Returns its id (starts at 0).
```bash
cast send <address> "registerNPC(string)" "MyNPC" --rpc-url ... --private-key $PRIVATE_KEY --legacy
```

#### `interact(uint256 npcId, uint8 action)`
Records a player action. `action`: `0`=Trade, `1`=Help, `2`=Betray.
Reverts with `"NPC does not exist"` for an unregistered id.
```bash
cast send <address> "interact(uint256,uint8)" 0 1 --rpc-url ... --private-key $PRIVATE_KEY --legacy
```

#### `getStanding(uint256 npcId, address player) → int256`
Returns the player's current standing with the NPC. Free (read-only).
```bash
cast call <address> "getStanding(uint256,address)(int256)" 0 <playerAddress> --rpc-url ...
```

#### `getNPC(uint256 npcId) → (uint256 id, string name, bool exists)`
Returns NPC metadata. Free (read-only).
```bash
cast call <address> "getNPC(uint256)(uint256,string,bool)" 0 --rpc-url ...
```

### Standing deltas

| Action | Value |
|---|---|
| Help | +10 |
| Trade | +2 |
| Betray | −15 |

Standing is `int256` — it can go negative after betrayals.

### Events

**`NPCRegistered(uint256 indexed npcId, string name)`**
Emitted when `registerNPC` succeeds.

**`Interacted(uint256 indexed npcId, address indexed player, uint8 action, int256 newStanding)`**
Emitted on every `interact` call. Subscribe to this for real-time standing updates.

**`NpcReacted(uint256 indexed npcId, address indexed player, string reaction, int256 newStanding)`**
Emitted by `applyReactivePenalty`. Fired autonomously by the Somnia reactivity precompile — no human triggers it.

### Reactive extension points

#### `authorizeHandler(address handler)`
Authorises `AidenReactiveHandler` to call `applyReactivePenalty`. Only the deployer (owner) can call this.

#### `applyReactivePenalty(uint256 npcId, address player, int256 delta)`
Called by the authorised handler to apply an autonomous standing change. Reverts if the caller is not the authorised handler.

---

## Somnia Reactivity — autonomous retaliation

When a player betrays Aiden and their standing drops below −10, the Somnia blockchain automatically calls `AidenReactiveHandler._onEvent` — an additional −10 penalty is applied with no human triggering it. The full chain of events:

```
Player clicks "Betray"
       ↓
AidenAgent.interact() → standing −15, emits Interacted(npcId, player, Betray, −15)
       ↓
Somnia reactivity precompile detects Interacted matches the subscription filter
       ↓
Precompile calls AidenReactiveHandler.onEvent() — autonomously, on-chain
       ↓
Handler decodes event: action=Betray, newStanding=−15 < −10 threshold
       ↓
Handler calls AidenAgent.applyReactivePenalty(npcId, player, −10)
       ↓
AidenAgent.standing −10 more → emits NpcReacted(npcId, player, "Aiden retaliates", −25)
       ↓
Web client receives NpcReacted event, updates standing display autonomously
```

### Deploy the reactive handler

```bash
# 1. Deploy AidenReactiveHandler
forge create src/AidenReactiveHandler.sol:AidenReactiveHandler \
  --constructor-args $AGENT_ADDRESS \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy --broadcast

# 2. Authorise the handler on AidenAgent
cast send $AGENT_ADDRESS "authorizeHandler(address)" $HANDLER_ADDRESS \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY --legacy

# 3. Register the Somnia Reactivity subscription (wallet needs >= 32 STT)
export AGENT_ADDRESS=0x...
export HANDLER_ADDRESS=0x...
npx tsx script/RegisterReactivity.ts
```

---

## Run tests

```bash
forge test
# Runs all 15 unit tests (9 AidenAgent + 6 AidenReactiveHandler)
forge test -v
# Verbose: shows each test name and gas cost
forge test --match-test testBetrayBelowThresholdAppliesPenalty
# Run a single test by name
```

All 15 tests must pass before deploying.

# AidenAgent — Contract

The smart contract that gives NPCs persistent onchain memory.

> Any EVM-capable engine — Unity, Unreal, web, Flutter — calls these same functions.
> This is Aiden's engine-agnostic API. The contract is the product; clients are interchangeable.

**Deployed addresses (Somnia Shannon Testnet):**
| Contract | Address |
|---|---|
| AidenAgent | `0xDe2123635705Bbd06496d8007F1c13cCE2DCcF5b` |
| AidenReactiveHandler | `0x9ba8a3e76027EFDD64a50bdB0cC34E56817DBc05` |

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

# 2. Install npm dependencies (Somnia Reactivity contracts)
npm install

# 3. Install forge-std (the test/script library) — needed after a fresh clone
forge install foundry-rs/forge-std

# 4. Build
forge build
# Expected: "Compiler run successful!"

# 5. Run tests
forge test
# Expected: 15 tests passed, 0 failed (9 AidenAgent + 6 AidenReactiveHandler)
```

---

## Get STT test tokens

`faucet.somnia.network` is no longer active. Use one of these instead:

| Faucet | Amount | Notes |
|---|---|---|
| https://testnet.somnia.network | 0.5 STT / 24h | Official hub |
| https://cloud.google.com/application/web3/faucet/somnia/shannon | Varies | Google login required — most reliable |
| https://faucet.trade/somnia-shannon-stt-faucet | 0.1 STT / 24h | Requires a tweet |

---

## Deploy AidenAgent

### Step 1 — Export your private key

In MetaMask: three dots → **Account Details** → **Show private key** → enter password → copy.

> ⚠️ Never share your private key. Never commit it to git. Use a throwaway wallet for testnet deploys.

**Important:** set the variable in the same terminal session you will run forge from. If you open a new tab or window, you must set it again — it does not persist.

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

### Step 2 — Deploy AidenAgent

```bash
forge create src/AidenAgent.sol:AidenAgent \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy --broadcast
```

**Windows (Command Prompt):**
```cmd
forge create src/AidenAgent.sol:AidenAgent --rpc-url https://dream-rpc.somnia.network --private-key %PRIVATE_KEY% --legacy --broadcast
```

Output:
```
Deployer:    0xYourWalletAddress
Deployed to: 0xYourAgentAddress   ← copy this
```

### Step 3 — Register NPC id=0

```bash
cast send 0xYourAgentAddress "registerNPC(string)" "Aiden" \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY --legacy
```

Output should show `status: 1 (success)`.

### Step 4 — Paste the address into the web client

Open `web/src/abi.js` and update the `CONTRACT_ADDRESS` constant.

---

## Deploy AidenReactiveHandler (Somnia L1 Agent)

`AidenReactiveHandler` is a Somnia L1 agent — it inherits from `SomniaEventHandler` and is called autonomously by the Somnia reactivity precompile.

> **Gas note:** Contracts that inherit from `SomniaEventHandler` require ~10–15M gas to deploy on Somnia, significantly more than standard EVM gas estimates. `forge create` and `forge script` underestimate the gas and will fail. Use `cast send --create` with an explicit `--gas-limit` as shown below.

### Step 1 — Build to get the bytecode

```bash
forge build
```

### Step 2 — Deploy via cast send

```bash
export AGENT_ADDRESS=0xYourAgentAddress

CREATION=$(cat out/AidenReactiveHandler.sol/AidenReactiveHandler.json | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['bytecode']['object'])")

ARGS=$(cast abi-encode "constructor(address)" $AGENT_ADDRESS | cut -c3-)

cast send \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy --gas-limit 15000000 \
  --create ${CREATION}${ARGS}
```

Output includes `contractAddress` — copy it.

### Step 3 — Authorise the handler on AidenAgent

```bash
cast send $AGENT_ADDRESS "authorizeHandler(address)" $HANDLER_ADDRESS \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY --legacy
```

Output should show `status: 1 (success)`.

### Step 4 — Update the web client

Open `web/src/abi.js` and update `HANDLER_ADDRESS` to the deployed handler address.

---

## Somnia Reactivity — autonomous retaliation

When a player betrays Aiden and their standing drops below −10, the Somnia blockchain automatically calls `AidenReactiveHandler._onEvent` — an additional −10 penalty is applied with no human triggering it.

```
Player clicks "Betray"
       ↓
AidenAgent.interact() → standing −15, emits Interacted(npcId, player, Betray, −15)
       ↓
Somnia reactivity precompile detects Interacted matches the subscription filter
       ↓
Precompile calls AidenReactiveHandler.onEvent() — autonomously, on-chain
       ↓
Handler: action=Betray, newStanding=−15 < −10 threshold → retaliate
       ↓
AidenAgent.applyReactivePenalty() → standing −10 more → emits NpcReacted(−25)
       ↓
Web client receives NpcReacted, shows "⚡ Aiden retaliates autonomously!"
```

### Register the live subscription (requires ≥ 32 STT)

The precompile requires the registering wallet to hold at least 32 STT as anti-spam collateral (the STT stays in your wallet).

```bash
export AGENT_ADDRESS=0xYourAgentAddress
export HANDLER_ADDRESS=0xYourHandlerAddress
npx tsx script/RegisterReactivity.ts
```

### Demo without 32 STT — simulatePrecompile

`AidenReactiveHandler` includes a `simulatePrecompile()` function that runs the exact same logic as `_onEvent` without needing the precompile subscription. The web client calls this automatically after every qualifying Betray — you see two MetaMask popups:

1. The Betray transaction
2. Aiden's automatic retaliation (same on-chain code path)

This demonstrates the full autonomous chain with no STT requirement beyond normal gas.

---

## Verify deployment

```bash
# Check AidenAgent exists
cast code 0xYourAgentAddress --rpc-url https://dream-rpc.somnia.network
# Should return bytecode, NOT just "0x"

# Check NPC is registered
cast call 0xYourAgentAddress "getNPC(uint256)(uint256,string,bool)" 0 \
  --rpc-url https://dream-rpc.somnia.network
# Expected: 0  "Aiden"  true

# Check handler is authorised
cast call 0xYourAgentAddress "reactiveHandler()(address)" \
  --rpc-url https://dream-rpc.somnia.network
# Should return your handler address, not the zero address
```

---

## Contract API

### AidenAgent functions

#### `registerNPC(string name) → uint256`
Registers a new NPC. Returns its id (starts at 0).

#### `interact(uint256 npcId, uint8 action)`
Records a player action. `action`: `0`=Trade, `1`=Help, `2`=Betray.
Reverts with `"NPC does not exist"` for an unregistered id.

#### `getStanding(uint256 npcId, address player) → int256`
Returns the player's current standing with the NPC. Free (read-only).

#### `getNPC(uint256 npcId) → (uint256 id, string name, bool exists)`
Returns NPC metadata. Free (read-only).

#### `authorizeHandler(address handler)`
Authorises `AidenReactiveHandler` to call `applyReactivePenalty`. Owner only.

#### `applyReactivePenalty(uint256 npcId, address player, int256 delta)`
Called by the authorised handler to apply an autonomous standing penalty.

### AidenReactiveHandler functions

#### `simulatePrecompile(uint256 npcId, address player, uint8 action, int256 newStanding)`
Demo function — runs the same retaliation logic as the live precompile subscription without needing 32 STT. Called automatically by the web client.

### Standing deltas

| Action | Value |
|---|---|
| Help | +10 |
| Trade | +2 |
| Betray | −15 |
| Reactive penalty | −10 (autonomous, triggered when standing < −10 after Betray) |

Standing is `int256` — it can go negative.

### Events

**`NPCRegistered(uint256 indexed npcId, string name)`**
Emitted when `registerNPC` succeeds.

**`Interacted(uint256 indexed npcId, address indexed player, uint8 action, int256 newStanding)`**
Emitted on every `interact` call.

**`NpcReacted(uint256 indexed npcId, address indexed player, string reaction, int256 newStanding)`**
Emitted by `applyReactivePenalty` — fired autonomously, no human triggers it.

---

## Run tests

```bash
forge test
# 15 tests: 9 AidenAgent + 6 AidenReactiveHandler
forge test -v
# Verbose: each test name and gas cost
forge test --match-test testBetrayBelowThresholdAppliesPenalty
# Single test by name
```

All 15 tests must pass before deploying.

---

## Known Somnia quirks

| Issue | Cause | Fix |
|---|---|---|
| `forge create` hits `localhost:8545` | `$PRIVATE_KEY` not set — empty string makes forge try a local unlocked account | Always `export PRIVATE_KEY=0x...` in the same terminal session before running forge |
| `forge create` / `forge script` fails for `AidenReactiveHandler` | Gas underestimated — Somnia charges ~10–15M gas for contracts inheriting `SomniaEventHandler` | Use `cast send --create --gas-limit 15000000` (see deploy steps above) |
| `npx tsx script/RegisterReactivity.ts` reverts | Wallet balance < 32 STT — precompile enforces this | Use `simulatePrecompile` demo mode instead, or accumulate 32 STT from faucets |
| `@somnia-chain/reactivity` SDK crashes | Package published to npm without its `dist/` folder | Script calls the precompile directly via viem — no SDK needed |

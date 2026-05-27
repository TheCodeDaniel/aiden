# Aiden — Onchain NPC Agents

Aiden turns game NPCs into autonomous onchain agents. Each NPC has a persistent memory — its "standing" toward each player — stored on the Somnia blockchain. When a player acts toward an NPC (trade, help, or betray), a transaction updates that memory. The NPC remembers across sessions and across any game engine, because the memory lives on the chain, not in any app.

---

## What's in this repo

| Directory | What it is |
|---|---|
| `contract/` | The Solidity smart contract (`AidenAgent.sol`) — Foundry project with tests and a deploy script |
| `web/` | A minimal Three.js game that calls the deployed contract — a visual proof-of-concept |

**The contract is the product.** The web client is a test harness. A Flutter app, a Unity game, or any other EVM-capable engine could call the same contract functions and see the same persistent NPC memory.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Somnia Blockchain                   │
│  AidenAgent.sol — stores NPC standings onchain       │
└──────────┬───────────────────────────────────────────┘
           │  registerNPC / interact / getStanding
    ┌──────┴──────────────────────────────────┐
    │              Clients                    │
    │  web/  (Three.js + viem)   ← this repo  │
    │  Flutter SDK               ← separate   │
    │  Unity / Unreal / etc.     ← future     │
    └─────────────────────────────────────────┘
```

`chain.js` (web client) and the Flutter SDK both call the exact same contract functions. Swapping one client for another doesn't change the NPC's memory.

---

## Quick start

### 1. Deploy the contract

```bash
# Install Foundry (skip if already installed)
curl -L https://foundry.paradigm.xyz | bash && foundryup

cd contract
forge build
forge test          # all 9 tests must pass

export PRIVATE_KEY=0xYOUR_KEY
forge script script/Deploy.s.sol \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --broadcast
# Copy the printed contract address
```

### 2. Run the web client

```bash
# Paste the contract address into web/src/abi.js first
cd web
npm install
npm run dev
# Open http://localhost:5173
```

See `contract/README.md` and `web/README.md` for detailed instructions.

---

## Somnia network

| | |
|---|---|
| Network | Somnia Shannon Testnet |
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Explorer | https://shannon-explorer.somnia.network |
| Faucet | https://faucet.somnia.network |

---

## How NPC memory works

1. Call `registerNPC("Aiden")` once (the deploy script does this automatically).
2. Any player can call `interact(0, ActionType.Help)` — this adds +10 to that player's standing with NPC 0.
3. Call `getStanding(0, playerAddress)` to read the memory — works from any client, any engine, any session.
4. The `Interacted` event fires on every interaction, so real-time clients can subscribe and update their UI instantly.

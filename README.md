# Aiden — Onchain NPC Agents

Aiden gives game NPCs a permanent memory stored on the **Somnia blockchain**. When a player trades with, helps, or betrays an NPC, that interaction is written onchain. The NPC remembers — across sessions, across game engines, forever.

Beyond memory, Aiden uses **Somnia Reactivity** to make NPCs autonomous. Betray Aiden enough and the NPC retaliates on its own — the blockchain calls the handler contract automatically, with no human triggering the second step.

The contract is the product. The web client in this repo is a visual proof-of-concept. A Flutter app, a Unity game, or any EVM-capable engine can call the same contracts and share the same NPC memory and reactions.

---

## Repository structure

```
aiden/
├── contract/       Solidity smart contracts (Foundry)
│   ├── src/        AidenAgent.sol + AidenReactiveHandler.sol
│   ├── test/       15 Foundry unit tests
│   └── script/     Deploy scripts + RegisterReactivity.ts
└── web/            3D web client (Three.js + viem + Vite)
    └── src/        chain.js · scene.js · main.js · abi.js
```

---

## Network

| | |
|---|---|
| Network | Somnia Shannon Testnet |
| Chain ID | `50312` |
| RPC | `https://dream-rpc.somnia.network` |
| Explorer | https://shannon-explorer.somnia.network |
| Native token | STT |

**Faucets** (`faucet.somnia.network` is no longer active):
- https://testnet.somnia.network — 0.5 STT / 24h
- https://cloud.google.com/application/web3/faucet/somnia/shannon — Google login

---

## Quick start

### 1 — Deploy the contracts → see [contract/README.md](contract/README.md)
### 2 — Run the web client → see [web/README.md](web/README.md)

---

## How it works

### Core memory flow

```
Player clicks "Help"
       ↓
web/src/chain.js calls interact(0, Help) via MetaMask
       ↓
AidenAgent.sol adds +10 to standing[0][playerAddress]
emits Interacted(npcId, player, action, newStanding)
       ↓
web/src/chain.js receives the event
       ↓
NPC turns green, label shows +10
       ↓
Reload the page → same standing, read fresh from chain
```

### Autonomous retaliation (Somnia L1 agent)

```
Player clicks "Betray" — standing drops to −15
       ↓
AidenAgent emits Interacted(npcId, player, Betray, −15)
       ↓
Somnia reactivity precompile detects event matches subscription
       ↓
Precompile calls AidenReactiveHandler.onEvent() — no human involved
       ↓
Handler: Betray + standing −15 < −10 threshold → retaliate
       ↓
AidenAgent.applyReactivePenalty() → standing −10 more → emits NpcReacted(−25)
       ↓
Web client shows "⚡ Aiden retaliates autonomously!", NPC turns deep red
```

The memory is in the contract, not the app. Any client that can talk to Somnia sees the same state.

---

## Architecture

`chain.js` and `scene.js` are completely isolated. The chain module knows nothing about Three.js; the scene module knows nothing about wallets. This mirrors how Aiden is meant to work at scale — swap the web client for Flutter or Unity and the contract API is unchanged.

`AidenReactiveHandler` is a Somnia L1 agent. It inherits from `SomniaEventHandler` and is triggered by the Somnia reactivity precompile at `0x0100`. When the live subscription is registered, the NPC reacts to betrayals with zero human involvement.

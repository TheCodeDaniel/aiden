# Aiden — Onchain NPC Agents

Aiden gives game NPCs a permanent memory stored on the **Somnia blockchain**. When a player trades with, helps, or betrays an NPC, that interaction is written onchain. The NPC remembers — across sessions, across game engines, forever.

The contract is the product. The web client in this repo is a visual proof-of-concept. A Flutter app, a Unity game, or any EVM-capable engine can call the same contract and share the same NPC memory.

---

## Repository structure

```
aiden/
├── contract/       Solidity smart contract (Foundry)
│   ├── src/        AidenAgent.sol — the contract
│   ├── test/       9 Foundry unit tests
│   └── script/     Deploy.s.sol — deploy + register NPC
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
| Faucet | https://faucet.somnia.network |
| Native token | STT (free on the faucet) |

---

## Quick start

### 1 — Deploy the contract → see [contract/README.md](contract/README.md)
### 2 — Run the web client → see [web/README.md](web/README.md)

---

## How it works

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

The memory is in the contract, not the app. Any client that can talk to Somnia sees the same state.

---

## Architecture decision

`chain.js` and `scene.js` are completely isolated. The chain module knows nothing about Three.js; the scene module knows nothing about wallets. This is intentional — it mirrors how Aiden is meant to work at scale. Swap the web client for Flutter or Unity and the contract API is unchanged.

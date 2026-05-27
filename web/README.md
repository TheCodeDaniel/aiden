# Aiden Web Client

A minimal Three.js test harness that proves the AidenAgent smart contract works — visually and interactively.

---

## Prerequisites

- **Node.js** ≥ 18
- **MetaMask** (or any EIP-1193 browser wallet)
- **Somnia Testnet** added to MetaMask (Chain ID `50312`, RPC `https://dream-rpc.somnia.network`)
- **STT test tokens** — get them at https://faucet.somnia.network

---

## Configure the contract address

1. Deploy the contract (see `contract/README.md`).
2. Copy the address printed by the deploy script.
3. Open [src/abi.js](src/abi.js) and replace the placeholder:

```js
// Before
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

// After (example)
export const CONTRACT_ADDRESS = '0xYourDeployedContractAddress';
```

---

## Run the dev server

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Expected flow

1. **Page loads** → MetaMask popup asks you to connect. Approve it.
2. **MetaMask switches** to Somnia Testnet automatically (or prompts you to add it first).
3. **The 3D scene renders**: a dark ground plane, a blue box (you), and a grey cylinder (Aiden).
4. **Walk toward Aiden** using WASD or arrow keys. When you're close enough, the interaction panel appears at the bottom of the screen.
5. **Click an action**:
   - **Trade (+2)** — small positive reputation
   - **Help (+10)** — generous reward
   - **Betray (−15)** — heavy penalty
6. **MetaMask confirms** the transaction. The buttons show "Sending transaction…" while it's pending.
7. **Standing updates**: the number above Aiden changes; the cylinder turns green (positive) or red (negative).
8. **Reload the page** → MetaMask reconnects, the contract is queried, and the same standing reappears. This proves the memory is onchain, not in the app.

---

## No wallet?

If MetaMask isn't installed, the app shows a message explaining how to set it up, and the 3D scene still renders normally. You just can't send transactions.

---

## File overview

| File | Purpose |
|---|---|
| `src/abi.js` | Contract ABI + deployed address constant |
| `src/chain.js` | All viem / wallet / contract logic (no scene code) |
| `src/scene.js` | All Three.js / 3D logic (no chain code) |
| `src/main.js` | Wires chain.js ↔ scene.js together |
| `index.html` | Entry point, HTML overlay elements, CSS |

# Aiden Web Client

A 3D interactive demo that proves the AidenAgent smart contract works — visually and in real-time. Walk up to the NPC, perform actions, and watch your onchain standing change.

---

## What you need

| Requirement | Notes |
|---|---|
| **Node.js ≥ 18** | https://nodejs.org — download the LTS version |
| **MetaMask** | Browser extension — https://metamask.io |
| **Somnia Testnet** in MetaMask | Chain ID `50312` — the app adds it automatically on first connect |
| **STT test tokens** | Free at https://faucet.somnia.network |
| **Deployed contract** | See [contract/README.md](../contract/README.md) first |

---

## Step 1 — Paste the contract address

After deploying the contract, open [src/abi.js](src/abi.js) and update **line 10**:

```js
// Before (placeholder — app will show a warning)
export const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

// After (your deployed address)
export const CONTRACT_ADDRESS = '0xa0838cf368F6262583F488e95d3803A8A4BF3D87';
```

> If you skip this step the app will display:
> `"⚠️ Contract not deployed — paste address into web/src/abi.js"`
> The 3D scene still loads, but no transactions can be sent.

---

## Step 2 — Install dependencies and run

**macOS / Linux / WSL:**
```bash
cd web
npm install
npm run dev
```

**Windows (Command Prompt or PowerShell):**
```cmd
cd web
npm install
npm run dev
```

Open **http://localhost:5173** in your browser (Chrome or Firefox recommended).

> First run may take a few seconds while Vite bundles the app.

---

## Step 3 — Connect MetaMask

1. A MetaMask popup appears asking to connect your wallet — click **Connect**
2. MetaMask will ask to switch to **Somnia Shannon Testnet** — click **Approve**
   - If the network isn't in MetaMask yet, it will ask to **Add Network** first — approve that too
3. The top-left status bar changes to `Connected: 0xYour...Address`

---

## Step 4 — Play

| Control | Action |
|---|---|
| `W` / `↑` | Walk forward |
| `S` / `↓` | Walk backward |
| `A` / `←` | Walk left |
| `D` / `→` | Walk right |
| **Click + drag** | Rotate camera |
| **Scroll wheel** | Zoom in / out |

Walk toward the **NPC (Aiden)** — the gold ring marks where to go. When you're close enough, an interaction panel appears at the bottom of the screen.

**Available actions:**

| Button | Standing change | Effect |
|---|---|---|
| Trade | +2 | Small positive reputation |
| Help | +10 | Generous reward |
| Betray | −15 | Heavy penalty — can go negative |

---

## Step 5 — Confirm the transaction

When you click an action button:

1. MetaMask pops up with a **Transaction request**
2. You may see a **"Review alert"** button instead of "Confirm" — this is normal on testnets. Click it, review the warning, then proceed to confirm
3. The buttons show **"Sending transaction…"** while the tx is pending
4. Once mined, the number above Aiden updates and the NPC changes colour:
   - **Green** — standing ≥ +5
   - **Grey** — standing near zero
   - **Red** — standing ≤ −5

---

## Prove the memory is onchain

1. Perform a few actions (e.g. Help twice → standing +20)
2. Note the standing number above Aiden
3. **Close the tab and reopen http://localhost:5173**
4. Connect MetaMask again
5. The same standing value reappears — read directly from the contract, not stored in the browser

This is the core Aiden property: the NPC's memory persists because it lives on the blockchain, not in any app.

---

## Troubleshooting

**"⚠️ Contract not deployed" warning**
→ Paste your deployed contract address into `src/abi.js` line 10 (see Step 1 above).

**"No wallet detected" message**
→ Install MetaMask from https://metamask.io and reload the page.

**MetaMask shows wrong network**
→ The app tries to switch automatically. If it fails, add the network manually in MetaMask:
- Network name: `Somnia Shannon Testnet`
- RPC URL: `https://dream-rpc.somnia.network`
- Chain ID: `50312`
- Currency symbol: `STT`
- Explorer: `https://shannon-explorer.somnia.network`

**"Sending transaction…" never resolves**
→ Check MetaMask — there is likely a pending confirmation popup waiting for your approval. Look for the MetaMask notification icon in your browser toolbar.

**Transaction fails with "NPC does not exist"**
→ The NPC wasn't registered after deploy. Run this command (see [contract/README.md](../contract/README.md)):
```bash
cast send 0xYourContractAddress "registerNPC(string)" "Aiden" \
  --rpc-url https://dream-rpc.somnia.network \
  --private-key $PRIVATE_KEY \
  --legacy
```

**Standing shows 0 after reload**
→ Make sure you're connected with the same MetaMask account that sent the transactions. Standing is per wallet address.

**Page is blank / JS errors in console**
→ Make sure `npm install` completed without errors and you're running Node.js ≥ 18 (`node --version`).

---

## Build for production

```bash
npm run build
# Output goes to web/dist/
```

To preview the production build locally:
```bash
npm run preview
# Opens at http://localhost:4173
```

---

## File overview

| File | Purpose |
|---|---|
| `src/abi.js` | Contract ABI + `CONTRACT_ADDRESS` constant — **edit this after deploying** |
| `src/chain.js` | All wallet / viem / contract logic — no scene code |
| `src/scene.js` | All Three.js / 3D logic — no chain code |
| `src/main.js` | Wires chain.js ↔ scene.js |
| `index.html` | Entry point, HTML overlays, CSS |
| `vite.config.js` | Vite bundler config |
| `package.json` | Dependencies: three, viem, vite |

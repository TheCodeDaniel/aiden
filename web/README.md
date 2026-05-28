# Aiden Web Client

A 3D interactive demo that proves the AidenAgent smart contract works — visually and in real-time. Walk up to the NPC, perform actions, and watch your onchain standing change. Betray Aiden enough and watch him retaliate autonomously.

---

## What you need

| Requirement | Notes |
|---|---|
| **Node.js ≥ 18** | https://nodejs.org — download the LTS version |
| **MetaMask** | Browser extension — https://metamask.io |
| **Somnia Testnet** in MetaMask | Chain ID `50312` — the app adds it automatically on first connect |
| **STT test tokens** | See faucet options below |
| **Deployed contract** | See [contract/README.md](../contract/README.md) first |

### Getting STT tokens

`faucet.somnia.network` is no longer active. Uswe one of these:

| Faucet | Notes |
|---|---|
| https://testnet.somnia.network | Official hub, 0.5 STT / 24h |
| https://cloud.google.com/application/web3/faucet/somnia/shannon | Google login — most reliable |s
| https://faucet.trade/somnia-shannon-stt-faucet | Requires a tweet |

A small amount of STT (< 1) is enough to play the game. The 32 STT minimum is only needed to register a live Somnia Reactivity subscription — the demo works without it.

---

## Step 1 — Install dependencies and run

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

## Step 2 — Connect MetaMask

1. A MetaMask popup appears asking to connect your wallet — click **Connect**
2. MetaMask will ask to switch to **Somnia Shannon Testnet** — click **Approve**
   - If the network isn't in MetaMask yet, it will ask to **Add Network** first — approve that too
3. The top-left status bar changes to `Connected: 0xYour...Address`

---

## Step 3 — Play

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
| Betray | −15 | Heavy penalty — triggers autonomous retaliation if standing drops below −10 |

---

## Step 4 — Confirm the transaction

When you click an action button:

1. MetaMask pops up with a **Transaction request**
2. You may see a **"Review alert"** button instead of "Confirm" — this is normal on testnets. Click it, review the warning, then proceed to confirm
3. The buttons show **"Sending transaction…"** while the tx is pending
4. Once mined, the number above Aiden updates and the NPC changes colour:
   - **Green** — standing ≥ +5
   - **Grey** — standing near zero
   - **Red** — standing ≤ −5

---

## Step 5 — Watch Aiden retaliate (autonomous demo)

If you **Betray** Aiden and your standing drops below **−10**, a second MetaMask popup appears automatically — no button click needed:

1. First popup: your Betray transaction (standing −15)
2. App shows **"⚡ Aiden is retaliating…"**
3. Second popup: `simulatePrecompile` — the handler applies an extra −10
4. Standing drops to −25, NPC turns deep red

This is the Somnia L1 agent behavior. The second transaction runs the exact same code path the Somnia reactivity precompile would call automatically once a live subscription is registered. Two separate on-chain transactions — no human clicked anything for the second one.

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
→ The `CONTRACT_ADDRESS` in `src/abi.js` is still the zero-address placeholder. Paste your deployed address.

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
→ The NPC wasn't registered after deploy. See [contract/README.md](../contract/README.md) Step 3.

**Second MetaMask popup doesn't appear after Betray**
→ Check that `HANDLER_ADDRESS` in `src/abi.js` matches the deployed `AidenReactiveHandler` address, and that `authorizeHandler` was called on AidenAgent.

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
| `src/abi.js` | ABI + `CONTRACT_ADDRESS` (AidenAgent) + `HANDLER_ADDRESS` (AidenReactiveHandler) |
| `src/chain.js` | All wallet / viem / contract logic — no scene code |
| `src/scene.js` | All Three.js / 3D logic — no chain code |
| `src/main.js` | Wires chain.js ↔ scene.js |
| `index.html` | Entry point, HTML overlays, CSS |
| `vite.config.js` | Vite bundler config (`base: '/aiden/'` for GitHub Pages) |
| `package.json` | Dependencies: three, viem, vite |

// ─────────────────────────────────────────────────────────────────────────────
// main.js — Wires the chain module (chain.js) to the 3D scene (scene.js).
//
// Responsibilities:
//   1. Start the 3D scene.
//   2. Connect wallet (or show the no-wallet message).
//   3. Read the NPC's initial standing from the contract and apply it.
//   4. Each animation frame: show/hide the interaction panel based on proximity.
//   5. Button handlers: send transactions, show pending state, update standing.
//   6. Live event subscription so standing updates without a page reload.
// ─────────────────────────────────────────────────────────────────────────────

import {
  connectWallet,
  getStanding,
  interact,
  watchInteractions,
  watchNpcReacted,
  isWalletAvailable,
} from './chain.js';

import { CONTRACT_ADDRESS } from './abi.js';

// Detect the zero-address placeholder — means the contract hasn't been deployed yet.
const CONTRACT_DEPLOYED = CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

import {
  initScene,
  setNpcStanding,
  isPlayerInRange,
  getNpcScreenPos,
} from './scene.js';

// The only NPC in this demo is id=0 ("Aiden"), registered by the deploy script.
const NPC_ID = 0;

// ── DOM references ────────────────────────────────────────────────────────────
const statusEl      = document.getElementById('status');
const panelEl       = document.getElementById('interaction-panel');
const npcLabelEl    = document.getElementById('npc-label');
const txStatusEl    = document.getElementById('tx-status');
const noWalletEl    = document.getElementById('no-wallet');
const btnTrade      = document.getElementById('btn-trade');
const btnHelp       = document.getElementById('btn-help');
const btnBetray     = document.getElementById('btn-betray');

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  // 1. Start the 3D scene immediately — it runs independently of wallet state
  initScene();
  npcLabelEl.style.display = 'block';

  // 2. Guard: contract not deployed yet
  if (!CONTRACT_DEPLOYED) {
    statusEl.textContent = '⚠️ Contract not deployed — paste address into web/src/abi.js';
    applyStanding(0);
    startFrameLoop();
    return;
  }

  // 3. Wallet flow
  if (!isWalletAvailable) {
    // No MetaMask / injected provider — show warning, scene still works
    noWalletEl.style.display = 'block';
    statusEl.textContent = 'No wallet detected — read-only mode.';
    applyStanding(0);
    startFrameLoop();
    return;
  }

  // Connect wallet — separate try/catch so the error message is specific
  let connectedAddress;
  try {
    statusEl.textContent = 'Connecting wallet…';
    connectedAddress = await connectWallet();
    const short = connectedAddress.slice(0, 6) + '…' + connectedAddress.slice(-4);
    statusEl.textContent = `Connected: ${short}`;
  } catch (err) {
    statusEl.textContent = `Wallet connection failed: ${err.message}`;
    console.error(err);
    applyStanding(0);
    startFrameLoop();
    return;
  }

  // Read initial standing + subscribe to events — separate try/catch
  try {
    const initialStanding = await getStanding(NPC_ID);
    applyStanding(initialStanding);

    // Subscribe to live Interacted events — updates standing without reload
    watchInteractions(NPC_ID, (newStanding) => {
      applyStanding(newStanding);
    });

    // Subscribe to autonomous NpcReacted events — fired by the Somnia reactivity
    // precompile through AidenReactiveHandler with no human involvement.
    watchNpcReacted(NPC_ID, (newStanding) => {
      applyStanding(newStanding);
      txStatusEl.textContent = '⚡ Aiden retaliates autonomously!';
      setTimeout(() => { txStatusEl.textContent = ''; }, 4000);
    });
  } catch (err) {
    statusEl.textContent = `Contract read failed: ${err.shortMessage ?? err.message}`;
    console.error(err);
  }

  startFrameLoop();
})();

// ── applyStanding ─────────────────────────────────────────────────────────────
// Single place to update both the scene's NPC color and the HTML label.
function applyStanding(value) {
  setNpcStanding(value);
  // The label text is set inside setNpcStanding; nothing else to do here.
}

// ── Frame loop ────────────────────────────────────────────────────────────────
// Runs at ~60fps (rAF). Three.js has its own internal loop; this one only
// handles the HTML overlay updates that don't belong inside scene.js.
function startFrameLoop() {
  function tick() {
    requestAnimationFrame(tick);

    // Show/hide the interaction panel based on player proximity
    panelEl.style.display = isPlayerInRange() ? 'flex' : 'none';

    // Position the floating NPC label over the 3D mesh every frame
    const pos = getNpcScreenPos();
    npcLabelEl.style.left = pos.x + 'px';
    npcLabelEl.style.top  = pos.y + 'px';
  }
  tick();
}

// ── Button helpers ────────────────────────────────────────────────────────────
// ActionType enum values from the contract: Trade=0, Help=1, Betray=2
const ACTION = { Trade: 0, Help: 1, Betray: 2 };

function setButtonsDisabled(disabled) {
  btnTrade.disabled  = disabled;
  btnHelp.disabled   = disabled;
  btnBetray.disabled = disabled;
}

async function handleAction(action) {
  if (!isWalletAvailable || !CONTRACT_DEPLOYED) return;

  setButtonsDisabled(true);
  txStatusEl.textContent = 'Sending transaction…';

  try {
    // interact() in chain.js sends the tx and waits for the receipt
    await interact(NPC_ID, action);
    txStatusEl.textContent = 'Done!';

    // Read the updated standing immediately after the tx confirms
    const newStanding = await getStanding(NPC_ID);
    applyStanding(newStanding);

    // Clear status after 2 seconds
    setTimeout(() => { txStatusEl.textContent = ''; }, 2000);

  } catch (err) {
    // User rejected in MetaMask, or tx reverted (e.g. NPC doesn't exist)
    txStatusEl.textContent = `Error: ${err.shortMessage ?? err.message}`;
    console.error(err);
  } finally {
    setButtonsDisabled(false);
  }
}

// ── Button event listeners ────────────────────────────────────────────────────
btnTrade.addEventListener( 'click', () => handleAction(ACTION.Trade));
btnHelp.addEventListener(  'click', () => handleAction(ACTION.Help));
btnBetray.addEventListener('click', () => handleAction(ACTION.Betray));

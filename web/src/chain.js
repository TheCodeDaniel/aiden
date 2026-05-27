// ─────────────────────────────────────────────────────────────────────────────
// chain.js — ALL blockchain interaction lives here.
//
// This file is intentionally isolated from scene.js. The contract doesn't care
// whether the client is Three.js, Flutter, Unity, or a CLI script.
// Keeping this boundary clean is the whole point of Aiden's architecture.
//
// Library: viem (https://viem.sh/)
// viem exposes two client types:
//   • publicClient  — read-only, talks directly to the RPC, no wallet needed
//   • walletClient  — write, signs transactions through the browser wallet
// ─────────────────────────────────────────────────────────────────────────────

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from 'viem';

import { ABI, CONTRACT_ADDRESS } from './abi.js';

// ── Somnia Shannon Testnet chain definition ───────────────────────────────────
// viem's built-in chain list doesn't include Somnia, so we define it manually.
const somniaTestnet = {
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://dream-rpc.somnia.network'] },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://shannon-explorer.somnia.network',
    },
  },
  testnet: true,
};

// ── Module state ──────────────────────────────────────────────────────────────

// publicClient is used for all reads (getStanding, watchEvents).
// It's created once and shared — no wallet needed.
export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(), // plain HTTP to the RPC
});

// walletClient is created after the user connects their wallet.
// It wraps window.ethereum (MetaMask etc.) to sign transactions.
let walletClient = null;

// The address of the connected wallet, or null if not connected.
let connectedAddress = null;

// True only if window.ethereum was present when this module loaded.
export const isWalletAvailable = typeof window !== 'undefined' && !!window.ethereum;

// ── connectWallet ─────────────────────────────────────────────────────────────
// Asks MetaMask to:
//   1. Show the "connect" popup if not already connected.
//   2. Switch to (or add) the Somnia Testnet.
// Returns the connected address as a string.
export async function connectWallet() {
  if (!isWalletAvailable) {
    throw new Error('No injected wallet found. Install MetaMask.');
  }

  // custom(window.ethereum) wraps MetaMask's EIP-1193 provider for viem
  walletClient = createWalletClient({
    chain: somniaTestnet,
    transport: custom(window.ethereum),
  });

  // eth_requestAccounts prompts the MetaMask popup if the user hasn't connected yet.
  const [address] = await walletClient.requestAddresses();
  connectedAddress = address;

  // Ask MetaMask to switch to Somnia. If the network isn't in MetaMask yet,
  // wallet_addEthereumChain will prompt the user to add it first.
  await switchToSomnia();

  return address;
}

// ── switchToSomnia ────────────────────────────────────────────────────────────
// Tries wallet_switchEthereumChain; if the chain isn't known to the wallet yet,
// falls back to wallet_addEthereumChain.
async function switchToSomnia() {
  const chainIdHex = '0x' + somniaTestnet.id.toString(16); // 50312 → "0xC488"
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError) {
    // Error code 4902 means "chain not found in wallet" — add it automatically.
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: somniaTestnet.name,
          nativeCurrency: somniaTestnet.nativeCurrency,
          rpcUrls: ['https://dream-rpc.somnia.network'],
          blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}

// ── getStanding ───────────────────────────────────────────────────────────────
// Reads the connected player's standing with the specified NPC from the chain.
// Uses publicClient so it works even before a wallet is connected (standing
// defaults to 0 for any address that hasn't interacted yet).
export async function getStanding(npcId) {
  const player = connectedAddress ?? '0x0000000000000000000000000000000000000000';
  // readContract encodes the call, sends it to the RPC, and decodes the result.
  const value = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getStanding',
    args: [BigInt(npcId), player],
  });
  // value is a BigInt (int256 in Solidity); convert to a regular JS number
  return Number(value);
}

// ── interact ──────────────────────────────────────────────────────────────────
// Sends the interact(npcId, action) transaction and waits for the receipt.
// action: 0=Trade, 1=Help, 2=Betray  (matches the ActionType enum order)
export async function interact(npcId, action) {
  if (!walletClient || !connectedAddress) {
    throw new Error('Wallet not connected. Call connectWallet() first.');
  }

  // writeContract builds and signs the transaction via the wallet.
  // It returns the tx hash immediately — we still need to wait for confirmation.
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'interact',
    args: [BigInt(npcId), action],
    account: connectedAddress,
    chain: somniaTestnet,
  });

  // waitForTransactionReceipt polls the RPC until the tx is mined.
  // It throws if the tx reverts (e.g. "NPC does not exist").
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return receipt;
}

// ── watchInteractions ─────────────────────────────────────────────────────────
// Subscribes to the Interacted event for a specific NPC and the connected player.
// Calls callback(newStanding) whenever a matching event arrives.
// Returns an unsubscribe function — call it to stop watching.
export function watchInteractions(npcId, callback) {
  if (!connectedAddress) return () => {}; // no-op if wallet not connected

  // watchContractEvent opens a long-poll or WebSocket subscription.
  // The filter (npcId + player) means we only get events relevant to this user.
  const unwatch = publicClient.watchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    eventName: 'Interacted',
    args: {
      npcId:  BigInt(npcId),
      player: connectedAddress,
    },
    onLogs: (logs) => {
      // Each log is one Interacted event. Take the most recent one.
      const latest = logs[logs.length - 1];
      if (latest?.args?.newStanding !== undefined) {
        callback(Number(latest.args.newStanding));
      }
    },
  });

  return unwatch; // let the caller stop watching when needed
}

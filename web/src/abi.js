// ─────────────────────────────────────────────────────────────────────────────
// abi.js — AidenAgent contract ABI and deployed address
//
// After deploying with:
//   forge script script/Deploy.s.sol --rpc-url ... --private-key $PK --broadcast
// copy the printed address and replace the placeholder below.
// ─────────────────────────────────────────────────────────────────────────────

// Deployed to Somnia Shannon Testnet (Chain ID 50312)
export const CONTRACT_ADDRESS = '0xDe2123635705Bbd06496d8007F1c13cCE2DCcF5b';

// AidenReactiveHandler — for simulatePrecompile demo calls
export const HANDLER_ADDRESS  = '0x9ba8a3e76027EFDD64a50bdB0cC34E56817DBc05';

// The ABI describes every public function and event in AidenAgent.sol.
// viem uses this to know how to encode calls and decode return values.
export const ABI = [
  // ── registerNPC ────────────────────────────────────────────────────────────
  {
    name: 'registerNPC',
    type: 'function',
    stateMutability: 'nonpayable', // writes state, doesn't send ETH
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: 'id', type: 'uint256' }],
  },

  // ── interact ───────────────────────────────────────────────────────────────
  // ActionType is an enum — Solidity encodes enums as uint8 on the wire.
  // So Trade=0, Help=1, Betray=2.
  {
    name: 'interact',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'npcId', type: 'uint256' },
      { name: 'action', type: 'uint8' }, // 0=Trade, 1=Help, 2=Betray
    ],
    outputs: [],
  },

  // ── getStanding ────────────────────────────────────────────────────────────
  {
    name: 'getStanding',
    type: 'function',
    stateMutability: 'view', // read-only, no gas cost when called off-chain
    inputs: [
      { name: 'npcId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'int256' }], // signed — can be negative
  },

  // ── getNPC ─────────────────────────────────────────────────────────────────
  {
    name: 'getNPC',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'npcId', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'exists', type: 'bool' },
    ],
  },

  // ── NPCRegistered event ────────────────────────────────────────────────────
  {
    name: 'NPCRegistered',
    type: 'event',
    inputs: [
      { name: 'npcId', type: 'uint256', indexed: true },
      { name: 'name', type: 'string', indexed: false },
    ],
  },

  // ── Interacted event ───────────────────────────────────────────────────────
  {
    name: 'Interacted',
    type: 'event',
    inputs: [
      { name: 'npcId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'action', type: 'uint8', indexed: false },
      { name: 'newStanding', type: 'int256', indexed: false },
    ],
  },

  // ── NpcReacted event ───────────────────────────────────────────────────────
  // Emitted by applyReactivePenalty when the Somnia reactivity precompile
  // autonomously calls the handler after a Betray that drops standing below -10.
  // No human triggers this — it fires on its own.
  {
    name: 'NpcReacted',
    type: 'event',
    inputs: [
      { name: 'npcId',      type: 'uint256', indexed: true },
      { name: 'player',     type: 'address', indexed: true },
      { name: 'reaction',   type: 'string',  indexed: false },
      { name: 'newStanding',type: 'int256',  indexed: false },
    ],
  },
];

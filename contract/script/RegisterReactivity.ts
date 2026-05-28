/**
 * RegisterReactivity.ts
 *
 * Registers the Somnia Reactivity subscription so the chain autonomously calls
 * AidenReactiveHandler._onEvent whenever AidenAgent emits an Interacted event.
 *
 * Prerequisites:
 *   1. AidenAgent already deployed (set AGENT_ADDRESS below)
 *   2. AidenReactiveHandler deployed:
 *        forge create src/AidenReactiveHandler.sol:AidenReactiveHandler \
 *          --constructor-args $AGENT_ADDRESS \
 *          --rpc-url https://dream-rpc.somnia.network \
 *          --private-key $PRIVATE_KEY \
 *          --legacy --broadcast
 *   3. authorizeHandler called on AidenAgent:
 *        cast send $AGENT_ADDRESS "authorizeHandler(address)" $HANDLER_ADDRESS \
 *          --rpc-url https://dream-rpc.somnia.network \
 *          --private-key $PRIVATE_KEY --legacy
 *   4. Deployer wallet has >= 32 STT (required by precompile)
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   export AGENT_ADDRESS=0xa0838cf368F6262583F488e95d3803A8A4BF3D87
 *   export HANDLER_ADDRESS=0x...
 *   npx tsx script/RegisterReactivity.ts
 */

import { createPublicClient, createWalletClient, http, defineChain, keccak256, toBytes, privateKeyToAccount } from 'viem';
import { SDK } from '@somnia-chain/reactivity';

const PRIVATE_KEY  = process.env.PRIVATE_KEY  as `0x${string}`;
const AGENT_ADDRESS   = process.env.AGENT_ADDRESS   as `0x${string}`;
const HANDLER_ADDRESS = process.env.HANDLER_ADDRESS as `0x${string}`;

if (!PRIVATE_KEY || !AGENT_ADDRESS || !HANDLER_ADDRESS) {
  console.error('Set PRIVATE_KEY, AGENT_ADDRESS, and HANDLER_ADDRESS env vars.');
  process.exit(1);
}

const somnia = defineChain({
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://dream-rpc.somnia.network'] } },
});

const account      = privateKeyToAccount(PRIVATE_KEY);
const publicClient = createPublicClient({ chain: somnia, transport: http() });
const walletClient = createWalletClient({ account, chain: somnia, transport: http() });

const sdk = new SDK({ public: publicClient, wallet: walletClient });

// Interacted(uint256 indexed npcId, address indexed player, uint8 action, int256 newStanding)
const INTERACTED_TOPIC = keccak256(toBytes('Interacted(uint256,address,uint8,int256)'));

async function main() {
  console.log('Registering Somnia Reactivity subscription...');
  console.log('  Agent:   ', AGENT_ADDRESS);
  console.log('  Handler: ', HANDLER_ADDRESS);
  console.log('  Wallet:  ', account.address);

  const txHash = await sdk.subscribe({
    handlerContractAddress: HANDLER_ADDRESS,
    filter: {
      eventTopics: [INTERACTED_TOPIC],
      emitter: AGENT_ADDRESS,
    },
    options: {
      priorityFeePerGas: 0n,
      maxFeePerGas: 20_000_000_000n, // 20 gwei
      gasLimit: 10_000_000n,
    },
  });

  if (txHash instanceof Error) throw txHash;

  console.log('Transaction sent:', txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Subscription registered! Block:', receipt.blockNumber.toString());
  console.log('');
  console.log('The chain will now call AidenReactiveHandler._onEvent automatically');
  console.log('whenever a player Betrays Aiden and their standing drops below -10.');
}

main().catch(err => { console.error(err); process.exit(1); });

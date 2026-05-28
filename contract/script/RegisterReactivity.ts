/**
 * RegisterReactivity.ts
 *
 * Registers the Somnia Reactivity subscription so the chain autonomously calls
 * AidenReactiveHandler._onEvent whenever AidenAgent emits an Interacted event.
 * Calls the reactivity precompile (0x0100) directly via viem — no broken SDK needed.
 *
 * Prerequisites:
 *   1. AidenAgent deployed and NPC registered
 *   2. AidenReactiveHandler deployed
 *   3. authorizeHandler called on AidenAgent
 *   4. Wallet has >= 32 STT (precompile requirement)
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   export AGENT_ADDRESS=0x...
 *   export HANDLER_ADDRESS=0x...
 *   npx tsx script/RegisterReactivity.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  keccak256,
  toBytes,
  encodeAbiParameters,
  parseAbiParameters,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY     = process.env.PRIVATE_KEY     as `0x${string}`;
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

const PRECOMPILE = '0x0000000000000000000000000000000000000100' as `0x${string}`;

// Interacted(uint256 indexed npcId, address indexed player, uint8 action, int256 newStanding)
const INTERACTED_TOPIC = keccak256(toBytes('Interacted(uint256,address,uint8,int256)'));

// SubscriptionData struct layout (matches ISomniaReactivityPrecompile)
// bytes32[4] eventTopics, address origin, address caller, address emitter,
// address handlerContractAddress, bytes4 handlerFunctionSelector,
// uint64 priorityFeePerGas, uint64 maxFeePerGas, uint64 gasLimit,
// bool isGuaranteed, bool isCoalesced
const SUBSCRIBE_SELECTOR = '0xc5fca91e'; // subscribe(SubscriptionData)

async function main() {
  const account      = privateKeyToAccount(PRIVATE_KEY);
  const publicClient = createPublicClient({ chain: somnia, transport: http() });
  const walletClient = createWalletClient({ account, chain: somnia, transport: http() });

  console.log('Registering Somnia Reactivity subscription...');
  console.log('  Agent:   ', AGENT_ADDRESS);
  console.log('  Handler: ', HANDLER_ADDRESS);
  console.log('  Wallet:  ', account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('  Balance: ', (Number(balance) / 1e18).toFixed(4), 'STT');

  if (balance < 32n * 10n ** 18n) {
    console.error('\nERROR: Wallet needs >= 32 STT to register a subscription.');
    console.error('Get STT from https://faucet.somnia.network then re-run.');
    process.exit(1);
  }

  // Encode SubscriptionData struct
  const data = encodeAbiParameters(
    parseAbiParameters([
      'bytes32[4] eventTopics',
      'address origin',
      'address caller',
      'address emitter',
      'address handlerContractAddress',
      'bytes4 handlerFunctionSelector',
      'uint64 priorityFeePerGas',
      'uint64 maxFeePerGas',
      'uint64 gasLimit',
      'bool isGuaranteed',
      'bool isCoalesced',
    ].join(', ')),
    [
      [INTERACTED_TOPIC, `0x${'00'.repeat(32)}`, `0x${'00'.repeat(32)}`, `0x${'00'.repeat(32)}`],
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      AGENT_ADDRESS,
      HANDLER_ADDRESS,
      '0x53edf33d', // onEvent(address,bytes32[],bytes) selector
      0n,
      20_000_000_000n,
      10_000_000n,
      false,
      false,
    ]
  );

  const calldata = (SUBSCRIBE_SELECTOR + data.slice(2)) as `0x${string}`;

  const hash = await walletClient.sendTransaction({
    to: PRECOMPILE,
    data: calldata,
    gas: 500_000n,
    gasPrice: 6_000_000_000n,
  });

  console.log('Transaction sent:', hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Status:', receipt.status);
  if (receipt.status === 'success') {
    console.log('Subscription registered! Block:', receipt.blockNumber.toString());
    console.log('');
    console.log('The chain will now call AidenReactiveHandler._onEvent automatically');
    console.log('whenever a player Betrays Aiden and their standing drops below -10.');
  } else {
    console.error('Transaction failed — check your STT balance and try again.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });

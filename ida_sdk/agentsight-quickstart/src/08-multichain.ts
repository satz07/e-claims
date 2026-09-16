/**
 * Step 8 — Multi-chain (NEW in SDK v1.4.0)
 *
 * IDA runs on multiple EVM networks. This step shows the three things every
 * engineer needs to know:
 *
 *   1. DISCOVER  — which networks exist and which are enabled
 *   2. CREATE    — mint a DID on the network you choose (one `network` param)
 *   3. RESOLVE   — DIDs are self-routing: the identifier names its chain,
 *                  so reads automatically go to the right network
 *
 * DID formats (Decision 0, docs/multichain-plan.md):
 *   did:adi:0xabc…            bare        = home chain (ADI mainnet)
 *   did:adi:84532:0xabc…      qualified   = the chain named in the DID
 *   did:adi:37001:0xabc…      qualified   = Apiero
 *   did:adi:<base58>          key-based   = chainless (server-minted)
 *
 * Note the network list below is not hard-coded here — it comes from the SDK's
 * chain registry, so a newly deployed network (Apiero, chain 37001) shows up
 * without this file changing.
 *
 * Run:
 *   npm run 08:multichain                          # discovery + parsing (no gas needed)
 *   PRIVATE_KEY=0x… NETWORK=base-sepolia npm run 08:multichain   # + real on-chain create
 *   PRIVATE_KEY=0x… NETWORK=apiero       npm run 08:multichain   # same code, different chain
 */
import { Wallet } from 'ethers';
import {
  listChains, getChain, parseDID, buildDID, lookupDIDOnChain,
} from '@myida/sdk';
import { client } from './client.js';

// ── 1. DISCOVER — what networks can I use? ────────────────────────────────────
console.log('\n─── Networks ───');
for (const c of listChains()) {
  const state = c.enabled ? 'enabled' : 'pending deploy';
  // A testnet without a registered faucet is still a testnet — don't infer
  // "mainnet" from the absence of a faucet URL.
  const gas = c.faucet ? `faucet: ${c.faucet}` : c.testnet ? 'testnet (no faucet listed)' : 'mainnet';
  console.log(`  ${c.enabled ? '✅' : '⏳'} ${c.name.padEnd(18)} chainId=${String(c.chainId).padEnd(9)} ${state} — ${gas}`);
}

// ── 2. UNDERSTAND the DID formats (pure functions, no network calls) ──────────
console.log('\n─── DID formats ───');
const addr = '0x26e5fb741d1b71e651bdd075ae3b50e2571237f1';
console.log('  home chain  :', buildDID(36900, addr));   // bare
console.log('  base sepolia:', buildDID(84532, addr));   // chain-qualified
console.log('  parsed      :', JSON.stringify(parseDID(buildDID(84532, addr))));

// ── 3. RESOLVE — reads route to the chain the DID names ───────────────────────
console.log('\n─── Self-routing lookup (no gas, no signer) ───');
const qualified = buildDID(84532, addr);
// Even though we pass the sepolia config, the DID says 84532 → routed to Base Sepolia.
const status = await lookupDIDOnChain(getChain('sepolia'), qualified);
console.log(`  ${qualified}`);
console.log(`  → resolved on chain ${parseDID(qualified).chainId}: exists=${status.exists}`);

// ── 4. CREATE on a chosen network (needs a funded wallet) ─────────────────────
const NETWORK = process.env.NETWORK ?? 'base-sepolia';
if (!process.env.PRIVATE_KEY) {
  console.log(`\n─── Create (skipped) ───`);
  console.log(`  Set PRIVATE_KEY (funded on ${NETWORK}) to mint a DID there:`);
  console.log(`  PRIVATE_KEY=0x… NETWORK=${NETWORK} npm run 08:multichain\n`);
  process.exit(0);
}

console.log(`\n─── Create DID on ${NETWORK} ───`);
const wallet = new Wallet(process.env.PRIVATE_KEY);
console.log('  wallet:', wallet.address);
try {
  // The ONLY multi-chain change vs single-chain code: the `network` param.
  const result = await client.createDID({ signer: wallet.privateKey, network: NETWORK });
  console.log('  ✓ DID   :', result.did);            // chain-qualified on non-home chains
  console.log('    txHash:', result.onChain?.txHash);
  console.log('    chain :', result.onChain?.chainId);
} catch (e: any) {
  const msg = e?.shortMessage ?? e?.message ?? String(e);
  if (msg.includes('enough funds') || msg.includes('insufficient funds')) {
    const c = getChain(NETWORK);
    console.log(`  ⚠ wallet unfunded on ${c.name} — get gas: ${c.faucet ?? '(mainnet)'}`);
  } else if (msg.includes('already registered')) {
    console.log('  ⚠ this wallet already has a DID on that chain:', buildDID(getChain(NETWORK).chainId, wallet.address));
  } else {
    console.log('  ✗', msg.slice(0, 160));
  }
}
console.log();

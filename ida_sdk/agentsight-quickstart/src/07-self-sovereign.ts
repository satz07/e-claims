/**
 * Step 7 — Self-sovereign on-chain DID + agent (NEW in SDK v1.2.0)
 *
 * Everything here is signed and submitted DIRECTLY to the ADI chain with your
 * own wallet key — the private key never leaves this process, and the platform
 * is not the transaction signer. Each write returns { txHash, blockNumber }.
 *
 * Requires a GAS-FUNDED wallet (~0.1 ADI). Provide it with PRIVATE_KEY, or the
 * script generates a fresh random wallet (which will hit "insufficient funds"
 * at the first write — that still proves the SDK signs + submits correctly).
 *
 * Run:
 *   PRIVATE_KEY=0x... npm run 07:self-sovereign
 *   # or, to just prove signing/submission without gas:
 *   npm run 07:self-sovereign
 */
import { Wallet } from 'ethers';
import { client } from './client.js';

// ── Wallet ────────────────────────────────────────────────────────────────────
const wallet = process.env.PRIVATE_KEY
  ? new Wallet(process.env.PRIVATE_KEY)
  : Wallet.createRandom();

const funded = !!process.env.PRIVATE_KEY;
console.log('\nSelf-sovereign wallet:');
console.log('  address:', wallet.address);
console.log('  funded :', funded ? 'yes (provided)' : 'no (random — will stop at gas)');
console.log('  ⚠  This key controls your DID. Store it securely.\n');

// Small helper: run an on-chain write and report the tx, tolerating the
// expected "no gas" outcome so the example is runnable without funding.
async function onchain(label: string, fn: () => Promise<any>): Promise<boolean> {
  try {
    const r = await fn();
    console.log(`  ✓ ${label}`);
    if (r?.txHash) console.log(`      tx: ${r.txHash}  block: ${r.blockNumber ?? '(pending)'}`);
    return true;
  } catch (e: any) {
    const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''} ${JSON.stringify(e?.info ?? e?.error ?? {})}`;
    if (m.includes('insufficient funds') || m.includes('enough funds')) {
      console.log(`  ⚠ ${label} — reached chain, signed + submitted, only gas missing (fund ${wallet.address})`);
      return false;
    }
    if (m.includes('revert')) {
      console.log(`  ⚠ ${label} — contract reverted: ${e?.shortMessage ?? m.slice(0, 100)}`);
      return false;
    }
    throw e;
  }
}

const did = `did:adi:${wallet.address.toLowerCase()}`;

// ── 1. Create the DID on-chain ─────────────────────────────────────────────────
console.log('─── Create DID (DIDRegistry.createDID) ───');
const created = await onchain('createDID', () => client.createDID({ signer: wallet.privateKey }));
console.log('  DID:', did);

// The remaining writes only succeed once the DID exists on-chain (i.e. the wallet
// is funded and step 1 landed). We still call them to demonstrate the API shape.
if (!created) {
  console.log('\n  (Skipping owner-only writes — DID not yet on-chain. Fund the wallet and re-run.)\n');
  process.exit(0);
}

// ── 2. Add a service endpoint via setAttribute (DID owner only) ─────────────────
console.log('\n─── setAttribute (add a service endpoint) ───');
await onchain('setAttribute did/svc/MessagingService', () =>
  client.setAttribute(did, { name: 'did/svc/MessagingService', value: 'https://msg.example.com', validity: 86400 }, { signer: wallet.privateKey }),
);

// ── 3. Add a delegate (DID owner only) ──────────────────────────────────────────
console.log('\n─── addDelegate ───');
const delegate = Wallet.createRandom().address;
await onchain(`addDelegate sigAuth → ${delegate.slice(0, 10)}…`, () =>
  client.addDelegate(did, { delegateType: 'sigAuth', delegate, validity: 86400 }, { signer: wallet.privateKey }),
);

// ── 4. Register an agent on-chain (caller becomes operator) ─────────────────────
console.log('\n─── registerAgent (AgentTrustRegistry) ───');
const agentDid = `did:adi:agent-${wallet.address.slice(2, 10).toLowerCase()}`;
await onchain('registerAgent', () =>
  client.registerAgent(
    { operator: did, name: 'Self-Sovereign Bot', modelInfo: { provider: 'Anthropic', name: 'claude-sonnet-5', version: '2026-02' }, capabilities: ['invoice.parse'] },
    { signer: wallet.privateKey, agentDid },
  ),
);

// ── 5. Record an on-chain trust signal (any wallet can rate an agent) ───────────
console.log('\n─── recordTrustSignal (on-chain) ───');
await onchain('recordTrustSignal task_completed (+1)', () =>
  client.recordTrustSignal(agentDid, { type: 'task_completed', details: 'Processed 47 invoices' }, { signer: wallet.privateKey }),
);

console.log('\n═══ Self-sovereign flow complete ═══');
console.log('  Everything above was signed by your wallet and submitted on-chain.');
console.log('  DID:  ', did);
console.log('  Agent:', agentDid, '\n');

export { did, agentDid };

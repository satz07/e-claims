/**
 * Full walkthrough — runs all 5 steps in sequence.
 *
 * Run:
 *   npm run all
 */
import { client } from './client.js';

function section(n: number, title: string) {
  console.log(`\n${'─'.repeat(52)}`);
  console.log(`  Step ${n}: ${title}`);
  console.log('─'.repeat(52));
}

// ── 1. Mint operator DID ────────────────────────────────
section(1, 'Mint operator DID');
const opResult = await client.createDID({ keyType: 'ed25519' }) as any;
const operatorDid: string = opResult.did ?? opResult.id;
console.log('  DID:', operatorDid);
console.log('  ⚠  Private key returned once — store it in a secrets manager');

// ── 2. Provision agent ──────────────────────────────────
// One agent here to keep the smoke test short. Each provisionAgent call mints a
// new DID, so the same operator and sponsor can back a fleet — see
// 02-provision-agent.ts with FLEET_SIZE for that pattern.
//
// operatorDid and sponsorDid must be DIDs you own (or ones this platform has
// never seen); claiming another user's DID is refused with 403.
section(2, 'Provision AI agent');
const agent = await client.provisionAgent({
  name:          'Invoice Processor',
  operatorDid,
  sponsorDid:    operatorDid,
  blueprintId:   'bp-finance-v2',
  platform:      'agentsight',
  // Stored as Intern. The response's autonomyLevel is derived from the starting
  // trust score rather than echoing this field, so it prints "Junior" below.
  autonomyLevel: 0,
  modelInfo: {
    provider: 'OpenAI',
    name:     'gpt-4o',
    version:  '2026-01',
  },
  capabilities: [
    { name: 'invoice.parse',    description: 'Extract line items' },
    { name: 'invoice.validate', description: 'Cross-check totals' },
  ],
});

const { agentDid, trustScore, autonomyLevel, ibctSigningKeyHex, agentIdentityCredential } = agent;
console.log('  Agent DID:      ', agentDid);
console.log('  Trust score:    ', trustScore, '/ 100');
console.log('  Autonomy level: ', autonomyLevel);
console.log('  IBCT key hex:   ', ibctSigningKeyHex.slice(0, 16) + '...');
console.log('  VC length:      ', agentIdentityCredential.length, 'chars');

// ── 3. Trust signals ────────────────────────────────────
section(3, 'Record trust signals');
const s1 = await client.recordTrustSignal(agentDid, {
  type: 'task_completed', source: 'agentsight', details: 'Processed 47 invoices',
});
console.log(`  task_completed:   ${s1.previousScore} → ${s1.newScore}  (${s1.autonomyLevel})`);

const s2 = await client.recordTrustSignal(agentDid, {
  type: 'verification_success', source: 'agentsight', details: 'Credential verification ok',
});
console.log(`  verification_success: ${s2.previousScore} → ${s2.newScore}  (${s2.autonomyLevel})`);

const s3 = await client.recordTrustSignal(agentDid, {
  type: 'task_failed', source: 'agentsight', details: 'Timeout on overnight batch',
});
console.log(`  task_failed:      ${s3.previousScore} → ${s3.newScore}  (${s3.autonomyLevel})`);

// ── 4. Webhooks ─────────────────────────────────────────
section(4, 'Register webhook');
const webhook = await client.registerWebhook({
  ownerDid:  operatorDid,
  targetUrl: 'https://your-service.example.com/ida-events',
  secret:    'replace-with-a-strong-random-secret',
  events:    ['agent.provisioned', 'agent.revoked', 'agent.trust_updated'],
});
console.log('  Registered:', webhook.id);

const list = await client.listWebhooks(operatorDid);
console.log('  Active webhooks for this owner:', list.length);

await client.deleteWebhook(webhook.id);
console.log('  Cleaned up test webhook');

// ── 5. Resolve DID ──────────────────────────────────────
section(5, 'Resolve agent DID');
const doc = await client.resolveDID(agentDid) as any;
const resolvedId: string = doc.id ?? doc.did;
console.log('  Resolved:', resolvedId);
console.log('  Keys:    ', doc.verificationMethod?.length ?? 0);
console.log('  Services:', doc.service?.length ?? 0);

// ── 6. Credential revocation ─────────────────────────────
section(6, 'Credential revocation');
const vc = await client.issueCredential({
  issuerDid:  operatorDid,
  issuerName: 'AgentSight Quickstart',
  subjectDid: agentDid,
  type: ['VerifiableCredential', 'EmployeeCredential'],
  credentialSubject: { id: agentDid, name: 'Alice', department: 'Finance' },
});
console.log('  Issued credential:', vc.id);

const before = await client.checkRevocationStatus(vc.id);
console.log('  Status before revocation — revoked:', before.revoked);

await client.revokeCredential(vc.id, 'Employee left the organisation');

const after = await client.checkRevocationStatus(vc.id);
console.log('  Status after revocation  — revoked:', after.revoked, '| reason:', after.reason ?? '(none)');
if (!after.revoked) { console.error('  ✗ Revocation did not take effect'); process.exitCode = 1; }
else console.log('  ✓ Revocation confirmed');

// ── Summary ─────────────────────────────────────────────
console.log(`\n${'═'.repeat(52)}`);
console.log('  ALL STEPS COMPLETE');
console.log('═'.repeat(52));
console.log('  Operator DID:', operatorDid);
console.log('  Agent DID:   ', agentDid);
console.log('  Trust score: ', s3.newScore, '/ 100 —', s3.autonomyLevel);
console.log();

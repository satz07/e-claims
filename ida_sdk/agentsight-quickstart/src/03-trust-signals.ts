/**
 * Step 3 — Record trust signals
 *
 * Trust signals update an agent's score (0–100) and autonomy level:
 *
 *   Score < 30   → Intern   (read-only access)
 *   Score ≥ 30   → Junior   (standard task execution)
 *   Score ≥ 60   → Senior   (autonomous decision-making)
 *   Score ≥ 85   → Principal (unrestricted + can delegate)
 *
 * Valid signal types:
 *   task_completed, task_failed, verification_success, verification_failure,
 *   attestation, complaint, delegation_received, delegation_revoked, uptime_ping
 *
 * Run:
 *   AGENT_DID=did:adi:... npm run 03:trust-signals
 */
import { client } from './client.js';

const agentDid = process.env.AGENT_DID;
if (!agentDid) {
  console.error('Set AGENT_DID=did:adi:... (output of step 2)');
  process.exit(1);
}

console.log(`\nAgent: ${agentDid}\n`);

// Positive signal
const r1 = await client.recordTrustSignal(agentDid, {
  type:    'task_completed',
  source:  'agentsight-platform',
  details: 'Successfully processed 47 invoices in batch run #82',
});
console.log('✓ task_completed');
console.log(`  Score: ${r1.previousScore} → ${r1.newScore}  |  Level: ${r1.autonomyLevel}`);

// Verification success — bigger positive
const r2 = await client.recordTrustSignal(agentDid, {
  type:    'verification_success',
  source:  'agentsight-platform',
  details: 'Credential verification completed successfully',
});
console.log('✓ verification_success');
console.log(`  Score: ${r2.previousScore} → ${r2.newScore}  |  Level: ${r2.autonomyLevel}`);

// Negative signal
const r3 = await client.recordTrustSignal(agentDid, {
  type:    'task_failed',
  source:  'agentsight-platform',
  details: 'Timeout during overnight batch run',
});
console.log('✓ task_failed');
console.log(`  Score: ${r3.previousScore} → ${r3.newScore}  |  Level: ${r3.autonomyLevel}`);

console.log(`\n  Final trust score: ${r3.newScore} / 100  (${r3.autonomyLevel})\n`);

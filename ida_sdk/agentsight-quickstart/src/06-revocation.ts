/**
 * Step 6 — Issue a credential, check its status, revoke it, check again
 *
 * Shows the full credential lifecycle:
 *   issue → verify status (active) → revoke → verify status (revoked)
 *
 * Run:
 *   ISSUER_DID=did:adi:... SUBJECT_DID=did:adi:... npm run 06:revocation
 *
 * If you skip the env vars, the script mints two fresh DIDs automatically.
 */
import { client } from './client.js';

// ── DIDs ────────────────────────────────────────────────────────────────────
let issuerDid = process.env.ISSUER_DID as string;
let subjectDid = process.env.SUBJECT_DID as string;

if (!issuerDid) {
  const r = await client.createDID({ keyType: 'ed25519' }) as any;
  issuerDid = r.did ?? r.id;
  console.log('Minted issuer DID: ', issuerDid);
}
if (!subjectDid) {
  const r = await client.createDID({ keyType: 'ed25519' }) as any;
  subjectDid = r.did ?? r.id;
  console.log('Minted subject DID:', subjectDid);
}

// ── Issue ────────────────────────────────────────────────────────────────────
console.log('\n─── Issue credential ───────────────────────────────');
const vc = await client.issueCredential({
  issuerDid,
  issuerName: 'AgentSight Quickstart',
  subjectDid,
  type: ['VerifiableCredential', 'EmployeeCredential'],
  credentialSubject: {
    id:         subjectDid,
    name:       'Alice',
    department: 'Finance',
    clearance:  'L2',
  },
  expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
});

const credentialId = vc.id;
console.log('✓ Credential issued');
console.log('  ID:      ', credentialId);
console.log('  Type:    ', vc.type.join(', '));
console.log('  Issued:  ', vc.issuanceDate);
console.log('  Expires: ', vc.expirationDate ?? '(none)');

// ── Status check — should be active ─────────────────────────────────────────
console.log('\n─── Check status (before revocation) ───────────────');
const before = await client.checkRevocationStatus(credentialId);
console.log('  revoked:', before.revoked);
if (!before.revoked) {
  console.log('✓ Credential is active');
} else {
  console.log('✗ Unexpected: already revoked');
}

// ── Revoke ───────────────────────────────────────────────────────────────────
console.log('\n─── Revoke credential ──────────────────────────────');
await client.revokeCredential(credentialId, 'Employee left the organisation');
console.log('✓ Credential revoked');

// ── Status check — should now be revoked ─────────────────────────────────────
console.log('\n─── Check status (after revocation) ────────────────');
const after = await client.checkRevocationStatus(credentialId);
console.log('  revoked:', after.revoked);
console.log('  reason: ', after.reason ?? '(none)');
if (after.revoked) {
  console.log('✓ Revocation confirmed');
} else {
  console.log('✗ Credential still shows as active — something went wrong');
  process.exitCode = 1;
}

console.log();

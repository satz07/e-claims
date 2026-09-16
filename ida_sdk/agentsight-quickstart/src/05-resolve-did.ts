/**
 * Step 5 — Resolve a DID
 *
 * Fetch the W3C DID Document for any did:adi identifier. The document
 * contains the public key material and service endpoints needed to
 * verify credentials and establish secure connections.
 *
 * Run:
 *   DID=did:adi:... npm run 05:resolve-did
 */
import { client } from './client.js';

const did = process.env.DID;
if (!did) {
  console.error('Set DID=did:adi:...');
  process.exit(1);
}

const doc = await client.resolveDID(did) as any;

console.log('\n✓ DID Document resolved\n');
console.log('  DID:       ', doc.id ?? doc.did);
console.log('  Controller:', (doc.controller as string[] | string | undefined)?.[0] ?? doc.controller);
console.log('  Created:   ', doc.created);
console.log('  Updated:   ', doc.updated);
console.log('  Deactivated:', doc.deactivated);

if (doc.verificationMethod?.length) {
  console.log('\n  Verification methods:');
  for (const vm of doc.verificationMethod) {
    console.log(`    - ${vm.id}  (${vm.type})`);
  }
}

if (doc.service?.length) {
  console.log('\n  Services:');
  for (const svc of doc.service) {
    console.log(`    - ${svc.type}: ${svc.serviceEndpoint}`);
  }
}

console.log();

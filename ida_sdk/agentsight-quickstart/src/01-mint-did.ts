/**
 * Step 1 — Mint a DID
 *
 * Creates a new decentralized identifier on the ADI blockchain using an
 * Ed25519 key pair. The private key is returned once — store it securely.
 *
 * Run:
 *   npm run 01:mint-did
 */
import { client } from './client.js';

const result = await client.createDID({ keyType: 'ed25519' }) as any;

const did: string = result.did ?? result.id;
const privateKeyHex: string = result.privateKeyHex ?? result.privateKey ?? '(not returned — already stored)';

console.log('\n✓ DID minted successfully\n');
console.log('  DID:              ', did);
console.log('  Private key (hex):', privateKeyHex);
console.log('\n  ⚠  Store the private key in a secrets manager — it is never returned again.\n');

// Export so run-all.ts can chain steps
export { did };

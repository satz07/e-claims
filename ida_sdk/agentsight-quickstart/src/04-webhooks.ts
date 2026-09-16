/**
 * Step 4 — Webhook subscriptions
 *
 * Subscribe to agent lifecycle events. IDA will POST signed payloads to your
 * endpoint whenever these events fire:
 *
 *   agent.provisioned    — new agent DID minted
 *   agent.revoked        — agent decommissioned
 *   agent.trust_updated  — trust score changed
 *
 * Deliveries are HMAC-SHA256-signed with your secret and retried up to 3
 * times with exponential backoff on failure.
 *
 * Run:
 *   OWNER_DID=did:adi:... npm run 04:webhooks
 */
import { client } from './client.js';

const ownerDid = process.env.OWNER_DID;
if (!ownerDid) {
  console.error('Set OWNER_DID=did:adi:... (your operator DID from step 1 or 2)');
  process.exit(1);
}

// Register
const webhook = await client.registerWebhook({
  ownerDid,
  targetUrl: 'https://your-service.example.com/ida-events',
  secret:    'replace-with-a-strong-random-secret',
  events:    ['agent.provisioned', 'agent.revoked', 'agent.trust_updated'],
});

console.log('\n✓ Webhook registered');
console.log('  ID:     ', webhook.id);
console.log('  URL:    ', webhook.targetUrl);
console.log('  Events: ', webhook.events.join(', '));
console.log('  Active: ', webhook.active);

// List
const list = await client.listWebhooks(ownerDid);
console.log(`\n✓ You have ${list.length} active webhook(s) for this owner`);

// Cleanup (remove the test webhook)
await client.deleteWebhook(webhook.id);
console.log(`\n✓ Webhook ${webhook.id} deleted\n`);

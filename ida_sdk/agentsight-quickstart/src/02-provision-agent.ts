/**
 * Step 2 — Provision AI agents under one sponsor
 *
 * Each call mints a *new* DID for the agent. The operator and sponsor DIDs stay
 * the same across calls, so one sponsor can back a whole fleet — every agent
 * with its own cryptographic identity, all traceable to one accountable party.
 *
 * Per call IDA:
 *   - Mints a fresh Ed25519 key pair and derives the agent's DID from it
 *   - Issues a W3C AgentIdentityCredential (signed VC)
 *   - Generates a one-time IBCT signing key for MCP tool calls
 *   - Returns the initial trust score and autonomy level
 *
 * operatorDid vs sponsorDid
 *   operator — who runs the agent day to day. Drives ownership: the agent shows
 *              up under this DID's owner in /agents/me.
 *   sponsor  — the principal accountable for the agent. Optional.
 *
 * Both must be a DID you own, or one this platform has never seen (so you can
 * name an external partner's DID). Naming a DID that belongs to another user is
 * refused with 403 — it would otherwise place your agent in their agent list,
 * or make them look responsible for it.
 *
 * Run:
 *   npm run 02:provision-agent                      # one agent, operator minted for you
 *   OPERATOR_DID=did:adi:… npm run 02:provision-agent
 *   FLEET_SIZE=3 OPERATOR_DID=did:adi:… npm run 02:provision-agent
 *
 * The typical integration: register on the portal, create a DID with MetaMask,
 * issue an API key in Settings, then pass that DID as OPERATOR_DID here.
 */
import { client } from './client.js';

// Use an existing operator DID or mint a fresh one for this demo.
let operatorDid = process.env.OPERATOR_DID as string;

if (!operatorDid) {
  console.log('No OPERATOR_DID set — minting one now...');
  const op = await client.createDID({ keyType: 'ed25519' }) as any;
  operatorDid = op.did ?? op.id;
  console.log('  Operator DID:', operatorDid, '\n');
}

// One sponsor for the whole fleet. Here the operator sponsors its own agents,
// which is the common case; in an enterprise setup the sponsor would be the
// tenant's DID and the operator a per-team or per-service DID.
const sponsorDid = process.env.SPONSOR_DID ?? operatorDid;
const fleetSize = Math.max(1, Number(process.env.FLEET_SIZE ?? 1));

// Distinct roles so the fleet isn't N copies of the same agent.
//
// `labels` are caller-defined key/value pairs. IDA stores them verbatim and
// never interprets them — pick whatever dimensions you group agents by (team,
// environment, tenant, cost centre). They are what makes a fleet navigable:
// without them you are left matching opaque DIDs by eye.
const blueprints = [
  {
    name: 'Invoice Processor',
    blueprintId: 'bp-finance-v2',
    labels: { team: 'finance', env: 'prod' },
    capabilities: [
      { name: 'invoice.parse', description: 'Extract line items from invoice PDFs' },
      { name: 'invoice.validate', description: 'Cross-check totals and VAT numbers' },
    ],
  },
  {
    name: 'Contract Reviewer',
    blueprintId: 'bp-legal-v1',
    labels: { team: 'legal', env: 'prod' },
    capabilities: [
      { name: 'document.review', description: 'Flag non-standard clauses' },
    ],
  },
  {
    name: 'Expense Auditor',
    blueprintId: 'bp-finance-v3',
    labels: { team: 'finance', env: 'dev' },
    capabilities: [
      { name: 'expense.audit', description: 'Match receipts against policy' },
    ],
  },
];

console.log(`─── Provisioning ${fleetSize} agent${fleetSize > 1 ? 's' : ''} ───`);
console.log('  operator:', operatorDid);
console.log('  sponsor :', sponsorDid, sponsorDid === operatorDid ? '(same as operator)' : '');
console.log();

const agentDids: string[] = [];

for (let i = 0; i < fleetSize; i++) {
  const bp = blueprints[i % blueprints.length];

  try {
    const agent = await client.provisionAgent({
      name: fleetSize > 1 ? `${bp.name} ${i + 1}` : bp.name,
      operatorDid,
      sponsorDid,
      blueprintId: bp.blueprintId,
      platform: 'agentsight',
      // Stored as Intern. Note the response's autonomyLevel is derived from the
      // starting trust score (50) rather than echoing this field, so it reads
      // "Junior" below — getAgent() returns the stored level, which is the one
      // that governs permissions.
      autonomyLevel: 0,
      modelInfo: { provider: 'OpenAI', name: 'gpt-4o', version: '2026-01' },
      capabilities: bp.capabilities,
      labels: bp.labels,
    });

    agentDids.push(agent.agentDid);

    console.log(`✓ ${bp.name}`);
    console.log('    Agent DID     :', agent.agentDid);
    console.log('    Trust score   :', agent.trustScore, '/ 100');
    // Derived from the starting trust score, not the autonomyLevel we sent —
    // hence "Junior" for an agent stored at Intern. getAgent() returns the
    // stored level, which is what governs permissions.
    console.log('    Autonomy level:', agent.autonomyLevel, '(score-derived; stored level is Intern)');
    console.log('    Permissions   :', agent.permissions?.join(', ') || '(none)');
    if (i === 0) {
      console.log('    IBCT key (hex):', agent.ibctSigningKeyHex.slice(0, 32) + '…');
      console.log('      ↑ returned once, never stored by IDA — put it in a secrets manager');
    }
    console.log();
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg.includes('belongs to another user')) {
      console.log('✗ Refused:', msg);
      console.log('  operatorDid and sponsorDid must be a DID you own, or one this');
      console.log('  platform has never seen. Check OPERATOR_DID / SPONSOR_DID.\n');
      process.exit(1);
    }
    throw e;
  }
}

if (agentDids.length > 1) {
  console.log('─── One sponsor, one identity each ───');
  console.log('  sponsor:', sponsorDid);
  for (const did of agentDids) console.log('    •', did);
  console.log(`\n  ${agentDids.length} agents, ${new Set(agentDids).size} distinct DIDs.`);
  console.log('  Every provision call mints a new key pair, so agent DIDs never');
  console.log('  collide and are never derived from the operator or sponsor.\n');

  // Labels turn that list of DIDs into something you can query. Repeating the
  // parameter requires every label to match, so this narrows rather than widens.
  //
  // /agents/me is scoped to the caller: it returns agents whose operator is the
  // caller's own subject, or a DID the caller owns. That means the listing only
  // finds these agents when the API key belongs to the user who owns
  // OPERATOR_DID — a key issued from Settings, not the shared dev key, whose
  // subject owns nothing.
  console.log('─── Finding agents by label ───');
  let listed = 0;

  const queries: Array<Record<string, string>> = [
    { team: 'finance' },
    { team: 'finance', env: 'prod' },
  ];

  for (const labels of queries) {
    const page = await client.listAgents({ labels, limit: 50 });
    listed += page.totalCount;
    console.log(`  ${JSON.stringify(labels)}`);
    for (const a of page.items) {
      console.log(`    • ${a.name} — ${String(a.id).slice(0, 46)}…`);
    }
    console.log(`    ${page.totalCount} match${page.totalCount === 1 ? '' : 'es'}\n`);
  }

  if (listed === 0) {
    console.log('  No rows came back, which is expected when the API key and the');
    console.log('  operator DID belong to different identities — /agents/me only');
    console.log('  lists agents the caller operates or owns. The labels were still');
    console.log('  stored; re-run with an API key from Settings and OPERATOR_DID set');
    console.log('  to a DID that key\'s user owns:\n');
    console.log('    IDA_API_KEY=<key from Settings> \\');
    console.log('    OPERATOR_DID=<a DID you created> \\');
    console.log('    FLEET_SIZE=3 npm run 02:provision-agent\n');
  }
}

export { operatorDid, sponsorDid };
export const agentDid = agentDids[0];

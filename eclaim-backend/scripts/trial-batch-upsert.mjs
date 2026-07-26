/**
 * Trial: pack N claims into ONE on-chain tx via ClaimRegistry.upsertClaims.
 *
 * Usage:
 *   node scripts/trial-batch-upsert.mjs --count 10
 *   node scripts/trial-batch-upsert.mjs --count 5 --dry-run
 *
 * Env: OWNER_PRIVATE_KEY, APEIRO_RPC_URL / CHAIN_RPC_URL, CLAIM_REGISTRY_ADDRESS
 *
 * How to verify:
 *   - Script prints explorer tx URL
 *   - Receipt should show many ClaimUpserted logs, but still 1 transaction
 *   - Block page may still say "1 txns" (one tx, many claim events)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import ABI from '../src/eclaim-contract/CLAIM_REGISTRY.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ZERO =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(path.join(root, '.env'));

const RPC =
  process.env.APEIRO_RPC_URL ||
  process.env.CHAIN_RPC_URL ||
  'https://rpc.apeiro.adifoundation.ai';
const REGISTRY =
  process.env.CLAIM_REGISTRY_ADDRESS ||
  '0xC797A6e0c7C2F631F176279980E638FBB255E9B0';
const EXPLORER = (
  process.env.CHAIN_EXPLORER_URL || 'https://explorer.apeiro.adifoundation.ai'
).replace(/\/$/, '');
const KEY = process.env.OWNER_PRIVATE_KEY || process.env.ECLAIM_PRIVATE_KEY || '';

function h(s) {
  return ethers.keccak256(ethers.toUtf8Bytes(String(s || '')));
}

function parseArgs(argv) {
  const out = { count: 10, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') out.count = Number(argv[++i]);
    else if (a === '--dry-run') out.dryRun = true;
  }
  out.count = Math.max(1, Math.min(50, Number(out.count) || 10));
  return out;
}

function buildClaim(i, baseNum) {
  const claimId = randomUUID();
  const bundleId = randomUUID();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const claimNumber = baseNum + BigInt(i);
  return {
    claimId,
    claimNumber: claimNumber.toString(),
    struct: {
      claimIdHash: h(claimId),
      claimNumber,
      claimTypeHash: h('institutional'),
      providerNameHash: h('FID-SCALE-002'),
      providerLevelHash: h('LEVEL 4'),
      patientNameHash: ZERO,
      accessCodeHash: ZERO,
      bundleIdHash: h(bundleId),
      crIdHash: h('CR-SCALE-002'),
      externalIdHash: ZERO,
      shaCodeHash: h('CAT-SCALE-002'),
      shaPackageCodeHash: h(bundleId),
      claimCodeHash: h('PMF-08-010'),
      creationDate: now,
      dateFrom: now,
      dateTo: now + 86400n,
      dateProcessed: 0n,
      claimedTotal: BigInt(1000 + i * 10) * 10n ** 18n,
      approvedTotal: 0n,
      adjustment: 0n,
      hasApprovedTotal: false,
      hasAdjustment: false,
      hasDateProcessed: false,
      auditFlag: false,
      ipsClaim: false,
      nationalIdHash: h(`NID-BATCH-${i}`),
      guaranteeIdHash: ZERO,
      explanationHash: ZERO,
      rejectionReasonHash: ZERO,
      status: 0,
      surveillanceStatus: 0,
      colourCodeHash: ZERO,
      count: 0n,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!KEY) {
    console.error('OWNER_PRIVATE_KEY (or ECLAIM_PRIVATE_KEY) is required');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
  const wallet = new ethers.Wallet(KEY.startsWith('0x') ? KEY : `0x${KEY}`, provider);
  const abi = ABI.abi || ABI;
  const contract = new ethers.Contract(REGISTRY, abi, wallet);
  const iface = new ethers.Interface(abi);
  const topic0 = iface.getEvent('ClaimUpserted').topicHash;

  const baseNum = BigInt(Date.now()) * 1000n;
  const built = Array.from({ length: args.count }, (_, i) => buildClaim(i, baseNum));
  const structs = built.map((b) => b.struct);

  console.log(`RPC:      ${RPC}`);
  console.log(`Registry: ${REGISTRY}`);
  console.log(`Wallet:   ${wallet.address}`);
  console.log(`Batch:    ${args.count} claims in ONE upsertClaims tx`);
  console.log(`Dry-run:  ${args.dryRun}`);

  let gas;
  try {
    gas = await contract.upsertClaims.estimateGas(structs);
    console.log(`estimateGas: ${gas.toString()}`);
  } catch (e) {
    console.error('estimateGas failed:', e.shortMessage || e.message);
    console.error('If this fails, wallet may lack submitter rights or gas/data is too large.');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('Dry-run OK — would submit these claimNumbers:');
    for (const b of built) console.log(`  #${b.claimNumber} claimId=${b.claimId}`);
    return;
  }

  const tx = await contract.upsertClaims(structs, {
    gasLimit: (gas * 130n) / 100n,
  });
  console.log(`\ntxHash:   ${tx.hash}`);
  console.log(`explorer: ${EXPLORER}/tx/${tx.hash}`);
  console.log('Waiting for receipt…');

  const receipt = await tx.wait();
  const upsertLogs = (receipt.logs || []).filter(
    (l) => l.address?.toLowerCase() === REGISTRY.toLowerCase() && l.topics?.[0] === topic0,
  );

  console.log('');
  console.log(`status:           ${receipt.status === 1 ? 'success' : 'FAILED'}`);
  console.log(`blockNumber:      ${receipt.blockNumber}`);
  console.log(`gasUsed:          ${receipt.gasUsed?.toString()}`);
  console.log(`ClaimUpserted logs in this tx: ${upsertLogs.length} (expected ${args.count})`);
  console.log('');
  console.log('Check explorer:');
  console.log(`  Tx:    ${EXPLORER}/tx/${tx.hash}`);
  console.log(`  Block: ${EXPLORER}/block/${receipt.blockNumber}`);
  console.log('Note: block will still show "1 txns" — one transaction containing many ClaimUpserted events.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

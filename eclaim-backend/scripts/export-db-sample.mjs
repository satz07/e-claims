/**
 *
 * - Same tables/fields as seed-from-db.mjs
 * - Dedupes by claim_id
 * - Skips zero-amount rows
 * - Skips claim_ids already in local OK/DUP seed logs
 * - Skips claim_ids already on-chain (V3 + V1 ClaimUpserted claimIdHash scan)
 *
 * Usage (VPN + CLAIM_DB_* required):
 *   node scripts/export-db-sample.mjs --limit 200
 *   node scripts/export-db-sample.mjs --limit 500 --after 700000 --out dumps/<dump-name>.jsonl
 *   node scripts/export-db-sample.mjs --limit 100 --use claim --skip-onchain-check
 *
 * Output: JSONL rows (not FHIR). seed-from-dump.mjs builds FHIR at submit time.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { ethers } from 'ethers';
import ABI from '../src/eclaim-contract/CLAIM_REGISTRY.json' with { type: 'json' };
import ABI_V1 from '../src/eclaim-contract/CLAIM_REGISTRY_V1.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_DIR = path.join(root, 'logs');
const DUMP_DIR = path.join(root, 'dumps');

function loadEnvFile(filePath) {
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
loadEnvFile(path.join(root, '.env'));

const RPC =
  process.env.APEIRO_RPC_URL ||
  process.env.CHAIN_RPC_URL ||
  'https://rpc.apeiro.adifoundation.ai';
const V3 =
  process.env.CLAIM_REGISTRY_ADDRESS ||
  '0xC797A6e0c7C2F631F176279980E638FBB255E9B0';
const V1 = process.env.CLAIM_REGISTRY_V1_ADDRESS || '';

const DB = {
  host: process.env.CLAIM_DB_HOST || '10.10.100.113',
  port: Number(process.env.CLAIM_DB_PORT || 5432),
  user: process.env.CLAIM_DB_USER || 'netgroup',
  password: process.env.CLAIM_DB_PASSWORD || '',
  database: process.env.CLAIM_DB_NAME || 'claim',
  ssl:
    process.env.CLAIM_DB_SSL === 'false'
      ? false
      : { rejectUnauthorized: process.env.CLAIM_DB_SSL_REJECT_UNAUTHORIZED === 'true' },
};

function parseArgs(argv) {
  const out = {
    limit: 200,
    use: 'both',
    after: 0,
    to: null,
    out: path.join(DUMP_DIR, 'qa-sample.jsonl'),
    skipOnchainCheck: false,
    fetchMultiplier: 5,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--use') out.use = String(argv[++i]).toLowerCase();
    else if (a === '--after') out.after = Number(argv[++i]);
    else if (a === '--to') out.to = Number(argv[++i]);
    else if (a === '--out') out.out = path.resolve(argv[++i]);
    else if (a === '--skip-onchain-check') out.skipOnchainCheck = true;
  }
  out.limit = Math.max(1, Math.min(5_000, Number(out.limit) || 200));
  if (out.use === 'preauth') out.use = 'preauthorization';
  if (!['claim', 'preauthorization', 'both'].includes(out.use)) out.use = 'both';
  return out;
}

function useFilterSql(use) {
  if (use === 'claim') return `AND c.use = 'Claim'`;
  if (use === 'preauthorization') return `AND c.use = 'Preauthorization'`;
  return `AND c.use IN ('Claim', 'Preauthorization')`;
}

function h(s) {
  return ethers.keccak256(ethers.toUtf8Bytes(String(s || '')));
}

/** claim_ids already successfully seeded (local logs). */
function loadOkClaimIdsFromLogs() {
  const ids = new Set();
  if (!fs.existsSync(LOG_DIR)) return ids;
  for (const name of fs.readdirSync(LOG_DIR)) {
    if (!name.startsWith('db-seed-records') || !name.endsWith('.log')) continue;
    const text = fs.readFileSync(path.join(LOG_DIR, name), 'utf8');
    for (const line of text.split('\n')) {
      if (!/\bOK\b/.test(line) && !/\bDUP\b/.test(line)) continue;
      const m = /claim_id=([^\s]+)/.exec(line);
      if (m?.[1]) ids.add(m[1]);
    }
  }
  return ids;
}

async function loadOnChainClaimIdHashes() {
  const provider = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
  const latest = await provider.getBlockNumber();
  const hashes = new Set();
  const CHUNK = 1_500;
  const CONCURRENCY = 8;

  async function scan(address, abiJson, label) {
    if (!address) return;
    const abi = abiJson.abi || abiJson;
    const iface = new ethers.Interface(abi);
    const topic0 = iface.getEvent('ClaimUpserted').topicHash;
    const ranges = [];
    for (let from = 0; from <= latest; from += CHUNK) {
      ranges.push([from, Math.min(from + CHUNK - 1, latest)]);
    }
    let raw = 0;
    for (let i = 0; i < ranges.length; i += CONCURRENCY) {
      const batch = ranges.slice(i, i + CONCURRENCY);
      const parts = await Promise.all(
        batch.map(async ([from, to]) => {
          try {
            return await provider.send('eth_getLogs', [
              {
                address,
                fromBlock: ethers.toBeHex(from),
                toBlock: ethers.toBeHex(to),
                topics: [topic0],
              },
            ]);
          } catch {
            return [];
          }
        }),
      );
      for (const logs of parts) {
        raw += logs.length;
        for (const log of logs) {
          try {
            const parsed = iface.parseLog(log);
            hashes.add(String(parsed.args.claimIdHash).toLowerCase());
          } catch {
            /* ignore */
          }
        }
      }
    }
    console.log(`  on-chain ${label}: ${raw} ClaimUpserted event(s)`);
  }

  console.log(`Scanning on-chain claimIdHash set (RPC=${RPC}, latest=${latest})…`);
  await scan(V3, ABI, 'V3');
  if (V1) await scan(V1, ABI_V1, 'V1');
  console.log(`  unique claimIdHash on-chain: ${hashes.size}`);
  return hashes;
}

async function fetchCandidates(client, after, limit, use, to) {
  const params = [after, limit];
  let toClause = '';
  if (to != null) {
    params.push(to);
    toClause = `AND c.claim_number <= $${params.length}`;
  }
  const sql = `
    SELECT
      c.claim_number,
      c.claim_id::text AS claim_id,
      c.bundle_id,
      c.use,
      c.claim_type,
      c.claimed_total AS claimed_total_raw,
      COALESCE(
        NULLIF(c.claimed_total, 0),
        (
          SELECT SUM(
            CASE
              WHEN i.quantity * i.unit_price > 0 THEN i.quantity * i.unit_price
              ELSE 0
            END
          )
          FROM claim_items i
          WHERE i.claim_id = c.claim_id
        ),
        0
      ) AS claimed_total,
      c.date_from,
      c.date_to,
      c.created_date,
      c.is_ips_claim,
      COALESCE(c.facility_provider_level, pr.level) AS facility_level,
      p.cr_id,
      p.national_id,
      pr.fid_code,
      pr.name AS provider_name,
      pr.level AS provider_level,
      pr.county,
      ci.code AS intervention_code,
      ci.intervention_name,
      COALESCE(ca.coverage_type, 'SHIF') AS scheme_code
    FROM claims c
    JOIN patient p ON p.id = c.patient
    JOIN provider pr ON pr.id = c.provider
    LEFT JOIN LATERAL (
      SELECT code, intervention_name
      FROM claim_items
      WHERE claim_id = c.claim_id
      ORDER BY sequence NULLS LAST, item_id
      LIMIT 1
    ) ci ON true
    LEFT JOIN LATERAL (
      SELECT coverage_type
      FROM claim_attributes
      WHERE claim_id = c.claim_id AND status = 'ACTIVE'
      ORDER BY id DESC
      LIMIT 1
    ) ca ON true
    WHERE c.claim_number > $1
      ${toClause}
      AND pr.fid_code IS NOT NULL AND pr.fid_code <> ''
      AND p.cr_id IS NOT NULL AND p.cr_id <> ''
      ${useFilterSql(use)}
    ORDER BY c.claim_number ASC
    LIMIT $2
  `;
  const { rows } = await client.query(sql, params);
  return rows;
}

function serializeRow(row) {
  return {
    claim_number: Number(row.claim_number),
    claim_id: row.claim_id,
    bundle_id: row.bundle_id || row.claim_id,
    use: row.use,
    claim_type: row.claim_type || 'institutional',
    claimed_total: Number(row.claimed_total) || 0,
    claimed_total_raw: row.claimed_total_raw != null ? Number(row.claimed_total_raw) : null,
    date_from: row.date_from instanceof Date ? row.date_from.toISOString() : row.date_from,
    date_to: row.date_to instanceof Date ? row.date_to.toISOString() : row.date_to,
    created_date:
      row.created_date instanceof Date ? row.created_date.toISOString() : row.created_date,
    is_ips_claim: !!row.is_ips_claim,
    facility_level: row.facility_level,
    cr_id: row.cr_id,
    national_id: row.national_id || null,
    fid_code: row.fid_code,
    provider_name: row.provider_name,
    provider_level: row.provider_level,
    county: row.county,
    intervention_code: row.intervention_code,
    intervention_name: row.intervention_name,
    scheme_code: row.scheme_code || 'SHIF',
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!DB.password) {
    console.error('CLAIM_DB_PASSWORD is not set in .env');
    process.exit(1);
  }

  console.log(`DB:      ${DB.user}@${DB.host}:${DB.port}/${DB.database}`);
  console.log(`Out:     ${args.out}`);
  console.log(`Target:  ${args.limit} unique off-chain rows (use=${args.use})`);
  console.log(`Range:   claim_number > ${args.after}${args.to != null ? ` AND <= ${args.to}` : ''}`);

  const logOk = loadOkClaimIdsFromLogs();
  console.log(`Local OK/DUP claim_ids in seed logs: ${logOk.size}`);

  let onChainHashes = new Set();
  if (!args.skipOnchainCheck) {
    onChainHashes = await loadOnChainClaimIdHashes();
  } else {
    console.log('Skipping on-chain check (--skip-onchain-check)');
  }

  const client = new pg.Client(DB);
  await client.connect();

  const selected = [];
  const seenClaimIds = new Set();
  let cursor = args.after;
  let fetchedTotal = 0;
  let skippedDup = 0;
  let skippedZero = 0;
  let skippedLog = 0;
  let skippedOnchain = 0;
  const fetchSize = Math.min(2_000, Math.max(args.limit * args.fetchMultiplier, args.limit));

  try {
    while (selected.length < args.limit) {
      const rows = await fetchCandidates(client, cursor, fetchSize, args.use, args.to);
      if (!rows.length) {
        console.log('No more DB rows in range.');
        break;
      }
      fetchedTotal += rows.length;
      cursor = Number(rows[rows.length - 1].claim_number);

      for (const row of rows) {
        if (selected.length >= args.limit) break;
        const id = row.claim_id;
        if (!id) continue;
        if (seenClaimIds.has(id)) {
          skippedDup++;
          continue;
        }
        const amount = Number(row.claimed_total) || 0;
        if (amount <= 0) {
          skippedZero++;
          continue;
        }
        if (logOk.has(id)) {
          skippedLog++;
          continue;
        }
        const idHash = h(id).toLowerCase();
        if (onChainHashes.has(idHash)) {
          skippedOnchain++;
          continue;
        }
        seenClaimIds.add(id);
        selected.push(serializeRow(row));
      }

      console.log(
        `  progress: selected=${selected.length}/${args.limit} cursor=#${cursor} fetched=${fetchedTotal} ` +
          `(skip dup=${skippedDup} zero=${skippedZero} log=${skippedLog} onchain=${skippedOnchain})`,
      );

      if (args.to != null && cursor >= args.to) break;
    }
  } finally {
    await client.end();
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  const meta = {
    exportedAt: new Date().toISOString(),
    source: `${DB.host}/${DB.database}`,
    count: selected.length,
    use: args.use,
    after: args.after,
    to: args.to,
    skipped: {
      duplicateClaimId: skippedDup,
      zeroAmount: skippedZero,
      alreadyInSeedLogs: skippedLog,
      alreadyOnChain: skippedOnchain,
    },
    note: 'JSONL claim rows (not FHIR). Use: node scripts/seed-from-dump.mjs --file ' + args.out,
  };
  const metaPath = args.out.replace(/\.jsonl$/i, '') + '.meta.json';
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  fs.writeFileSync(
    args.out,
    selected.map((r) => JSON.stringify(r)).join('\n') + (selected.length ? '\n' : ''),
  );

  console.log('');
  console.log(`Wrote ${selected.length} row(s) → ${args.out}`);
  console.log(`Meta → ${metaPath}`);
  console.log(
    `Skipped: dup=${skippedDup} zero=${skippedZero} seedLog=${skippedLog} onChain=${skippedOnchain}`,
  );
  if (selected.length < args.limit) {
    console.log(
      `Warning: only ${selected.length}/${args.limit} found. Try a different --after range.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

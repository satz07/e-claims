/**
 * Interactive / CLI claim+preauth generator.
 *
 * Picks random providers, citizens, and schemes from the local registry pool
 * (plaintext IDs that were registered on-chain). Varies intervention code,
 * billable period, amount, and care setting per record.
 *
 * Usage (interactive):
 *   node scripts/generate-claims.mjs
 *
 * Usage (non-interactive):
 *   node scripts/generate-claims.mjs --claims 100 --preauths 50
 *   node scripts/generate-claims.mjs --claims 20 --preauths 20 --ensure-pool 10
 *
 * Pool file: logs/seed-registry-pool.json
 * Run log:   logs/bulk-seed-runs.log
 *
 * Env: BACKEND_URL (default http://localhost:8001)
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_FILE = path.join(root, 'logs', 'bulk-seed-runs.log');
const POOL_FILE = path.join(root, 'logs', 'seed-registry-pool.json');

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

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8001').replace(/\/$/, '');
const RPC =
  process.env.APEIRO_RPC_URL ||
  process.env.CHAIN_RPC_URL ||
  'https://rpc.apeiro.adifoundation.ai';
const OWNER_KEY = process.env.OWNER_PRIVATE_KEY || process.env.ECLAIM_PRIVATE_KEY || '';

const LEVELS = ['LEVEL 2', 'LEVEL 3', 'LEVEL 4', 'LEVEL 5', 'LEVEL 6'];
const COUNTIES = [
  'NAIROBI',
  'MOMBASA',
  'KISUMU',
  'NAKURU',
  'KIAMBU',
  'UASIN GISHU',
  'KILIFI',
  'MACHAKOS',
  'NYERI',
  'KAKAMEGA',
];
const INTERVENTIONS = [
  { code: 'PMF-12-001', display: 'palliative care' },
  { code: 'PMF-08-010', display: 'outpatient consultation' },
  { code: 'PMF-15-002', display: 'laboratory panel' },
  { code: 'PMF-20-001', display: 'inpatient bed day' },
  { code: 'PMF-11-003', display: 'imaging study' },
  { code: 'PMF-09-004', display: 'maternity package' },
  { code: 'PMF-14-007', display: 'pharmacy dispense' },
  { code: 'PMF-18-001', display: 'surgical procedure' },
  { code: 'PMF-07-002', display: 'emergency visit' },
  { code: 'PMF-22-005', display: 'physiotherapy session' },
];

function pad(n, w = 3) {
  return String(n).padStart(w, '0');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function appendLog(lines) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, lines.join('\n') + '\n');
}

function defaultPool() {
  const providers = [
    {
      providerId: 'FID-35-108719-7',
      providerName: 'ST. LEONARDS HOSPITAL',
      level: 'LEVEL 4',
      county: 'NAIROBI',
    },
  ];
  const citizens = [{ crId: 'CR3248022528592-4' }];
  const schemes = [{ schemeCode: 'CAT-SHA-001' }];
  const clinicians = [{ clinicianId: 'CMP-DEMO-001', facilityFid: 'FID-35-108719-7' }];

  for (let i = 2; i <= 25; i++) {
    const id = pad(i);
    providers.push({
      providerId: `FID-SCALE-${id}`,
      providerName: `SCALE HOSPITAL ${id}`,
      level: LEVELS[(i - 1) % LEVELS.length],
      county: COUNTIES[(i - 1) % COUNTIES.length],
    });
    citizens.push({ crId: `CR-SCALE-${id}` });
    schemes.push({ schemeCode: `CAT-SCALE-${id}` });
    clinicians.push({
      clinicianId: `CMP-SCALE-${id}`,
      facilityFid: `FID-SCALE-${id}`,
    });
  }

  return { providers, citizens, schemes, clinicians, updatedAt: null };
}

function loadPool() {
  if (!fs.existsSync(POOL_FILE)) {
    const pool = defaultPool();
    savePool(pool);
    return pool;
  }
  const pool = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
  // merge defaults so classic demo IDs always exist
  const base = defaultPool();
  const merge = (key, idField) => {
    const seen = new Set((pool[key] || []).map((x) => x[idField]));
    for (const row of base[key]) {
      if (!seen.has(row[idField])) pool[key].push(row);
    }
  };
  merge('providers', 'providerId');
  merge('citizens', 'crId');
  merge('schemes', 'schemeCode');
  merge('clinicians', 'clinicianId');
  return pool;
}

function savePool(pool) {
  pool.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
}

async function getBalance() {
  if (!OWNER_KEY) return null;
  const pk = OWNER_KEY.startsWith('0x') ? OWNER_KEY : `0x${OWNER_KEY}`;
  const w = new ethers.Wallet(pk);
  const p = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
  const bal = await p.getBalance(w.address);
  return { address: w.address, adi: ethers.formatEther(bal) };
}

async function api(method, urlPath, body, retries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BACKEND}${urlPath}`, {
        method,
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const msg = data?.message || data?.error || text.slice(0, 200);
        const err = new Error(`${res.status} ${urlPath}: ${msg}`);
        if (res.status >= 400 && res.status < 500) throw err;
        lastErr = err;
      } else {
        return data;
      }
    } catch (err) {
      lastErr = err;
      if (/^4\d\d /.test(err.message)) throw err;
      const wait = Math.min(20_000, 800 * attempt * attempt);
      console.error(`  retry ${attempt}/${retries}: ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const wait = Math.min(20_000, 800 * attempt * attempt);
    console.error(`  retry ${attempt}/${retries}: ${lastErr?.message}`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw lastErr;
}

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    rl.question(`${question} [${fallback}]: `, (ans) => {
      const t = (ans || '').trim();
      resolve(t === '' ? String(fallback) : t);
    });
  });
}

function parseArgs(argv) {
  const out = { claims: null, preauths: null, ensurePool: 0, interactive: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--claims') out.claims = Number(argv[++i]);
    else if (a === '--preauths') out.preauths = Number(argv[++i]);
    else if (a === '--ensure-pool') out.ensurePool = Number(argv[++i]);
    else if (a === '--yes' || a === '-y') out.interactive = false;
  }
  if (out.claims != null || out.preauths != null) out.interactive = false;
  return out;
}

function randomPeriod() {
  // Random window in 2024–2026, 1–14 day length
  const year = pick([2024, 2025, 2026]);
  const startDay = randInt(1, 340);
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() + startDay);
  const days = randInt(1, 14);
  const end = new Date(start.getTime() + days * 86400000);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    created: start.toISOString().slice(0, 10),
  };
}

function buildBundle({ use, provider, citizen, scheme, intervention, amount, period, care }) {
  const claimId = randomUUID();
  const bundleId = randomUUID();
  return {
    claimId,
    intervention: intervention.code,
    period: `${period.created} +${Math.round((new Date(period.end) - new Date(period.start)) / 86400000)}d`,
    amount,
    care,
    bundle: {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'message',
      entry: [
        {
          resource: {
            resourceType: 'Organization',
            id: provider.providerId,
            name: provider.providerName,
            extension: [
              {
                url: 'https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level',
                valueCodeableConcept: {
                  coding: [{ code: provider.level || 'LEVEL 4' }],
                },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Coverage',
            extension: [
              { url: 'schemeCategoryCode', valueString: scheme.schemeCode },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Patient',
            id: citizen.crId,
            identifier: [
              { system: 'nationalid', value: `NID-${citizen.crId}` },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Claim',
            use,
            identifier: [
              {
                system: 'https://qa-mis.apeiro-digital.com/fhir/claim',
                value: claimId,
              },
            ],
            type: { coding: [{ code: 'institutional' }] },
            subType: { coding: [{ code: care }] },
            total: { value: amount, currency: 'KES' },
            billablePeriod: { start: period.start, end: period.end },
            created: period.created,
            provider: { reference: `Organization/${provider.providerId}` },
            patient: { reference: `Patient/${citizen.crId}` },
            item: [
              {
                productOrService: {
                  coding: [
                    {
                      code: intervention.code,
                      display: intervention.display,
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function ensureMorePool(pool, extra) {
  if (!extra || extra <= 0) return pool;
  const licenseFrom = '2024-01-01';
  const licenseTo = '2030-12-31';
  const startIdx =
    Math.max(
      0,
      ...pool.providers
        .map((p) => {
          const m = /^FID-SCALE-(\d+)$/.exec(p.providerId);
          return m ? Number(m[1]) : 0;
        }),
    ) + 1;

  console.log(`Adding ${extra} new registry sets starting at ${pad(startIdx)}…`);
  let created = 0;
  for (let n = 0; n < extra; n++) {
    const i = startIdx + n;
    const id = pad(i);
    const provider = {
      providerId: `FID-SCALE-${id}`,
      providerName: `SCALE HOSPITAL ${id}`,
      level: LEVELS[(i - 1) % LEVELS.length],
      county: COUNTIES[(i - 1) % COUNTIES.length],
    };
    const citizen = { crId: `CR-SCALE-${id}` };
    const scheme = { schemeCode: `CAT-SCALE-${id}` };
    const clinician = {
      clinicianId: `CMP-SCALE-${id}`,
      facilityFid: provider.providerId,
    };

    try {
      await api('POST', '/api/public/provider-registry/register', {
        providerId: provider.providerId,
        name: provider.providerName,
        level: provider.level,
        county: provider.county,
        facilityType: 'hospital',
        licenseValidFrom: licenseFrom,
        licenseValidTo: licenseTo,
      });
      created++;
    } catch {
      /* exists */
    }
    try {
      await api('POST', '/api/public/citizen-registry/register', {
        id: citizen.crId,
        meta: '',
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
    } catch {
      /* exists */
    }
    try {
      await api('POST', '/api/public/insurer-registry/register', {
        id: scheme.schemeCode,
        meta: '',
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
    } catch {
      /* exists */
    }
    try {
      await api('POST', '/api/public/clinician-registry/register', {
        id: clinician.clinicianId,
        meta: clinician.facilityFid,
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
    } catch {
      /* exists */
    }

    pool.providers.push(provider);
    pool.citizens.push(citizen);
    pool.schemes.push(scheme);
    pool.clinicians.push(clinician);
    console.log(`  pool + ${provider.providerId}`);
  }
  savePool(pool);
  console.log(`Pool updated (${created} new provider txs). providers=${pool.providers.length}`);
  return pool;
}

async function submitMany(use, count, pool) {
  let ok = 0;
  let errors = 0;
  const interventionsUsed = new Set();
  const periodsSample = [];

  for (let i = 0; i < count; i++) {
    const provider = pick(pool.providers);
    const citizen = pick(pool.citizens);
    const scheme = pick(pool.schemes);
    const intervention = pick(INTERVENTIONS);
    const period = randomPeriod();
    const care = Math.random() < 0.65 ? 'ip' : 'op';
    const amount = randInt(1200, 45000);
    interventionsUsed.add(intervention.code);
    if (periodsSample.length < 5) {
      periodsSample.push(`${period.created}→${period.end.slice(0, 10)}`);
    }

    const built = buildBundle({
      use,
      provider,
      citizen,
      scheme,
      intervention,
      amount,
      period,
      care,
    });

    try {
      await api('POST', '/api/public/eclaim-contract/submit', built.bundle);
      ok++;
    } catch (err) {
      errors++;
      if (errors <= 8 || errors % 25 === 0) {
        console.error(`  [${use} ${i + 1}/${count}] ${err.message}`);
      }
    }

    if ((i + 1) % 25 === 0 || i + 1 === count) {
      console.log(`  ${use} progress ${i + 1}/${count} ok=${ok} err=${errors}`);
    }
  }

  return { ok, errors, interventionsUsed: [...interventionsUsed], periodsSample };
}

async function main() {
  const args = parseArgs(process.argv);
  let claims = args.claims;
  let preauths = args.preauths;
  let ensurePool = args.ensurePool || 0;

  console.log(`Backend: ${BACKEND}`);
  console.log(`Log:     ${LOG_FILE}`);
  console.log(`Pool:    ${POOL_FILE}`);

  let pool = loadPool();
  console.log(
    `Pool size: providers=${pool.providers.length} citizens=${pool.citizens.length} schemes=${pool.schemes.length} clinicians=${pool.clinicians.length}`,
  );

  if (args.interactive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    claims = Number(await ask(rl, 'How many CLAIMS to create', 10));
    preauths = Number(await ask(rl, 'How many PRE-AUTHS to create', 10));
    ensurePool = Number(
      await ask(rl, 'Add how many NEW registry sets first (0 = use existing only)', 0),
    );
    rl.close();
  }

  claims = Math.max(0, Math.min(100_000, Number(claims) || 0));
  preauths = Math.max(0, Math.min(100_000, Number(preauths) || 0));
  if (claims + preauths === 0) {
    console.error('Nothing to create (claims=0 and preauths=0).');
    process.exit(1);
  }

  if (ensurePool > 0) {
    pool = await ensureMorePool(pool, ensurePool);
  }

  const start = new Date();
  const balBefore = await getBalance();
  appendLog([
    '',
    '════════════════════════════════════════════════════════════',
    `RUN START  ${start.toISOString()}`,
    `script     generate-claims.mjs`,
    `backend    ${BACKEND}`,
    `rpc        ${RPC}`,
    `requested  claims=${claims} preauths=${preauths}`,
    `pool       providers=${pool.providers.length} citizens=${pool.citizens.length} schemes=${pool.schemes.length}`,
    `wallet     ${balBefore?.address || 'n/a'}`,
    `balanceBefore  ${balBefore?.adi ?? 'n/a'} ADI`,
  ]);

  console.log(`\nCreating ${claims} claims + ${preauths} preauths…`);
  const claimStats = await submitMany('claim', claims, pool);
  const preauthStats = await submitMany('preauthorization', preauths, pool);

  const end = new Date();
  const balAfter = await getBalance();
  const durationSec = (end.getTime() - start.getTime()) / 1000;
  const spent =
    balBefore && balAfter
      ? (Number(balBefore.adi) - Number(balAfter.adi)).toFixed(6)
      : 'n/a';
  const totalOk = claimStats.ok + preauthStats.ok;
  const totalErr = claimStats.errors + preauthStats.errors;

  appendLog([
    `interventionsUsed  ${[...new Set([...claimStats.interventionsUsed, ...preauthStats.interventionsUsed])].join(',')}`,
    `periodSamples  ${[...claimStats.periodsSample, ...preauthStats.periodsSample].slice(0, 8).join(' | ')}`,
    `RUN END    ${end.toISOString()}`,
    `durationSec  ${durationSec.toFixed(1)}`,
    `durationHuman  ${(durationSec / 60).toFixed(1)} min`,
    `created  claims=${claimStats.ok} preauths=${preauthStats.ok} total=${totalOk} errors=${totalErr}`,
    `balanceAfter   ${balAfter?.adi ?? 'n/a'} ADI`,
    `tokensSpentApprox  ${spent} ADI`,
    '════════════════════════════════════════════════════════════',
  ]);

  console.log('\nDone.');
  console.log(`claims=${claimStats.ok}  preauths=${preauthStats.ok}  errors=${totalErr}`);
  console.log(`duration ${(durationSec / 60).toFixed(1)} min`);
  console.log(`ADI ${balBefore?.adi} → ${balAfter?.adi}  (spent ~${spent})`);
  console.log(`interventions: ${[...new Set([...claimStats.interventionsUsed, ...preauthStats.interventionsUsed])].join(', ')}`);
  console.log(`log appended: ${LOG_FILE}`);
}

main().catch((e) => {
  appendLog([`RUN FATAL  ${new Date().toISOString()}  ${e.message}`]);
  console.error(e);
  process.exit(1);
});

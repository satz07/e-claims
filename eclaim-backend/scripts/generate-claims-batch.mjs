/**
 * Bulk seed via backend POST /api/public/eclaim-contract/submit-batch
 * → Nest logs each batch (upsertClaims) so you see activity in npm run dev.
 *
 * Usage:
 *   node scripts/generate-claims-batch.mjs --claims 100 --preauths 100 --batch-size 10
 *   node scripts/generate-claims-batch.mjs --claims 5000 --preauths 5000 --batch-size 10
 *
 * Env: BACKEND_URL (default http://localhost:8001)
 * Backend wallet (OWNER_PRIVATE_KEY) signs the chain tx — watch Nest terminal for logs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_FILE = path.join(root, 'logs', 'bulk-seed-runs.log');
const POOL_FILE = path.join(root, 'logs', 'seed-registry-pool.json');

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

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8001').replace(/\/$/, '');
const EXPLORER = (
  process.env.CHAIN_EXPLORER_URL || 'https://explorer.apeiro.adifoundation.ai'
).replace(/\/$/, '');

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

const PROGRESS_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes

/** Shared counters + periodic "how many pushed" log (console + bulk-seed-runs.log). */
function createProgressReporter({ claimsTarget, preauthsTarget }) {
  const state = {
    phase: 'starting',
    claimsOk: 0,
    preauthsOk: 0,
    errors: 0,
    startedAt: Date.now(),
  };

  const emit = (label = 'PROGRESS') => {
    const elapsedMin = ((Date.now() - state.startedAt) / 60000).toFixed(1);
    const totalOk = state.claimsOk + state.preauthsOk;
    const line =
      `${label}  ${new Date().toISOString()}  elapsed=${elapsedMin}m  ` +
      `phase=${state.phase}  ` +
      `claims=${state.claimsOk}/${claimsTarget}  ` +
      `preauths=${state.preauthsOk}/${preauthsTarget}  ` +
      `pushed=${totalOk}  errors=${state.errors}`;
    console.log(`\n⏱  ${line}\n`);
    appendLog([line]);
  };

  const timer = setInterval(() => emit('PROGRESS 30m'), PROGRESS_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    setPhase(phase) {
      state.phase = phase;
    },
    addOk(use, n) {
      if (use === 'claim') state.claimsOk += n;
      else state.preauthsOk += n;
    },
    addErrors(n) {
      state.errors += n;
    },
    snapshot: emit,
    stop() {
      clearInterval(timer);
    },
  };
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
    clinicians.push({ clinicianId: `CMP-SCALE-${id}`, facilityFid: `FID-SCALE-${id}` });
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

function parseArgs(argv) {
  const out = { claims: 100, preauths: 100, batchSize: 10, ensurePool: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--claims') out.claims = Number(argv[++i]);
    else if (a === '--preauths') out.preauths = Number(argv[++i]);
    else if (a === '--batch-size') out.batchSize = Number(argv[++i]);
    else if (a === '--ensure-pool') out.ensurePool = Number(argv[++i]);
  }
  out.claims = Math.max(0, Math.min(100_000, Number(out.claims) || 0));
  out.preauths = Math.max(0, Math.min(100_000, Number(out.preauths) || 0));
  out.batchSize = Math.max(1, Math.min(50, Number(out.batchSize) || 10));
  out.ensurePool = Math.max(0, Number(out.ensurePool) || 0);
  return out;
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
        const msg = data?.message || data?.error || text.slice(0, 300);
        const err = new Error(`${res.status} ${urlPath}: ${Array.isArray(msg) ? msg.join('; ') : msg}`);
        err.status = res.status;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) throw err;
        lastErr = err;
      } else {
        return data;
      }
    } catch (err) {
      lastErr = err;
      if (err.status >= 400 && err.status < 500 && err.status !== 429) throw err;
      console.error(`  retry ${attempt}/${retries}: ${err.message}`);
      await new Promise((r) => setTimeout(r, Math.min(20_000, 800 * attempt * attempt)));
    }
  }
  throw lastErr;
}

function randomPeriod() {
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
          extension: [{ url: 'schemeCategoryCode', valueString: scheme.schemeCode }],
        },
      },
      {
        resource: {
          resourceType: 'Patient',
          id: citizen.crId,
          identifier: [{ system: 'nationalid', value: `NID-${citizen.crId}` }],
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
                coding: [{ code: intervention.code, display: intervention.display }],
              },
            },
          ],
        },
      },
    ],
  };
}

async function ensureMorePool(pool, extra) {
  if (!extra) return pool;
  const licenseFrom = '2024-01-01';
  const licenseTo = '2030-12-31';
  const startIdx =
    Math.max(
      0,
      ...pool.providers.map((p) => {
        const m = /^FID-SCALE-(\d+)$/.exec(p.providerId);
        return m ? Number(m[1]) : 0;
      }),
    ) + 1;
  console.log(`Ensuring +${extra} registry sets…`);
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
    const clinician = { clinicianId: `CMP-SCALE-${id}`, facilityFid: provider.providerId };
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
    console.log(`  + ${provider.providerId}`);
  }
  savePool(pool);
  return pool;
}

async function submitBatches(use, count, batchSize, pool, progress) {
  let ok = 0;
  let errors = 0;
  let batchesOk = 0;
  const totalBatches = Math.ceil(count / batchSize) || 0;
  progress?.setPhase(use);

  for (let b = 0; b < totalBatches; b++) {
    const start = b * batchSize;
    const end = Math.min(count, start + batchSize);
    const size = end - start;
    const bundles = [];
    for (let i = 0; i < size; i++) {
      bundles.push(
        buildBundle({
          use,
          provider: pick(pool.providers),
          citizen: pick(pool.citizens),
          scheme: pick(pool.schemes),
          intervention: pick(INTERVENTIONS),
          amount: randInt(1200, 45000),
          period: randomPeriod(),
          care: Math.random() < 0.65 ? 'ip' : 'op',
        }),
      );
    }

    try {
      const out = await api('POST', '/api/public/eclaim-contract/submit-batch', { bundles });
      const n = out.batchSize || out.items?.length || size;
      ok += n;
      batchesOk++;
      progress?.addOk(use, n);
      const tx = out.txHash || '';
      console.log(
        `  ${use} batch ${b + 1}/${totalBatches} size=${n} ` +
          `tx=${tx.slice(0, 12)}… block=${out.blockNumber || '?'} ` +
          (tx ? `${EXPLORER}/tx/${tx}` : ''),
      );
    } catch (err) {
      errors += size;
      progress?.addErrors(size);
      console.error(`  ${use} batch ${b + 1}/${totalBatches} ERR ${err.message}`);
    }
  }
  return { ok, errors, batchesOk, totalBatches };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.claims + args.preauths === 0) {
    console.error('Need --claims and/or --preauths > 0');
    process.exit(1);
  }

  let pool = loadPool();
  console.log(`Backend: ${BACKEND}`);
  console.log(`Mode:    Nest submit-batch (logs appear in npm run dev)`);
  console.log(`Batch:   ${args.batchSize} FHIR bundles per upsertClaims tx`);
  console.log(
    `Request: claims=${args.claims} preauths=${args.preauths} ` +
      `(~${Math.ceil(args.claims / args.batchSize) + Math.ceil(args.preauths / args.batchSize)} txs)`,
  );
  console.log(
    `Pool:    providers=${pool.providers.length} citizens=${pool.citizens.length} schemes=${pool.schemes.length}`,
  );

  // health check
  try {
    await api('GET', '/api/public/eclaim-contract?page=0&size=1');
  } catch (e) {
    console.error(`Backend not reachable at ${BACKEND}: ${e.message}`);
    console.error('Start: cd eclaim-backend && npm run dev');
    process.exit(1);
  }

  if (args.ensurePool > 0) {
    pool = await ensureMorePool(pool, args.ensurePool);
  }

  const start = new Date();
  appendLog([
    '',
    '════════════════════════════════════════════════════════════',
    `RUN START  ${start.toISOString()}`,
    `script     generate-claims-batch.mjs (via Nest submit-batch)`,
    `backend    ${BACKEND}`,
    `requested  claims=${args.claims} preauths=${args.preauths} batchSize=${args.batchSize}`,
    `progress   every ${PROGRESS_INTERVAL_MS / 60000} min → console + logs/bulk-seed-runs.log`,
  ]);

  const progress = createProgressReporter({
    claimsTarget: args.claims,
    preauthsTarget: args.preauths,
  });
  console.log(
    `Progress log every ${PROGRESS_INTERVAL_MS / 60000} min → console + logs/bulk-seed-runs.log`,
  );

  try {
    const claimStats = await submitBatches(
      'claim',
      args.claims,
      args.batchSize,
      pool,
      progress,
    );
    const preauthStats = await submitBatches(
      'preauthorization',
      args.preauths,
      args.batchSize,
      pool,
      progress,
    );

    const end = new Date();
    const durationSec = (end.getTime() - start.getTime()) / 1000;
    const totalOk = claimStats.ok + preauthStats.ok;
    const totalErr = claimStats.errors + preauthStats.errors;
    const totalBatches = claimStats.batchesOk + preauthStats.batchesOk;

    progress.setPhase('done');
    progress.snapshot('PROGRESS FINAL');
    progress.stop();

    appendLog([
      `RUN END    ${end.toISOString()}`,
      `durationSec  ${durationSec.toFixed(1)}`,
      `created  claims=${claimStats.ok} preauths=${preauthStats.ok} total=${totalOk} errors=${totalErr}`,
      `batchesOk  ${totalBatches}`,
      '════════════════════════════════════════════════════════════',
    ]);

    console.log('');
    console.log(
      `Done claims=${claimStats.ok} preauths=${preauthStats.ok} errors=${totalErr} ` +
        `batches=${totalBatches} in ${(durationSec / 60).toFixed(1)} min`,
    );
    console.log(`Watch Nest terminal for: submitFhirBundleBatch / upsertClaims`);
    console.log(`Refresh frontend claims list to see new rows.`);
  } catch (e) {
    progress.stop();
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  appendLog([`RUN FATAL  ${new Date().toISOString()}  ${e.message}`]);
  process.exit(1);
});

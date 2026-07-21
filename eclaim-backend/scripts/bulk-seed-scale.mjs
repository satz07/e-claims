/**
 * Scale bulk seed: extra registries + N random claims/preauths.
 * High-level run log only (no per-claim payload dump).
 *
 * Usage:
 *   node scripts/bulk-seed-scale.mjs [anchors=1000] [registries=25]
 *
 * Env: BACKEND_URL (default http://localhost:8001)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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
const LOG_FILE = path.join(root, 'logs', 'bulk-seed-runs.log');

const ANCHORS = Math.min(100_000, Math.max(1, Number(process.argv[2]) || 1000));
const REGISTRY_N = Math.min(200, Math.max(5, Number(process.argv[3]) || 25));
const SKIP_REGISTRIES = process.env.SKIP_REGISTRIES === '1' || process.argv.includes('--skip-registries');

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
];
const INTERVENTIONS = [
  { code: 'PMF-12-001', display: 'palliative care' },
  { code: 'PMF-08-010', display: 'outpatient consultation' },
  { code: 'PMF-15-002', display: 'laboratory panel' },
  { code: 'PMF-20-001', display: 'inpatient bed day' },
  { code: 'PMF-11-003', display: 'imaging study' },
];

function pad(n) {
  return String(n).padStart(3, '0');
}

function appendLog(lines) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, lines.join('\n') + '\n');
}

async function getBalance() {
  if (!OWNER_KEY) return null;
  const pk = OWNER_KEY.startsWith('0x') ? OWNER_KEY : `0x${OWNER_KEY}`;
  const w = new ethers.Wallet(pk);
  const p = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
  const bal = await p.getBalance(w.address);
  return { address: w.address, adi: ethers.formatEther(bal) };
}

async function api(method, urlPath, body, retries = 5) {
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
        // Do not retry client/business errors (already exists, validation, etc.)
        if (res.status >= 400 && res.status < 500) throw err;
        lastErr = err;
      } else {
        return data;
      }
    } catch (err) {
      lastErr = err;
      if (/^4\d\d /.test(err.message)) throw err;
      const wait = Math.min(30_000, 1000 * attempt * attempt);
      console.error(`api retry ${attempt}/${retries} after ${wait}ms:`, err.message);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const wait = Math.min(30_000, 1000 * attempt * attempt);
    console.error(`api retry ${attempt}/${retries} after ${wait}ms:`, lastErr?.message);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw lastErr;
}

function buildBundle(e, use, amount, intervention, periodOffsetDays) {
  const claimId = randomUUID();
  const bundleId = randomUUID();
  const start = new Date(Date.UTC(2025, 0, 1 + (periodOffsetDays % 300)));
  const end = new Date(start.getTime() + (1 + (periodOffsetDays % 5)) * 86400000);
  return {
    claimId,
    bundle: {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'message',
      entry: [
        {
          resource: {
            resourceType: 'Organization',
            id: e.providerId,
            name: e.providerName,
            extension: [
              {
                url: 'https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level',
                valueCodeableConcept: { coding: [{ code: e.level }] },
              },
            ],
          },
        },
        {
          resource: {
            resourceType: 'Coverage',
            extension: [{ url: 'schemeCategoryCode', valueString: e.schemeCode }],
          },
        },
        {
          resource: {
            resourceType: 'Patient',
            id: e.crId,
            identifier: [{ system: 'nationalid', value: `NID-${e.crId}` }],
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
            subType: { coding: [{ code: Math.random() < 0.7 ? 'ip' : 'op' }] },
            total: { value: amount, currency: 'KES' },
            billablePeriod: {
              start: start.toISOString(),
              end: end.toISOString(),
            },
            created: start.toISOString().slice(0, 10),
            provider: { reference: `Organization/${e.providerId}` },
            patient: { reference: `Patient/${e.crId}` },
            item: [
              {
                productOrService: {
                  coding: [
                    { code: intervention.code, display: intervention.display },
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

async function ensureRegistries(n) {
  const licenseFrom = '2024-01-01';
  const licenseTo = '2030-12-31';
  const entities = [];
  let created = { provider: 0, citizen: 0, insurer: 0, clinician: 0, skipped: 0 };

  for (let i = 1; i <= n; i++) {
    const id = pad(i);
    const e =
      i === 1
        ? {
            providerId: 'FID-35-108719-7',
            providerName: 'ST. LEONARDS HOSPITAL',
            level: 'LEVEL 4',
            county: 'NAIROBI',
            crId: 'CR3248022528592-4',
            schemeCode: 'CAT-SHA-001',
            clinicianId: 'CMP-DEMO-001',
          }
        : {
            providerId: `FID-SCALE-${id}`,
            providerName: `SCALE HOSPITAL ${id}`,
            level: LEVELS[(i - 1) % LEVELS.length],
            county: COUNTIES[(i - 1) % COUNTIES.length],
            crId: `CR-SCALE-${id}`,
            schemeCode: `CAT-SCALE-${id}`,
            clinicianId: `CMP-SCALE-${id}`,
          };
    entities.push(e);

    try {
      await api('POST', '/api/public/provider-registry/register', {
        providerId: e.providerId,
        name: e.providerName,
        level: e.level,
        county: e.county,
        facilityType: 'hospital',
        licenseValidFrom: licenseFrom,
        licenseValidTo: licenseTo,
      });
      created.provider++;
    } catch {
      created.skipped++;
    }

    try {
      await api('POST', '/api/public/citizen-registry/register', {
        id: e.crId,
        meta: '',
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
      created.citizen++;
    } catch {
      created.skipped++;
    }

    try {
      await api('POST', '/api/public/insurer-registry/register', {
        id: e.schemeCode,
        meta: '',
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
      created.insurer++;
    } catch {
      created.skipped++;
    }

    try {
      await api('POST', '/api/public/clinician-registry/register', {
        id: e.clinicianId,
        meta: e.providerId,
        validFrom: licenseFrom,
        validTo: licenseTo,
      });
      created.clinician++;
    } catch {
      created.skipped++;
    }
  }

  return { entities, created };
}

async function main() {
  const start = new Date();
  const balBefore = await getBalance();

  appendLog([
    '',
    '════════════════════════════════════════════════════════════',
    `RUN START  ${start.toISOString()}`,
    `backend    ${BACKEND}`,
    `rpc        ${RPC}`,
    `anchors    ${ANCHORS}`,
    `registries ${SKIP_REGISTRIES ? 'SKIPPED (reuse existing)' : `${REGISTRY_N} of each (provider/citizen/insurer/clinician)`}`,
    `wallet     ${balBefore?.address || 'n/a'}`,
    `balanceBefore  ${balBefore?.adi ?? 'n/a'} ADI`,
  ]);

  let entities;
  if (SKIP_REGISTRIES) {
    entities = Array.from({ length: REGISTRY_N }, (_, i) => {
      const id = pad(i + 1);
      if (i === 0) {
        return {
          providerId: 'FID-35-108719-7',
          providerName: 'ST. LEONARDS HOSPITAL',
          level: 'LEVEL 4',
          crId: 'CR3248022528592-4',
          schemeCode: 'CAT-SHA-001',
        };
      }
      return {
        providerId: `FID-SCALE-${id}`,
        providerName: `SCALE HOSPITAL ${id}`,
        level: LEVELS[i % LEVELS.length],
        crId: `CR-SCALE-${id}`,
        schemeCode: `CAT-SCALE-${id}`,
      };
    });
    appendLog(['registriesCreated  skipped=true']);
    console.log('Skipping registry create; using existing scale IDs.');
  } else {
    console.log(`Ensuring ${REGISTRY_N} registries…`);
    const out = await ensureRegistries(REGISTRY_N);
    entities = out.entities;
    appendLog([
      `registriesCreated  provider=${out.created.provider} citizen=${out.created.citizen} insurer=${out.created.insurer} clinician=${out.created.clinician} skippedOrExists~=${out.created.skipped}`,
    ]);
    console.log('Registries done:', out.created);
  }

  let claimOk = 0;
  let preauthOk = 0;
  let errors = 0;
  const t0 = Date.now();

  console.log(`Submitting ${ANCHORS} random claims/preauths…`);
  for (let i = 0; i < ANCHORS; i++) {
    const e = entities[Math.floor(Math.random() * entities.length)];
    const use = Math.random() < 0.5 ? 'claim' : 'preauthorization';
    const amount = 1500 + Math.floor(Math.random() * 25000);
    const intervention = INTERVENTIONS[Math.floor(Math.random() * INTERVENTIONS.length)];
    const { bundle } = buildBundle(e, use, amount, intervention, i);

    try {
      await api('POST', '/api/public/eclaim-contract/submit', bundle);
      if (use === 'claim') claimOk++;
      else preauthOk++;
    } catch (err) {
      errors++;
      if (errors <= 5 || errors % 50 === 0) {
        console.error(`[${i + 1}/${ANCHORS}] error:`, err.message);
      }
    }

    if ((i + 1) % 50 === 0 || i + 1 === ANCHORS) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `progress ${i + 1}/${ANCHORS}  claims=${claimOk} preauth=${preauthOk} err=${errors}  ${elapsed}s`,
      );
      appendLog([
        `progress  ${i + 1}/${ANCHORS}  claimsOk=${claimOk} preauthsOk=${preauthOk} errors=${errors}  elapsedSec=${elapsed}`,
      ]);
    }
  }

  const end = new Date();
  const balAfter = await getBalance();
  const durationSec = (end.getTime() - start.getTime()) / 1000;
  const spent =
    balBefore && balAfter
      ? (Number(balBefore.adi) - Number(balAfter.adi)).toFixed(6)
      : 'n/a';

  appendLog([
    `RUN END    ${end.toISOString()}`,
    `durationSec  ${durationSec.toFixed(1)}`,
    `durationHuman  ${(durationSec / 60).toFixed(1)} min`,
    `created  claims=${claimOk} preauths=${preauthOk} total=${claimOk + preauthOk} errors=${errors}`,
    `balanceAfter   ${balAfter?.adi ?? 'n/a'} ADI`,
    `tokensSpentApprox  ${spent} ADI`,
    '════════════════════════════════════════════════════════════',
  ]);

  console.log('\nDone.');
  console.log(`claims=${claimOk} preauths=${preauthOk} errors=${errors}`);
  console.log(`duration ${(durationSec / 60).toFixed(1)} min`);
  console.log(`ADI before ${balBefore?.adi} → after ${balAfter?.adi} (spent ~${spent})`);
  console.log(`log: ${LOG_FILE}`);
}

main().catch((e) => {
  appendLog([`RUN FATAL  ${new Date().toISOString()}  ${e.message}`]);
  console.error(e);
  process.exit(1);
});

/**
 * Seed on-chain from a dump file produced by export-db-sample.mjs (no DB).
 *
 * Usage:
 *   node scripts/seed-from-dump.mjs --file dumps/qa-sample.jsonl --limit 50 --no-wait
 *   node scripts/seed-from-dump.mjs --file dumps/qa-sample.jsonl --offset 0 --limit 20 --wait
 *
 * Env:
 *   BACKEND_URL (default http://localhost:8001)
 *   No CLAIM_DB_* required.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_DIR = path.join(root, 'logs');
const RECORD_LOG = path.join(LOG_DIR, 'dump-seed-records.log');
const RUN_LOG = path.join(LOG_DIR, 'dump-seed-runs.log');

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
const LICENSE_FROM = '2020-01-01';
const LICENSE_TO = '2035-12-31';

function appendLines(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, lines.join('\n') + '\n');
}

function parseArgs(argv) {
  const out = {
    file: null,
    limit: 50,
    offset: 0,
    noWait: true,
    ensureRegistries: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = path.resolve(argv[++i]);
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--offset') out.offset = Number(argv[++i]);
    else if (a === '--no-wait') out.noWait = true;
    else if (a === '--wait') out.noWait = false;
    else if (a === '--skip-ensure-registries') out.ensureRegistries = false;
  }
  out.limit = Math.max(1, Math.min(5_000, Number(out.limit) || 50));
  out.offset = Math.max(0, Number(out.offset) || 0);
  if (!out.file) {
    throw new Error('Usage: node scripts/seed-from-dump.mjs --file dumps/qa-sample.jsonl');
  }
  return out;
}

function errMsg(data, text) {
  const m = data?.message ?? data?.error ?? text?.slice(0, 300);
  return Array.isArray(m) ? m.join('; ') : String(m || 'unknown error');
}

async function api(method, urlPath, body, retries = 3) {
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
        const err = new Error(`${res.status} ${urlPath}: ${errMsg(data, text)}`);
        err.status = res.status;
        err.body = data;
        if (res.status >= 400 && res.status < 500) throw err;
        lastErr = err;
      } else {
        return data;
      }
    } catch (err) {
      lastErr = err;
      if (err.status >= 400 && err.status < 500) throw err;
      const wait = Math.min(15_000, 600 * attempt * attempt);
      console.error(`  retry ${attempt}/${retries}: ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function normalizeLevel(level) {
  if (!level) return 'LEVEL 4';
  const s = String(level).trim().toUpperCase().replace(/\s+/g, ' ');
  if (/^LEVEL\s*[2-6]$/.test(s)) return s.replace(/LEVEL\s*/, 'LEVEL ');
  const m = s.match(/([2-6])/);
  return m ? `LEVEL ${m[1]}` : 'LEVEL 4';
}

function normalizeUse(use) {
  const u = String(use || '').toLowerCase();
  if (u === 'claim') return 'claim';
  if (u === 'preauthorization' || u === 'preauth') return 'preauthorization';
  return null;
}

function toIso(v) {
  if (!v) return new Date().toISOString();
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function toDateOnly(v) {
  return toIso(v).slice(0, 10);
}

function buildBundle(row) {
  const use = normalizeUse(row.use);
  const fid = row.fid_code;
  const crId = row.cr_id;
  const scheme = row.scheme_code || 'SHIF';
  const level = normalizeLevel(row.facility_level);
  const amount = Number(row.claimed_total) || 0;
  const care = row.is_ips_claim ? 'ip' : 'op';
  const interventionCode = row.intervention_code || 'SHA-00-000';
  const interventionName = row.intervention_name || interventionCode;
  const nationalId = row.national_id || `NID-${crId}`;
  const claimId = row.claim_id;
  const bundleId = row.bundle_id || claimId;

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'message',
    entry: [
      {
        resource: {
          resourceType: 'Organization',
          id: fid,
          name: row.provider_name || fid,
          extension: [
            {
              url: 'https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level',
              valueCodeableConcept: { coding: [{ code: level }] },
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'Coverage',
          extension: [{ url: 'schemeCategoryCode', valueString: scheme }],
        },
      },
      {
        resource: {
          resourceType: 'Patient',
          id: crId,
          identifier: [{ system: 'nationalid', value: nationalId }],
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
          type: { coding: [{ code: row.claim_type || 'institutional' }] },
          subType: { coding: [{ code: care }] },
          total: { value: amount, currency: 'KES' },
          billablePeriod: {
            start: toIso(row.date_from),
            end: toIso(row.date_to),
          },
          created: toDateOnly(row.created_date),
          provider: { reference: `Organization/${fid}` },
          patient: { reference: `Patient/${crId}` },
          item: [
            {
              productOrService: {
                coding: [{ code: interventionCode, display: interventionName }],
              },
            },
          ],
        },
      },
    ],
  };
}

function loadRows(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line));
  }
  return rows;
}

async function registerProvider(row, cache) {
  const fid = row.fid_code;
  if (!fid || cache.providers[fid]) return;
  try {
    await api('POST', '/api/public/provider-registry/register', {
      providerId: fid,
      name: row.provider_name || fid,
      level: normalizeLevel(row.facility_level || row.provider_level),
      county: row.county || 'UNKNOWN',
      facilityType: 'hospital',
      licenseValidFrom: LICENSE_FROM,
      licenseValidTo: LICENSE_TO,
    });
    console.log(`  + provider ${fid}`);
  } catch (err) {
    if (!/Already active|already/i.test(err.message)) throw err;
  }
  cache.providers[fid] = true;
}

async function registerScheme(scheme, cache) {
  if (!scheme || cache.schemes[scheme]) return;
  try {
    await api('POST', '/api/public/insurer-registry/register', {
      id: scheme,
      meta: '',
      validFrom: LICENSE_FROM,
      validTo: LICENSE_TO,
    });
    console.log(`  + scheme ${scheme}`);
  } catch (err) {
    if (!/Already active|already/i.test(err.message)) throw err;
  }
  cache.schemes[scheme] = true;
}

async function registerCitizen(crId, cache) {
  if (!crId || cache.citizens[crId]) return;
  try {
    const out = await api('POST', '/api/public/citizen-registry/register', {
      id: crId,
      meta: '',
      validFrom: LICENSE_FROM,
      validTo: LICENSE_TO,
    });
    if (out?.alreadyRegistered) console.log(`  = citizen ${crId} (already on-chain)`);
    else console.log(`  + citizen ${crId}`);
  } catch (err) {
    if (!/Already active|already/i.test(err.message)) throw err;
    console.log(`  = citizen ${crId} (already on-chain)`);
  }
  cache.citizens[crId] = true;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!fs.existsSync(args.file)) {
    console.error(`File not found: ${args.file}`);
    process.exit(1);
  }

  const all = loadRows(args.file);
  const slice = all.slice(args.offset, args.offset + args.limit);
  console.log(`Backend: ${BACKEND}`);
  console.log(`File:    ${args.file} (${all.length} rows)`);
  console.log(`Slice:   offset=${args.offset} limit=${args.limit} → ${slice.length} row(s)`);

  if (!slice.length) {
    console.log('Nothing to import.');
    return;
  }

  const cache = { providers: {}, schemes: {}, citizens: {} };
  const submitPath = args.noWait
    ? '/api/public/eclaim-contract/submit?wait=false'
    : '/api/public/eclaim-contract/submit';

  if (args.ensureRegistries) {
    const schemes = [...new Set(slice.map((r) => r.scheme_code).filter(Boolean))];
    const providers = new Map();
    for (const r of slice) {
      if (r.fid_code && !providers.has(r.fid_code)) providers.set(r.fid_code, r);
    }
    console.log(`Ensuring registries: schemes=${schemes.length} providers=${providers.size}`);
    for (const s of schemes) {
      try {
        await registerScheme(s, cache);
      } catch (e) {
        console.error(`  scheme ${s}: ${e.message}`);
      }
    }
    for (const row of providers.values()) {
      try {
        await registerProvider(row, cache);
      } catch (e) {
        console.error(`  provider ${row.fid_code}: ${e.message}`);
      }
    }
  }

  let ok = 0;
  let dup = 0;
  let errors = 0;
  const start = new Date();
  appendLines(RUN_LOG, [
    '',
    `RUN START ${start.toISOString()} file=${args.file} offset=${args.offset} limit=${args.limit}`,
  ]);

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    const use = normalizeUse(row.use);
    const ts = new Date().toISOString();
    const label = `[${i + 1}/${slice.length}] #${row.claim_number} ${use} ${row.claim_id}`;

    if (!use || !row.fid_code || !row.cr_id || !(Number(row.claimed_total) > 0)) {
      errors++;
      console.error(`  ${label} SKIP missing fields / zero amount`);
      continue;
    }

    try {
      await registerCitizen(row.cr_id, cache);
    } catch (err) {
      console.error(`  citizen ${row.cr_id}: ${err.message}`);
    }

    try {
      const out = await api('POST', submitPath, buildBundle(row));
      ok++;
      appendLines(RECORD_LOG, [
        `${ts} OK claim_id=${row.claim_id} claim_number=${row.claim_number} use=${use} tx=${out.txHash || ''} onChain#=${out.claimNumber || ''}`,
      ]);
      console.log(`  ${label} OK tx=${(out.txHash || '').slice(0, 12)}…`);
    } catch (err) {
      const msg = err.message || '';
      if (/already anchored|Already active|duplicate/i.test(msg)) {
        dup++;
        appendLines(RECORD_LOG, [
          `${ts} DUP claim_id=${row.claim_id} claim_number=${row.claim_number}`,
        ]);
        console.log(`  ${label} DUP`);
      } else {
        errors++;
        appendLines(RECORD_LOG, [
          `${ts} ERR claim_id=${row.claim_id} claim_number=${row.claim_number} error=${msg}`,
        ]);
        console.error(`  ${label} ERR ${msg}`);
      }
    }
  }

  console.log('');
  console.log(`Done ok=${ok} dup=${dup} errors=${errors}`);
  console.log(`Records: ${RECORD_LOG}`);
  appendLines(RUN_LOG, [
    `RUN END ${new Date().toISOString()} ok=${ok} dup=${dup} errors=${errors}`,
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

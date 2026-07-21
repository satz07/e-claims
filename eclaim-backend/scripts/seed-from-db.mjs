/**
 * Batch-import real claims/preauths from e-claim Postgres → on-chain.
 *
 * Resume files:
 *   logs/db-seed-progress.json   — lastClaimNumber / import totals (ONLY updated by --limit)
 *   logs/db-seed-registries.json — providers/schemes/citizens cache (--register-only safe)
 *   logs/db-seed-cursor.json     — combined snapshot for humans (rebuilt on save)
 * Run log:       logs/db-seed-runs.log
 * Record log:    logs/db-seed-records.log  (one line per claim)
 *
 * Usage:
 *   # 1) Register schemes + providers once (recommended first)
 *   node scripts/seed-from-db.mjs --register-only
 *
 *   # 2) Import next N unimported rows (claims + preauths by default)
 *   node scripts/seed-from-db.mjs --limit 50 --no-wait
 *   node scripts/seed-from-db.mjs --limit 100 --use claim --no-wait
 *   node scripts/seed-from-db.mjs --limit 1000 --use both --no-wait
 *
 *   # Status / resume info
 *   node scripts/seed-from-db.mjs --status
 *
 *   # Rebuild lastClaimNumber from logs/db-seed-records.log (keeps registries)
 *   node scripts/seed-from-db.mjs --rebuild-cursor
 *
 *   # Start over (does NOT undo on-chain data) — clears progress + registry cache in cursor
 *   node scripts/seed-from-db.mjs --reset-cursor
 *
 * Env (.env):
 *   CLAIM_DB_HOST, CLAIM_DB_PORT, CLAIM_DB_USER, CLAIM_DB_PASSWORD, CLAIM_DB_NAME
 *   BACKEND_URL (default http://localhost:8001)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const CURSOR_FILE = path.join(root, 'logs', 'db-seed-cursor.json');
const PROGRESS_FILE = path.join(root, 'logs', 'db-seed-progress.json');
const REGISTRY_FILE = path.join(root, 'logs', 'db-seed-registries.json');
const RUN_LOG = path.join(root, 'logs', 'db-seed-runs.log');
const RECORD_LOG = path.join(root, 'logs', 'db-seed-records.log');

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

const LICENSE_FROM = '2020-01-01';
const LICENSE_TO = '2035-12-31';

function appendLines(file, lines) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, lines.join('\n') + '\n');
}

function defaultProgress() {
  return {
    lastClaimNumber: 0,
    lastClaimId: null,
    lastBundleId: null,
    lastImportedAt: null,
    totals: {
      claimsOk: 0,
      preauthsOk: 0,
      errors: 0,
      skipped: 0,
    },
  };
}

function defaultRegistries() {
  return {
    providers: {},
    schemes: {},
    citizens: {},
  };
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback();
  try {
    return { ...fallback(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return fallback();
  }
}

function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function deepMergeRegistered(a = {}, b = {}) {
  return {
    providers: { ...(a.providers || {}), ...(b.providers || {}) },
    schemes: { ...(a.schemes || {}), ...(b.schemes || {}) },
    citizens: { ...(a.citizens || {}), ...(b.citizens || {}) },
  };
}

/** Migrate old single cursor file into progress + registries once. */
function migrateLegacyCursorIfNeeded() {
  if (!fs.existsSync(CURSOR_FILE)) return;
  if (fs.existsSync(PROGRESS_FILE) && fs.existsSync(REGISTRY_FILE)) return;
  try {
    const legacy = JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8'));
    if (!fs.existsSync(PROGRESS_FILE)) {
      writeJsonAtomic(PROGRESS_FILE, {
        lastClaimNumber: Number(legacy.lastClaimNumber) || 0,
        lastClaimId: legacy.lastClaimId ?? null,
        lastBundleId: legacy.lastBundleId ?? null,
        lastImportedAt: legacy.lastImportedAt ?? null,
        totals: {
          claimsOk: legacy.totals?.claimsOk || 0,
          preauthsOk: legacy.totals?.preauthsOk || 0,
          errors: legacy.totals?.errors || 0,
          skipped: legacy.totals?.skipped || 0,
        },
      });
    }
    if (!fs.existsSync(REGISTRY_FILE)) {
      writeJsonAtomic(
        REGISTRY_FILE,
        deepMergeRegistered(defaultRegistries(), legacy.registered || {}),
      );
    }
  } catch {
    /* ignore */
  }
}

function loadProgress() {
  migrateLegacyCursorIfNeeded();
  const p = readJson(PROGRESS_FILE, defaultProgress);
  p.totals = { ...defaultProgress().totals, ...(p.totals || {}) };
  p.lastClaimNumber = Number(p.lastClaimNumber) || 0;
  return p;
}

function loadRegistries() {
  migrateLegacyCursorIfNeeded();
  return deepMergeRegistered(defaultRegistries(), readJson(REGISTRY_FILE, defaultRegistries));
}

function loadCursor() {
  const progress = loadProgress();
  const registered = loadRegistries();
  return {
    lastClaimNumber: progress.lastClaimNumber,
    lastClaimId: progress.lastClaimId,
    lastBundleId: progress.lastBundleId,
    lastImportedAt: progress.lastImportedAt,
    totals: {
      ...progress.totals,
      providersRegistered: Object.keys(registered.providers).length,
      schemesRegistered: Object.keys(registered.schemes).length,
      citizensRegistered: Object.keys(registered.citizens).length,
    },
    registered,
  };
}

function saveRegistries(registered) {
  const merged = deepMergeRegistered(loadRegistries(), registered || {});
  writeJsonAtomic(REGISTRY_FILE, merged);
  return merged;
}

function saveProgress(progress, { forceReset = false } = {}) {
  const disk = loadProgress();
  if (forceReset) {
    writeJsonAtomic(PROGRESS_FILE, progress);
    return progress;
  }
  const memNum = Number(progress.lastClaimNumber) || 0;
  const diskNum = Number(disk.lastClaimNumber) || 0;
  const useMem = memNum >= diskNum;
  const merged = {
    lastClaimNumber: Math.max(memNum, diskNum),
    lastClaimId: useMem ? progress.lastClaimId ?? disk.lastClaimId : disk.lastClaimId,
    lastBundleId: useMem ? progress.lastBundleId ?? disk.lastBundleId : disk.lastBundleId,
    lastImportedAt: useMem
      ? progress.lastImportedAt ?? disk.lastImportedAt
      : disk.lastImportedAt,
    totals: {
      claimsOk: Math.max(disk.totals.claimsOk || 0, progress.totals?.claimsOk || 0),
      preauthsOk: Math.max(disk.totals.preauthsOk || 0, progress.totals?.preauthsOk || 0),
      errors: Math.max(disk.totals.errors || 0, progress.totals?.errors || 0),
      skipped: Math.max(disk.totals.skipped || 0, progress.totals?.skipped || 0),
    },
  };
  if (!useMem) {
    merged.totals = { ...disk.totals };
  }
  writeJsonAtomic(PROGRESS_FILE, merged);
  return merged;
}

/**
 * Persist cursor. Register-only must pass { registriesOnly: true }
 * so import progress can never be wiped.
 */
function saveCursor(cursor, { forceReset = false, registriesOnly = false } = {}) {
  const registered = saveRegistries(cursor.registered);

  if (!registriesOnly) {
    const progress = saveProgress(
      {
        lastClaimNumber: cursor.lastClaimNumber,
        lastClaimId: cursor.lastClaimId,
        lastBundleId: cursor.lastBundleId,
        lastImportedAt: cursor.lastImportedAt,
        totals: {
          claimsOk: cursor.totals?.claimsOk || 0,
          preauthsOk: cursor.totals?.preauthsOk || 0,
          errors: cursor.totals?.errors || 0,
          skipped: cursor.totals?.skipped || 0,
        },
      },
      { forceReset },
    );
    Object.assign(cursor, progress);
    cursor.totals = {
      ...progress.totals,
      providersRegistered: Object.keys(registered.providers).length,
      schemesRegistered: Object.keys(registered.schemes).length,
      citizensRegistered: Object.keys(registered.citizens).length,
    };
  } else {
    // Keep in-memory progress fields from disk so UI object stays accurate
    const progress = loadProgress();
    cursor.lastClaimNumber = progress.lastClaimNumber;
    cursor.lastClaimId = progress.lastClaimId;
    cursor.lastBundleId = progress.lastBundleId;
    cursor.lastImportedAt = progress.lastImportedAt;
    cursor.totals = {
      ...progress.totals,
      providersRegistered: Object.keys(registered.providers).length,
      schemesRegistered: Object.keys(registered.schemes).length,
      citizensRegistered: Object.keys(registered.citizens).length,
    };
  }

  cursor.registered = registered;

  // Human-readable combined snapshot (never the source of truth alone)
  writeJsonAtomic(CURSOR_FILE, {
    lastClaimNumber: cursor.lastClaimNumber,
    lastClaimId: cursor.lastClaimId,
    lastBundleId: cursor.lastBundleId,
    lastImportedAt: cursor.lastImportedAt,
    totals: cursor.totals,
    registered: cursor.registered,
  });

  return cursor;
}

/** Rebuild progress from db-seed-records.log (does not clear registries). */
function rebuildCursorFromRecords() {
  const cursor = loadCursor();
  if (!fs.existsSync(RECORD_LOG)) {
    console.log('No record log yet — nothing to rebuild.');
    return cursor;
  }

  let claimsOk = 0;
  let preauthsOk = 0;
  let errors = 0;
  let skipped = 0;
  let last = {
    claimNumber: 0,
    claimId: null,
    bundleId: null,
    at: null,
  };

  for (const line of fs.readFileSync(RECORD_LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const numM = /claim_number=(\d+)/.exec(line);
    const idM = /claim_id=([^\s]+)/.exec(line);
    const tsM = /^(\S+)/.exec(line);
    const useM = /use=(\w+)/.exec(line);
    if (!numM) continue;
    const n = Number(numM[1]);
    if (n >= last.claimNumber) {
      last = {
        claimNumber: n,
        claimId: idM?.[1] || last.claimId,
        bundleId: last.bundleId,
        at: tsM?.[1] || last.at,
      };
    }
    if (line.includes(' OK ') || line.includes(' DUP ')) {
      if (useM?.[1] === 'preauthorization') preauthsOk++;
      else claimsOk++;
      const crM = /cr=([^\s]+)/.exec(line);
      const fidM = /fid=([^\s]+)/.exec(line);
      const schemeM = /scheme=([^\s]+)/.exec(line);
      if (crM) cursor.registered.citizens[crM[1]] = true;
      if (fidM) cursor.registered.providers[fidM[1]] = true;
      if (schemeM) cursor.registered.schemes[schemeM[1]] = true;
    } else if (line.includes(' ERR ')) errors++;
    else if (line.includes(' SKIP ')) skipped++;
  }

  cursor.lastClaimNumber = last.claimNumber;
  cursor.lastClaimId = last.claimId || null;
  cursor.lastImportedAt = last.at || null;
  cursor.totals.claimsOk = claimsOk;
  cursor.totals.preauthsOk = preauthsOk;
  cursor.totals.errors = errors;
  cursor.totals.skipped = skipped;
  return saveCursor(cursor, { forceReset: true });
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

async function getBalance() {
  if (!OWNER_KEY) return null;
  const pk = OWNER_KEY.startsWith('0x') ? OWNER_KEY : `0x${OWNER_KEY}`;
  const w = new ethers.Wallet(pk);
  const p = new ethers.JsonRpcProvider(RPC, 37001, { staticNetwork: true });
  const bal = await p.getBalance(w.address);
  return { address: w.address, adi: ethers.formatEther(bal) };
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

async function registerProvider(cursor, row) {
  const fid = row.fid_code;
  if (!fid || cursor.registered.providers[fid]) return false;
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
    cursor.registered.providers[fid] = true;
    cursor.totals.providersRegistered++;
    console.log(`  + provider ${fid}`);
    return true;
  } catch (err) {
    if (/Already active|already/i.test(err.message)) {
      cursor.registered.providers[fid] = true;
      return false;
    }
    throw err;
  }
}

async function registerScheme(cursor, scheme) {
  if (!scheme || cursor.registered.schemes[scheme]) return false;
  try {
    await api('POST', '/api/public/insurer-registry/register', {
      id: scheme,
      meta: '',
      validFrom: LICENSE_FROM,
      validTo: LICENSE_TO,
    });
    cursor.registered.schemes[scheme] = true;
    cursor.totals.schemesRegistered++;
    console.log(`  + scheme ${scheme}`);
    return true;
  } catch (err) {
    if (/Already active|already/i.test(err.message)) {
      cursor.registered.schemes[scheme] = true;
      return false;
    }
    throw err;
  }
}

async function registerCitizen(cursor, crId) {
  if (!crId || cursor.registered.citizens[crId]) return false;
  try {
    await api('POST', '/api/public/citizen-registry/register', {
      id: crId,
      meta: '',
      validFrom: LICENSE_FROM,
      validTo: LICENSE_TO,
    });
    cursor.registered.citizens[crId] = true;
    cursor.totals.citizensRegistered++;
    console.log(`  + citizen ${crId}`);
    return true;
  } catch (err) {
    if (/Already active|already/i.test(err.message)) {
      cursor.registered.citizens[crId] = true;
      return false;
    }
    throw err;
  }
}

async function ensureLazyCitizen(cursor, crId, errMessage) {
  if (!/Citizen CR|not registered|not authorized/i.test(errMessage)) return false;
  await registerCitizen(cursor, crId);
  return true;
}

async function ensureLazyProvider(cursor, row, errMessage) {
  if (!/Facility|Provider|not registered|not authorized/i.test(errMessage)) return false;
  await registerProvider(cursor, row);
  return true;
}

async function ensureLazyScheme(cursor, scheme, errMessage) {
  if (!/Scheme|not registered|not authorized/i.test(errMessage)) return false;
  await registerScheme(cursor, scheme);
  return true;
}

function parseArgs(argv) {
  const out = {
    limit: 50,
    use: 'both', // claim | preauthorization | both
    noWait: true,
    registerOnly: false,
    status: false,
    resetCursor: false,
    rebuildCursor: false,
    ensureRegistries: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--use') out.use = String(argv[++i]).toLowerCase();
    else if (a === '--no-wait') out.noWait = true;
    else if (a === '--wait') out.noWait = false;
    else if (a === '--register-only') out.registerOnly = true;
    else if (a === '--status') out.status = true;
    else if (a === '--reset-cursor') out.resetCursor = true;
    else if (a === '--rebuild-cursor') out.rebuildCursor = true;
    else if (a === '--skip-ensure-registries') out.ensureRegistries = false;
  }
  out.limit = Math.max(1, Math.min(10_000, Number(out.limit) || 50));
  if (!['claim', 'preauthorization', 'both', 'preauth'].includes(out.use)) {
    out.use = 'both';
  }
  if (out.use === 'preauth') out.use = 'preauthorization';
  return out;
}

function useFilterSql(use) {
  if (use === 'claim') return `AND c.use = 'Claim'`;
  if (use === 'preauthorization') return `AND c.use = 'Preauthorization'`;
  return `AND c.use IN ('Claim', 'Preauthorization')`;
}

async function fetchBatch(client, afterClaimNumber, limit, use) {
  const sql = `
    SELECT
      c.claim_number,
      c.claim_id::text AS claim_id,
      c.bundle_id,
      c.use,
      c.claim_type,
      c.claimed_total,
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
      AND pr.fid_code IS NOT NULL AND pr.fid_code <> ''
      AND p.cr_id IS NOT NULL AND p.cr_id <> ''
      ${useFilterSql(use)}
    ORDER BY c.claim_number ASC
    LIMIT $2
  `;
  const { rows } = await client.query(sql, [afterClaimNumber, limit]);
  return rows;
}

async function fetchRegistrySeeds(client) {
  const providers = (
    await client.query(`
      SELECT DISTINCT ON (pr.fid_code)
        pr.fid_code, pr.name AS provider_name, pr.level AS provider_level,
        pr.county, pr.level AS facility_level
      FROM provider pr
      JOIN claims c ON c.provider = pr.id
      WHERE pr.fid_code IS NOT NULL AND pr.fid_code <> ''
      ORDER BY pr.fid_code, pr.id
    `)
  ).rows;

  const schemes = (
    await client.query(`
      SELECT DISTINCT coverage_type AS scheme_code
      FROM claim_attributes
      WHERE status = 'ACTIVE'
        AND coverage_type IS NOT NULL AND coverage_type <> ''
      ORDER BY 1
    `)
  ).rows.map((r) => r.scheme_code);

  return { providers, schemes };
}

async function printStatus(client, cursor) {
  const remaining = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE c.use = 'Claim') AS claims_left,
      COUNT(*) FILTER (WHERE c.use = 'Preauthorization') AS preauths_left,
      COUNT(*) AS total_left,
      MIN(c.claim_number) AS next_claim_number,
      MAX(c.claim_number) AS max_claim_number
    FROM claims c
    JOIN provider pr ON pr.id = c.provider
    JOIN patient p ON p.id = c.patient
    WHERE c.claim_number > $1
      AND pr.fid_code IS NOT NULL AND pr.fid_code <> ''
      AND c.use IN ('Claim', 'Preauthorization')
  `, [cursor.lastClaimNumber]);

  const r = remaining.rows[0];
  console.log('── DB → on-chain import status ──');
  console.log(`cursor file:     ${CURSOR_FILE}`);
  console.log(`lastClaimNumber: ${cursor.lastClaimNumber}`);
  console.log(`lastClaimId:     ${cursor.lastClaimId || '—'}`);
  console.log(`lastImportedAt:  ${cursor.lastImportedAt || '—'}`);
  console.log(`totals ok:       claims=${cursor.totals.claimsOk} preauths=${cursor.totals.preauthsOk} errors=${cursor.totals.errors}`);
  console.log(`registries:      providers=${Object.keys(cursor.registered.providers).length} schemes=${Object.keys(cursor.registered.schemes).length} citizens=${Object.keys(cursor.registered.citizens).length}`);
  console.log(`remaining:       claims=${r.claims_left} preauths=${r.preauths_left} total=${r.total_left}`);
  console.log(`next claim#:     ${r.next_claim_number ?? 'done'}`);
}

async function registerOnly(client, cursor) {
  console.log('Fetching distinct providers + schemes…');
  const { providers, schemes } = await fetchRegistrySeeds(client);
  console.log(`Found providers=${providers.length} schemes=${schemes.length}`);

  for (const scheme of schemes) {
    try {
      await registerScheme(cursor, scheme);
    } catch (err) {
      console.error(`  scheme fail ${scheme}: ${err.message}`);
    }
    saveCursor(cursor, { registriesOnly: true });
  }

  for (const row of providers) {
    try {
      await registerProvider(cursor, row);
    } catch (err) {
      console.error(`  provider fail ${row.fid_code}: ${err.message}`);
    }
    saveCursor(cursor, { registriesOnly: true });
  }

  console.log(
    `Done register-only. schemes=${Object.keys(cursor.registered.schemes).length} providers=${Object.keys(cursor.registered.providers).length}`,
  );
}

async function importBatch(client, cursor, args) {
  const submitPath = args.noWait
    ? '/api/public/eclaim-contract/submit?wait=false'
    : '/api/public/eclaim-contract/submit';

  const rows = await fetchBatch(client, cursor.lastClaimNumber, args.limit, args.use);
  console.log(
    `Fetched ${rows.length} row(s) after claim_number=${cursor.lastClaimNumber} use=${args.use}`,
  );
  if (rows.length === 0) {
    console.log('Nothing left to import for this filter.');
    return;
  }

  if (args.ensureRegistries) {
    const schemes = [...new Set(rows.map((r) => r.scheme_code).filter(Boolean))];
    const providers = new Map();
    for (const r of rows) {
      if (r.fid_code && !providers.has(r.fid_code)) providers.set(r.fid_code, r);
    }
    console.log(`Ensuring registries for batch: schemes=${schemes.length} providers=${providers.size} (citizens=lazy)`);
    for (const s of schemes) {
      try {
        await registerScheme(cursor, s);
      } catch (err) {
        console.error(`  scheme ${s}: ${err.message}`);
      }
    }
    for (const row of providers.values()) {
      try {
        await registerProvider(cursor, row);
      } catch (err) {
        console.error(`  provider ${row.fid_code}: ${err.message}`);
      }
    }
    saveCursor(cursor);
  }

  const start = new Date();
  const balBefore = await getBalance();
  appendLines(RUN_LOG, [
    '',
    '════════════════════════════════════════════════════════════',
    `RUN START  ${start.toISOString()}`,
    `script     seed-from-db.mjs`,
    `backend    ${BACKEND}`,
    `limit      ${args.limit}`,
    `use        ${args.use}`,
    `noWait     ${args.noWait}`,
    `cursorFrom ${cursor.lastClaimNumber}`,
    `batchFirst ${rows[0].claim_number} ${rows[0].claim_id}`,
    `batchLast  ${rows[rows.length - 1].claim_number} ${rows[rows.length - 1].claim_id}`,
    `wallet     ${balBefore?.address || 'n/a'}`,
    `balanceBefore  ${balBefore?.adi ?? 'n/a'} ADI`,
  ]);

  let ok = 0;
  let errors = 0;
  let claimsOk = 0;
  let preauthsOk = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const use = normalizeUse(row.use);
    const ts = new Date().toISOString();
    const label = `[${i + 1}/${rows.length}] #${row.claim_number} ${use} ${row.claim_id}`;

    if (!use || !row.fid_code || !row.cr_id) {
      errors++;
      cursor.totals.errors++;
      cursor.totals.skipped++;
      appendLines(RECORD_LOG, [
        `${ts} SKIP claim_number=${row.claim_number} claim_id=${row.claim_id} reason=missing_fields`,
      ]);
      console.error(`  ${label} SKIP missing fields`);
      // still advance cursor so we don't stall
      cursor.lastClaimNumber = Number(row.claim_number);
      cursor.lastClaimId = row.claim_id;
      cursor.lastBundleId = row.bundle_id;
      cursor.lastImportedAt = ts;
      saveCursor(cursor);
      continue;
    }

    // Lazy citizen before first attempt (cheaper than fail+retry for most rows)
    try {
      await registerCitizen(cursor, row.cr_id);
    } catch (err) {
      console.error(`  citizen ${row.cr_id}: ${err.message}`);
    }

    const bundle = buildBundle(row);
    let submitted = false;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const out = await api('POST', submitPath, bundle);
        submitted = true;
        ok++;
        if (use === 'claim') {
          claimsOk++;
          cursor.totals.claimsOk++;
        } else {
          preauthsOk++;
          cursor.totals.preauthsOk++;
        }
        appendLines(RECORD_LOG, [
          `${ts} OK claim_number=${row.claim_number} claim_id=${row.claim_id} use=${use} fid=${row.fid_code} cr=${row.cr_id} scheme=${row.scheme_code} amount=${row.claimed_total} tx=${out.txHash || ''} claimNumberOnChain=${out.claimNumber || ''}`,
        ]);
        console.log(`  ${label} OK tx=${out.txHash?.slice(0, 12) || 'n/a'}…`);
        break;
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        // Already on-chain → treat as success for cursor purposes
        if (/already anchored|Already active|duplicate/i.test(msg)) {
          submitted = true;
          ok++;
          if (use === 'claim') {
            claimsOk++;
            cursor.totals.claimsOk++;
          } else {
            preauthsOk++;
            cursor.totals.preauthsOk++;
          }
          appendLines(RECORD_LOG, [
            `${ts} DUP claim_number=${row.claim_number} claim_id=${row.claim_id} use=${use} note=already_on_chain`,
          ]);
          console.log(`  ${label} DUP (already on-chain)`);
          break;
        }
        let recovered = false;
        try {
          recovered =
            (await ensureLazyCitizen(cursor, row.cr_id, msg)) ||
            (await ensureLazyProvider(cursor, row, msg)) ||
            (await ensureLazyScheme(cursor, row.scheme_code, msg));
        } catch (regErr) {
          console.error(`  registry recover fail: ${regErr.message}`);
        }
        if (recovered && attempt < 3) {
          console.log(`  ${label} registered missing entity, retry ${attempt + 1}`);
          continue;
        }
        break;
      }
    }

    if (!submitted) {
      errors++;
      cursor.totals.errors++;
      appendLines(RECORD_LOG, [
        `${ts} ERR claim_number=${row.claim_number} claim_id=${row.claim_id} use=${use} fid=${row.fid_code} cr=${row.cr_id} error=${lastError?.message || 'unknown'}`,
      ]);
      console.error(`  ${label} ERR ${lastError?.message}`);
    }

    // Always advance cursor past this claim_number so next batch continues
    cursor.lastClaimNumber = Number(row.claim_number);
    cursor.lastClaimId = row.claim_id;
    cursor.lastBundleId = row.bundle_id;
    cursor.lastImportedAt = ts;
    saveCursor(cursor);

    if ((i + 1) % 10 === 0 || i + 1 === rows.length) {
      console.log(`  progress ${i + 1}/${rows.length} ok=${ok} err=${errors} cursor=#${cursor.lastClaimNumber}`);
    }
  }

  const end = new Date();
  const balAfter = await getBalance();
  const durationSec = (end.getTime() - start.getTime()) / 1000;
  const spent =
    balBefore && balAfter
      ? (Number(balBefore.adi) - Number(balAfter.adi)).toFixed(6)
      : 'n/a';

  appendLines(RUN_LOG, [
    `RUN END    ${end.toISOString()}`,
    `durationSec  ${durationSec.toFixed(1)}`,
    `durationHuman  ${(durationSec / 60).toFixed(2)} min`,
    `batchResult  ok=${ok} claims=${claimsOk} preauths=${preauthsOk} errors=${errors}`,
    `cursorTo   ${cursor.lastClaimNumber} ${cursor.lastClaimId}`,
    `lifetime   claims=${cursor.totals.claimsOk} preauths=${cursor.totals.preauthsOk} errors=${cursor.totals.errors}`,
    `balanceAfter   ${balAfter?.adi ?? 'n/a'} ADI`,
    `tokensSpentApprox  ${spent} ADI`,
    '════════════════════════════════════════════════════════════',
  ]);

  console.log('\nBatch done.');
  console.log(`ok=${ok} (claims=${claimsOk} preauths=${preauthsOk}) errors=${errors}`);
  console.log(`cursor now claim_number=${cursor.lastClaimNumber}`);
  console.log(`duration ${(durationSec / 60).toFixed(2)} min`);
  console.log(`record log: ${RECORD_LOG}`);
  console.log(`run log:    ${RUN_LOG}`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.resetCursor) {
    writeJsonAtomic(PROGRESS_FILE, defaultProgress());
    writeJsonAtomic(REGISTRY_FILE, defaultRegistries());
    writeJsonAtomic(CURSOR_FILE, loadCursor());
    console.log(`Cursor HARD reset → ${PROGRESS_FILE} + ${REGISTRY_FILE}`);
    console.log('Use --rebuild-cursor to restore progress from db-seed-records.log');
    return;
  }

  if (args.rebuildCursor) {
    const cursor = rebuildCursorFromRecords();
    console.log('Cursor rebuilt from record log:');
    console.log(`  lastClaimNumber=${cursor.lastClaimNumber}`);
    console.log(`  lastClaimId=${cursor.lastClaimId}`);
    console.log(`  claimsOk=${cursor.totals.claimsOk} errors=${cursor.totals.errors}`);
    console.log(`  providers=${Object.keys(cursor.registered.providers).length} schemes=${Object.keys(cursor.registered.schemes).length} citizens=${Object.keys(cursor.registered.citizens).length}`);
    return;
  }

  if (!DB.password) {
    console.error('CLAIM_DB_PASSWORD is not set in .env');
    process.exit(1);
  }

  const cursor = loadCursor();
  console.log(`Backend: ${BACKEND}`);
  console.log(`DB:      ${DB.user}@${DB.host}:${DB.port}/${DB.database}`);
  console.log(`Cursor:  lastClaimNumber=${cursor.lastClaimNumber}`);

  const client = new pg.Client(DB);
  await client.connect();

  try {
    if (args.status) {
      await printStatus(client, cursor);
      return;
    }
    if (args.registerOnly) {
      await registerOnly(client, cursor);
      saveCursor(cursor, { registriesOnly: true });
      await printStatus(client, loadCursor());
      return;
    }
    await importBatch(client, cursor, args);
    saveCursor(cursor);
    await printStatus(client, cursor);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  appendLines(RUN_LOG, [`RUN FATAL  ${new Date().toISOString()}  ${e.message}`]);
  console.error(e);
  process.exit(1);
});

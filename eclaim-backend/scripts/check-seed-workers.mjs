/**
 * Alert if DB seed worker(s) are not running (or progress is stale).
 * Optionally auto-restart backend (pm2) + seed worker when stuck.
 *
 * Usage:
 *   node scripts/check-seed-workers.mjs
 *   node scripts/check-seed-workers.mjs --dry-run
 *   node scripts/check-seed-workers.mjs --force          # ignore email cooldown
 *   node scripts/check-seed-workers.mjs --no-restart     # alert only
 *   node scripts/check-seed-workers.mjs --restart        # force recovery attempt
 *
 * Env (.env):
 *   MAIL_*
 *   SEED_ALERT_TO=ops@example.com
 *   SEED_ALERT_COOLDOWN_MINUTES=360
 *   SEED_ALERT_STALE_MINUTES=45          # no new OK claims / fetch-fail storm
 *   SEED_RECOVERY_COOLDOWN_MINUTES=30     # min gap between auto backend+seed restarts
 *   SEED_ALERT_FROM_NAME=E-Claims Platform Alerts
 *   SEED_ALERT_AUTO_RESTART=true
 *   SEED_ALERT_RESTART_BACKEND=true
 *   SEED_RESTART_PM2_NAME=eclaim-backend_v2
 *   SEED_RESTART_WORKER=D
 *   SEED_RESTART_FROM=376896
 *   SEED_RESTART_TO=394954
 *   SEED_RESTART_LIMIT=10000
 *   SEED_RESTART_SKIP_ENSURE=true        # pass --skip-ensure-registries on restart
 *   SEED_RESTART_HEALTH_URL=http://localhost:8001/api/health
 *   SEED_ALERT_CHECK_RPC=true
 *   SEED_ALERT_RPC_URL=https://rpc.apeiro.adifoundation.ai  (falls back to APEIRO_RPC_URL / ECLAIM_RPC_URL)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_DIR = path.join(root, 'logs');
const STATE_FILE = path.join(LOG_DIR, 'seed-alert-state.json');
const RUN_LOG = path.join(LOG_DIR, 'seed-alerts.log');

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

const COOLDOWN_MIN = Number(process.env.SEED_ALERT_COOLDOWN_MINUTES || 360);
const RECOVERY_COOLDOWN_MIN = Number(
  process.env.SEED_RECOVERY_COOLDOWN_MINUTES || 30,
);
const STALE_MIN = Number(process.env.SEED_ALERT_STALE_MINUTES || 45);
const AUTO_RESTART =
  String(process.env.SEED_ALERT_AUTO_RESTART || 'false').toLowerCase() ===
  'true';
const RESTART_BACKEND =
  String(process.env.SEED_ALERT_RESTART_BACKEND || 'true').toLowerCase() ===
  'true';
const PM2_NAME = process.env.SEED_RESTART_PM2_NAME || 'eclaim-backend_v2';
const RESTART_WORKER = String(process.env.SEED_RESTART_WORKER || 'B').trim();
const RESTART_LIMIT = Number(process.env.SEED_RESTART_LIMIT || 10000);
const SKIP_ENSURE =
  String(process.env.SEED_RESTART_SKIP_ENSURE || 'true').toLowerCase() ===
  'true';
const HEALTH_URL =
  process.env.SEED_RESTART_HEALTH_URL || 'http://localhost:8001/api/health';
const CHECK_RPC =
  String(process.env.SEED_ALERT_CHECK_RPC || 'true').toLowerCase() === 'true';
const RPC_URL = (
  process.env.SEED_ALERT_RPC_URL ||
  process.env.APEIRO_RPC_URL ||
  process.env.ECLAIM_RPC_URL ||
  process.env.BALANCE_ALERT_RPC_URL ||
  ''
).replace(/\/$/, '');

const ALERT_TO = String(
  process.env.SEED_ALERT_TO ||
    process.env.BALANCE_ALERT_TO ||
    process.env.MAIL_DEFAULT_EMAIL ||
    '',
)
  .split(/[,;\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const NO_RESTART = args.has('--no-restart');
const FORCE_RESTART = args.has('--restart');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function appendLog(line) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(RUN_LOG, `${new Date().toISOString()} ${line}\n`);
}

function defaultState() {
  return { lastAlertAt: null, lastRecoveryAt: null, lastSnapshot: null };
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function shouldAlert(state) {
  if (FORCE) return true;
  if (!state.lastAlertAt) return true;
  const ageMs = Date.now() - new Date(state.lastAlertAt).getTime();
  return ageMs >= COOLDOWN_MIN * 60_000;
}

function shouldRecover(state) {
  if (FORCE_RESTART) return true;
  if (!state.lastRecoveryAt) return true;
  const ageMs = Date.now() - new Date(state.lastRecoveryAt).getTime();
  return ageMs >= RECOVERY_COOLDOWN_MIN * 60_000;
}

function listSeedProcesses() {
  try {
    const out = execSync('pgrep -af "seed-from-db.mjs"', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return [];
    return out
      .split('\n')
      .filter(
        (line) =>
          line.includes('seed-from-db.mjs') &&
          !line.includes('grep') &&
          !line.includes('check-seed-workers'),
      )
      .map((line) => {
        const pidM = line.match(/^(\d+)\s+/);
        const workerM = line.match(/--worker\s+(\S+)/);
        const fromM = line.match(/--from\s+(\d+)/);
        const toM = line.match(/--to\s+(\d+)/);
        return {
          pid: pidM?.[1] || '?',
          worker: workerM?.[1] || null,
          from: fromM?.[1] || null,
          to: toM?.[1] || null,
          cmd: line.replace(/^\d+\s+/, ''),
        };
      });
  } catch {
    return [];
  }
}

function readProgress(worker) {
  const file = path.join(LOG_DIR, `db-seed-progress-${worker}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readRunLogTail(worker, maxLines = 60) {
  const file = path.join(LOG_DIR, `db-seed-runs-${worker}.log`);
  if (!fs.existsSync(file)) return [];
  try {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function analyzeRunLog(worker) {
  const tail = readRunLogTail(worker, 80);
  const text = tail.join('\n');
  const fetchFailRetries =
    (text.match(/retry \d+\/\d+: fetch failed/gi) || []).length;
  const okTxRecent = (tail.slice(-25).join('\n').match(/OK tx=/gi) || []).length;
  const errRecent = (tail.slice(-25).join('\n').match(/\bERR\b/gi) || []).length;
  const ensuringStuck =
    /Ensuring registries for run:/i.test(text) &&
    !/RUN START/i.test(text.slice(text.lastIndexOf('Ensuring registries')));
  const lastLine = tail.filter(Boolean).at(-1) || '';
  const rpcFatal =
    /RUN FATAL/i.test(text) &&
    /502 Bad Gateway|SERVER_ERROR|rpc\.apeiro|eth_sendRawTransaction|ECONNREFUSED|ETIMEDOUT/i.test(
      text,
    );
  const rpcFatalSnippet = (() => {
    const line = [...tail]
      .reverse()
      .find((l) => /RUN FATAL|502 Bad Gateway|Bad Gateway/i.test(l));
    return line ? line.slice(0, 200) : '';
  })();

  return {
    fetchFailRetries,
    okTxRecent,
    errRecent,
    ensuringStuck,
    lastLine: lastLine.slice(0, 120),
    apiStuck:
      fetchFailRetries >= 3 && okTxRecent === 0 && errRecent > 0,
    rpcFatal,
    rpcFatalSnippet,
  };
}

/** Live JSON-RPC probe (eth_blockNumber). */
async function checkRpcHealth() {
  if (!CHECK_RPC || !RPC_URL) {
    return { ok: true, skipped: true, reason: 'RPC check disabled or URL unset' };
  }
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 120);
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}${body ? `: ${body.trim()}` : ''}`,
        url: RPC_URL,
      };
    }
    const data = await res.json().catch(() => null);
    if (data?.error) {
      return {
        ok: false,
        status: res.status,
        error: data.error.message || JSON.stringify(data.error),
        url: RPC_URL,
      };
    }
    if (!data?.result) {
      return {
        ok: false,
        status: res.status,
        error: 'empty eth_blockNumber result',
        url: RPC_URL,
      };
    }
    return {
      ok: true,
      status: res.status,
      blockNumber: data.result,
      url: RPC_URL,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err.message,
      url: RPC_URL,
    };
  }
}

function resolveRestartRange() {
  const progress = readProgress(RESTART_WORKER);
  const from = Number(
    process.env.SEED_RESTART_FROM || progress?.range?.from || '',
  );
  const to = Number(process.env.SEED_RESTART_TO || progress?.range?.to || '');
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0) {
    return null;
  }
  return { from, to, progress };
}

function isRangeComplete(progress, to) {
  return (
    progress?.lastClaimNumber != null &&
    Number(progress.lastClaimNumber) >= Number(to)
  );
}

function createMailer() {
  const host = process.env.MAIL_HOST;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error('MAIL_HOST / MAIL_USER / MAIL_PASSWORD must be set in .env');
  }
  return nodemailer.createTransport({
    host,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    requireTLS: process.env.MAIL_REQUIRE_TLS !== 'false',
    ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
    auth: { user, pass },
  });
}

function buildIssues(processes, state, { rpcHealth, logInfo } = {}) {
  const issues = [];
  const progress = readProgress(RESTART_WORKER);
  const range = progress?.range;
  const complete =
    range?.to != null &&
    progress?.lastClaimNumber != null &&
    Number(progress.lastClaimNumber) >= Number(range.to);

  const log = logInfo || analyzeRunLog(RESTART_WORKER);

  // RPC outage — highest priority (do not restart seed while chain RPC is down)
  if ((rpcHealth && !rpcHealth.ok && !rpcHealth.skipped) || log.rpcFatal) {
    const rpcDetail = rpcHealth && !rpcHealth.ok
      ? `Blockchain RPC is unreachable (${rpcHealth.url || RPC_URL || 'RPC'} → ${rpcHealth.error || rpcHealth.status}).`
      : `Import log shows a fatal RPC error: ${log.rpcFatalSnippet || '502 Bad Gateway'}.`;
    issues.push({
      kind: 'rpc_down',
      worker: RESTART_WORKER,
      message: 'Blockchain network is unavailable',
      detail: `${rpcDetail} Claims cannot be anchored on-chain until the Apeiro RPC recovers. Restarting the import service will not help while the network is down.`,
      lastImportedAt: progress?.lastImportedAt,
      lastClaimNumber: progress?.lastClaimNumber,
      claimsOk: Number(progress?.totals?.claimsOk ?? 0),
      range,
    });
  }

  if (processes.length === 0) {
    // If we already know it's RPC, keep that as primary; still note import stopped
    if (!issues.some((i) => i.kind === 'rpc_down')) {
      issues.push({
        kind: 'no_process',
        worker: RESTART_WORKER,
        message: 'Claims database import is not running',
        detail:
          'The service that imports claims from the database and anchors them on the blockchain is stopped. No new claims are being processed.',
      });
    } else {
      issues.push({
        kind: 'no_process',
        worker: RESTART_WORKER,
        message: 'Claims database import stopped after RPC failure',
        detail:
          'The import process exited because the blockchain RPC returned an error (commonly 502 Bad Gateway). It will need a restart after the network recovers.',
      });
    }
    return issues;
  }

  if (complete) return issues;

  const workerProc = processes.find((p) => p.worker === RESTART_WORKER);
  const claimsOk = Number(progress?.totals?.claimsOk ?? 0);
  const snap = state.lastSnapshot;

  let noOnChainMin = 0;
  if (
    snap?.worker === RESTART_WORKER &&
    snap.claimsOk === claimsOk &&
    snap.at
  ) {
    noOnChainMin = (Date.now() - new Date(snap.at).getTime()) / 60_000;
  }

  if (STALE_MIN > 0 && progress) {
    if (noOnChainMin >= STALE_MIN) {
      issues.push({
        kind: 'no_onchain_progress',
        worker: RESTART_WORKER,
        message: 'No new claims anchored on-chain',
        detail: `Successful on-chain imports have not increased for approximately ${Math.round(noOnChainMin)} minutes (still at ${claimsOk} OK claims). The import may be failing silently or the API is unreachable.`,
        lastImportedAt: progress.lastImportedAt,
        lastClaimNumber: progress.lastClaimNumber,
        claimsOk,
        range,
      });
    } else if (progress.lastImportedAt) {
      const ageMin =
        (Date.now() - new Date(progress.lastImportedAt).getTime()) / 60_000;
      if (ageMin >= STALE_MIN && !complete) {
        issues.push({
          kind: 'stale_progress',
          worker: RESTART_WORKER,
          message: 'Claims database import has stalled',
          detail: `No import activity for approximately ${Math.round(ageMin)} minutes. The process may be hung waiting on the API or blockchain.`,
          lastImportedAt: progress.lastImportedAt,
          lastClaimNumber: progress.lastClaimNumber,
          claimsOk,
          range,
        });
      }
    }
  }

  if (workerProc && log.apiStuck) {
    issues.push({
      kind: 'api_stuck',
      worker: RESTART_WORKER,
      message: 'Import API unreachable (fetch failed)',
      detail: `The import log shows repeated "fetch failed" retries with no recent successful transactions. Last log: ${log.lastLine}`,
      lastClaimNumber: progress?.lastClaimNumber,
      claimsOk,
      range,
    });
  }

  if (workerProc && log.ensuringStuck && !issues.some((i) => i.kind === 'rpc_down')) {
    issues.push({
      kind: 'registry_stuck',
      worker: RESTART_WORKER,
      message: 'Import stuck during registry setup',
      detail:
        'The process has been ensuring provider/scheme registries for an extended period without starting claim submissions. The backend may be hung on blockchain RPC calls.',
      lastClaimNumber: progress?.lastClaimNumber,
      claimsOk,
      range,
    });
  }

  // de-dupe by kind
  const seen = new Set();
  return issues.filter((i) => {
    if (seen.has(i.kind)) return false;
    seen.add(i.kind);
    return true;
  });
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return (
      new Date(iso).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }) + ' UTC'
    );
  } catch {
    return iso;
  }
}

async function checkBackendHealth() {
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function tryRestartBackend() {
  if (!RESTART_BACKEND) {
    return { ok: true, skipped: true, reason: 'Backend restart disabled' };
  }

  try {
    execSync(`pm2 restart ${PM2_NAME}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    });
    appendLog(`backend pm2 restart ${PM2_NAME}`);
    await sleep(10_000);

    for (let i = 0; i < 6; i++) {
      const health = await checkBackendHealth();
      if (health.ok) {
        return {
          ok: true,
          reason: `Backend restarted (${PM2_NAME}) and health check passed.`,
        };
      }
      await sleep(5000);
    }

    return {
      ok: false,
      reason: `Backend restarted (${PM2_NAME}) but health check still failing (${HEALTH_URL}).`,
    };
  } catch (err) {
    return {
      ok: false,
      reason: `Backend restart failed (${PM2_NAME}): ${err.message}`,
    };
  }
}

function killSeedProcesses(processes, issues) {
  const killAll =
    issues.some((i) => i.kind === 'no_process') ||
    issues.some((i) =>
      ['api_stuck', 'registry_stuck', 'stale_progress', 'no_onchain_progress'].includes(
        i.kind,
      ),
    );

  const killed = [];
  for (const p of processes) {
    const shouldKill =
      killAll ||
      (RESTART_WORKER && p.worker === RESTART_WORKER);
    if (!shouldKill || !p.pid || p.pid === '?') continue;
    try {
      process.kill(Number(p.pid), 'SIGTERM');
      killed.push(p.pid);
      appendLog(`restart kill pid=${p.pid} worker=${p.worker || '?'}`);
    } catch (err) {
      appendLog(`restart kill-fail pid=${p.pid} ${err.message}`);
    }
  }
  return killed;
}

async function tryRecovery(issues) {
  if (issues.some((i) => i.kind === 'rpc_down')) {
    return {
      ok: false,
      skipped: true,
      backend: { skipped: true },
      seed: { skipped: true },
      reason:
        'Blockchain RPC is down — skipped backend/import restart. Import will resume after the network recovers.',
    };
  }

  const range = resolveRestartRange();
  if (!range) {
    return {
      ok: false,
      backend: null,
      seed: null,
      reason:
        'Restart range not configured (set SEED_RESTART_FROM / SEED_RESTART_TO or progress.range)',
    };
  }

  const { from, to, progress } = range;
  if (isRangeComplete(progress, to)) {
    return {
      ok: true,
      skipped: true,
      backend: { skipped: true },
      seed: { skipped: true },
      reason: `Worker ${RESTART_WORKER} range already complete (cursor #${progress.lastClaimNumber} ≥ ${to})`,
    };
  }

  const needsBackend =
    RESTART_BACKEND &&
    issues.some((i) =>
      ['api_stuck', 'registry_stuck', 'stale_progress', 'no_onchain_progress', 'no_process'].includes(
        i.kind,
      ),
    );

  let backend = { ok: true, skipped: !needsBackend, reason: 'not needed' };
  if (needsBackend) {
    backend = await tryRestartBackend();
    if (!backend.ok && !backend.skipped) {
      return {
        ok: false,
        backend,
        seed: null,
        reason: backend.reason,
      };
    }
  } else {
    const health = await checkBackendHealth();
    if (!health.ok) {
      backend = await tryRestartBackend();
      if (!backend.ok) {
        return {
          ok: false,
          backend,
          seed: null,
          reason: backend.reason,
        };
      }
    }
  }

  const processes = listSeedProcesses();
  killSeedProcesses(processes, issues);
  await sleep(2000);

  const still = listSeedProcesses().filter((p) => p.worker === RESTART_WORKER);
  if (still.length) {
    return {
      ok: true,
      skipped: true,
      backend,
      seed: { skipped: true },
      reason: `Worker ${RESTART_WORKER} still running after kill (pid ${still.map((p) => p.pid).join(', ')})`,
    };
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const runLog = path.join(LOG_DIR, `db-seed-runs-${RESTART_WORKER}.log`);
  const pidFile = path.join(LOG_DIR, `db-seed-worker-${RESTART_WORKER}.pid`);
  const outFd = fs.openSync(runLog, 'a');

  const seedArgs = [
    path.join(root, 'scripts', 'seed-from-db.mjs'),
    '--worker',
    RESTART_WORKER,
    '--from',
    String(from),
    '--to',
    String(to),
    '--limit',
    String(RESTART_LIMIT),
    '--no-wait',
  ];
  if (SKIP_ENSURE) seedArgs.push('--skip-ensure-registries');

  const child = spawn(process.execPath, seedArgs, {
    cwd: root,
    detached: true,
    stdio: ['ignore', outFd, outFd],
    env: process.env,
  });
  fs.closeSync(outFd);
  child.unref();

  fs.writeFileSync(pidFile, `${child.pid}\n`);
  await sleep(3000);

  const alive = listSeedProcesses().some(
    (p) => String(p.pid) === String(child.pid) || p.worker === RESTART_WORKER,
  );

  const seed = alive
    ? {
        ok: true,
        pid: child.pid,
        reason: `Import restarted (worker ${RESTART_WORKER}, ${from}→${to}, pid ${child.pid}${SKIP_ENSURE ? ', skip registries' : ''}).`,
      }
    : {
        ok: false,
        pid: child.pid,
        reason: `Import launch failed — check logs/db-seed-runs-${RESTART_WORKER}.log`,
      };

  const ok = seed.ok;
  const reason = [
    backend.reason && backend.reason !== 'not needed' ? backend.reason : null,
    seed.reason,
  ]
    .filter(Boolean)
    .join(' ');

  return { ok, skipped: false, backend, seed, reason };
}

async function sendAlert(transporter, { issues, recovery }) {
  const fromName =
    process.env.SEED_ALERT_FROM_NAME || 'E-Claims Platform Alerts';
  const fromEmail = process.env.MAIL_DEFAULT_EMAIL || process.env.MAIL_USER;
  const checkedAt = formatWhen(new Date().toISOString());
  const primary = issues[0];

  const recovered =
    recovery?.ok && !recovery?.skipped && recovery?.seed?.ok;
  const recoveryFailed = recovery && !recovery.ok && !recovery.skipped;

  const subject = recovered
    ? '[E-Claims] Claims import auto-recovered (backend + import restarted)'
    : recoveryFailed
      ? '[E-Claims] Claims import stuck — auto-recovery failed'
      : primary.kind === 'rpc_down'
        ? '[E-Claims] Blockchain network unavailable (RPC down)'
        : primary.kind === 'no_process'
          ? '[E-Claims] Claims database import is not running'
          : primary.kind === 'api_stuck'
            ? '[E-Claims] Claims import API unreachable'
            : '[E-Claims] Claims database import has stalled';

  const statusLabel = recovered
    ? 'RECOVERED'
    : recoveryFailed
      ? 'FAILED'
      : primary.kind === 'rpc_down'
        ? 'RPC DOWN'
        : primary.kind === 'no_process'
          ? 'STOPPED'
          : 'STALLED';
  const statusColor =
    statusLabel === 'RECOVERED'
      ? '#2e7d32'
      : statusLabel === 'FAILED'
        ? '#c62828'
        : '#c62828';
  const statusBg =
    statusLabel === 'RECOVERED'
      ? '#e8f5e9'
      : statusLabel === 'FAILED'
        ? '#ffebee'
        : '#ffebee';

  let actionText;
  if (primary.kind === 'rpc_down') {
    actionText =
      'The Apeiro blockchain RPC is currently unavailable. Claims import cannot continue until the network recovers. No server restart is required for this outage — monitoring will restart import automatically after RPC is healthy again, or you can restart Worker E manually once RPC responds.';
  } else if (recovered) {
    actionText =
      'The platform automatically restarted the E-Claims backend and claims import service. Monitoring will continue — no manual action is required unless another alert arrives.';
  } else if (recoveryFailed) {
    actionText = `Automatic recovery was attempted but did not fully succeed: ${recovery.reason} Please investigate the E-Claims blockchain server manually.`;
  } else if (recovery?.skipped) {
    actionText = recovery.reason;
  } else if (!recovery) {
    actionText =
      'Please investigate the import service on the E-Claims blockchain server. The backend and import process may need to be restarted.';
  } else {
    actionText =
      'Please restart the claims database import service on the E-Claims blockchain server.';
  }

  const recoveryNote = recovery?.reason
    ? `\nAuto-recovery: ${recovery.reason}\n`
    : '';

  const text = `E-Claims — Claims database import alert

Status: ${statusLabel}
${primary.message}

${primary.detail || ''}
${recoveryNote}
Checked: ${checkedAt}
Platform: E-Claims blockchain integration (ADI L2)

Action required:
${actionText}

If you need assistance, contact the platform operations team.
`;

  const detailBlock = issues
    .map(
      (i) => `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;">
            <tr>
              <td style="padding:16px 18px;">
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:15px;font-weight:700;color:#111;">${i.message}</td>
                    <td align="right">
                      <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${statusColor};background:${statusBg};">${statusLabel}</span>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:10px;font-size:14px;color:#546e7a;line-height:1.55;">
                  ${i.detail || ''}
                </div>
                ${
                  i.lastImportedAt
                    ? `<div style="margin-top:10px;font-size:12px;color:#90a4ae;">Last activity: ${formatWhen(i.lastImportedAt)}</div>`
                    : ''
                }
                ${
                  i.claimsOk != null
                    ? `<div style="margin-top:4px;font-size:12px;color:#90a4ae;">On-chain OK claims: ${i.claimsOk}</div>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');

  const actionBg = recovered ? '#e8f5e9' : '#fff8e1';
  const actionBorder = recovered ? '#a5d6a7' : '#ffe082';
  const actionFg = recovered ? '#1b5e20' : '#5d4037';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;">
          <tr>
            <td style="padding:0 4px 18px 4px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#90a4ae;">E-Claims · Blockchain integration</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#111;letter-spacing:-0.02em;">Claims import alert</div>
              <div style="margin-top:6px;font-size:14px;color:#607d8b;line-height:1.45;">
                ${primary.message}${recovered ? ' Backend and import were automatically restarted.' : '.'}
              </div>
            </td>
          </tr>
          ${detailBlock}
          <tr>
            <td style="padding:8px 4px 0 4px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:${actionBg};border:1px solid ${actionBorder};border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:${actionFg};line-height:1.55;">
                    <strong>${recovered ? 'Auto-recovery' : 'Action required'}</strong><br/>
                    ${actionText}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 4px 0 4px;font-size:12px;color:#90a4ae;line-height:1.5;">
              Checked ${checkedAt}<br/>
              E-Claims platform · ADI L2 blockchain anchoring
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: ALERT_TO.join(', '),
    subject,
    text,
    html,
  });
}

function updateSnapshot(state, progress) {
  const claimsOk = Number(progress?.totals?.claimsOk ?? 0);
  const snap = state.lastSnapshot;
  if (
    snap?.worker === RESTART_WORKER &&
    snap.claimsOk === claimsOk
  ) {
    return state;
  }
  return {
    ...state,
    lastSnapshot: {
      worker: RESTART_WORKER,
      claimsOk,
      claimNumber: progress?.lastClaimNumber ?? null,
      at: new Date().toISOString(),
    },
  };
}

async function main() {
  const doRestart = (AUTO_RESTART || FORCE_RESTART) && !NO_RESTART;
  let state = loadState();

  console.log('── DB seed worker check ──');
  console.log(`Check:            worker ${RESTART_WORKER} + seed process`);
  console.log(`Alert to:         ${ALERT_TO.join(', ') || '(none)'}`);
  console.log(`Email cooldown:   ${COOLDOWN_MIN} min`);
  console.log(`Recovery cooldown:${RECOVERY_COOLDOWN_MIN} min`);
  console.log(`Stale threshold:  ${STALE_MIN > 0 ? `${STALE_MIN} min` : 'off'}`);
  console.log(
    `Auto-recovery:    ${doRestart ? `on (pm2 ${PM2_NAME} + seed ${RESTART_WORKER})` : 'off'}`,
  );
  console.log(`RPC check:        ${CHECK_RPC ? RPC_URL || '(unset)' : 'off'}`);
  console.log(
    `Mode:             ${DRY_RUN ? 'dry-run' : FORCE ? 'force' : 'normal'}`,
  );

  if (!ALERT_TO.length) {
    throw new Error(
      'SEED_ALERT_TO (or BALANCE_ALERT_TO / MAIL_DEFAULT_EMAIL) is required',
    );
  }

  const rpcHealth = await checkRpcHealth();
  if (rpcHealth.skipped) {
    console.log('RPC:              skipped');
  } else if (rpcHealth.ok) {
    console.log(`RPC:              ok block=${rpcHealth.blockNumber}`);
    appendLog(`rpc ok block=${rpcHealth.blockNumber}`);
  } else {
    console.log(`RPC:              DOWN ${rpcHealth.error || rpcHealth.status}`);
    appendLog(`rpc down ${rpcHealth.error || rpcHealth.status} url=${rpcHealth.url}`);
  }

  const processes = listSeedProcesses();
  console.log(`Running: ${processes.length} seed process(es)`);
  for (const p of processes) {
    console.log(
      `  pid=${p.pid} worker=${p.worker || '?'} ${p.from || '?'}→${p.to || '?'}`,
    );
    appendLog(
      `process pid=${p.pid} worker=${p.worker || '?'} cmd=${p.cmd}`,
    );
  }

  const progress = readProgress(RESTART_WORKER);
  if (progress) {
    console.log(
      `Progress ${RESTART_WORKER}: #${progress.lastClaimNumber} ok=${progress.totals?.claimsOk ?? '?'} err=${progress.totals?.errors ?? '?'}`,
    );
  }

  const logInfo = analyzeRunLog(RESTART_WORKER);
  if (logInfo.fetchFailRetries) {
    console.log(
      `Log: fetch-fail retries=${logInfo.fetchFailRetries} recent OK tx=${logInfo.okTxRecent}`,
    );
  }
  if (logInfo.rpcFatal) {
    console.log(`Log: RPC FATAL detected — ${logInfo.rpcFatalSnippet.slice(0, 100)}`);
  }

  const issues = buildIssues(processes, state, { rpcHealth, logInfo });

  if (!issues.length) {
    console.log('OK — import healthy.');
    appendLog('result=ok');
    state = updateSnapshot(state, progress);
    saveState(state);
    return;
  }

  for (const i of issues) {
    console.log(`ISSUE: ${i.message}`);
    appendLog(
      `issue kind=${i.kind} worker=${i.worker || '-'} msg=${i.message}`,
    );
  }

  const rpcDown = issues.some((i) => i.kind === 'rpc_down');
  let recovery = null;
  if (doRestart && shouldRecover(state)) {
    if (DRY_RUN) {
      recovery = {
        ok: true,
        skipped: true,
        reason: rpcDown
          ? 'Dry-run — would alert RPC down (no restart)'
          : 'Dry-run — would restart backend + seed',
      };
      console.log(
        rpcDown
          ? '[dry-run] would email RPC-down alert (skip restart)'
          : `[dry-run] would pm2 restart ${PM2_NAME} + restart worker ${RESTART_WORKER}`,
      );
    } else {
      console.log(
        rpcDown
          ? 'RPC down — skipping auto-restart; sending alert…'
          : 'Attempting auto-recovery (backend + seed)…',
      );
      recovery = await tryRecovery(issues);
      console.log(
        recovery.ok || recovery.skipped
          ? `Recovery: ${recovery.reason}`
          : `Recovery FAILED: ${recovery.reason}`,
      );
      appendLog(
        `recovery ok=${recovery.ok} skipped=${!!recovery.skipped} ${recovery.reason}`,
      );
      if (!recovery.skipped) {
        state.lastRecoveryAt = new Date().toISOString();
      }
    }
  } else if (doRestart) {
    console.log(
      `Recovery suppressed (cooldown ${RECOVERY_COOLDOWN_MIN} min). Use --restart to force.`,
    );
    appendLog(`result=recovery-cooldown issues=${issues.length}`);
  }

  const sendMail =
    shouldAlert(state) ||
    rpcDown ||
    (recovery && !recovery.ok && !recovery.skipped) ||
    (recovery?.ok && !recovery?.skipped);

  if (!sendMail) {
    console.log(
      `Email suppressed (cooldown ${COOLDOWN_MIN} min). Use --force to re-send.`,
    );
    state = updateSnapshot(state, progress);
    saveState(state);
    return;
  }

  const transporter = createMailer();
  if (DRY_RUN) {
    console.log('Dry-run — email not sent.');
    appendLog(`result=dry-run issues=${issues.length}`);
    state = updateSnapshot(state, progress);
    saveState(state);
    return;
  }

  await transporter.verify();
  console.log('SMTP OK');

  const info = await sendAlert(transporter, { issues, recovery });
  console.log(
    `Alert sent → ${ALERT_TO.join(', ')}  messageId=${info.messageId || 'n/a'}`,
  );
  appendLog(
    `result=alerted issues=${issues.length} recovery=${recovery ? recovery.ok : 'n/a'} to=${ALERT_TO.join(',')}`,
  );

  state.lastAlertAt = new Date().toISOString();
  state = updateSnapshot(state, progress);
  saveState(state);
}

main().catch((err) => {
  console.error(err?.message || err);
  appendLog(`result=error ${err?.message || err}`);
  process.exit(1);
});

/**
 * Alert if DB seed worker(s) are not running (or progress is stale).
 * Optionally auto-restart a configured worker (no manual SSH needed).
 *
 * Usage:
 *   node scripts/check-seed-workers.mjs
 *   node scripts/check-seed-workers.mjs --dry-run
 *   node scripts/check-seed-workers.mjs --force          # ignore email cooldown
 *   node scripts/check-seed-workers.mjs --no-restart     # alert only
 *   node scripts/check-seed-workers.mjs --restart        # force restart attempt
 *
 * Env (.env):
 *   MAIL_*
 *   SEED_ALERT_TO=ops@example.com
 *   SEED_ALERT_COOLDOWN_MINUTES=360
 *   SEED_ALERT_STALE_MINUTES=45
 *   SEED_ALERT_FROM_NAME=E-Claims Platform Alerts
 *   SEED_ALERT_AUTO_RESTART=true
 *   SEED_RESTART_WORKER=B
 *   SEED_RESTART_FROM=340778          (optional — falls back to progress.range)
 *   SEED_RESTART_TO=358836
 *   SEED_RESTART_LIMIT=10000
 *   SEED_RESTART_HEALTH_URL=http://localhost:8001/api/health
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
const STALE_MIN = Number(process.env.SEED_ALERT_STALE_MINUTES || 0);
const AUTO_RESTART =
  String(process.env.SEED_ALERT_AUTO_RESTART || 'false').toLowerCase() ===
  'true';
const RESTART_WORKER = String(process.env.SEED_RESTART_WORKER || 'B').trim();
const RESTART_LIMIT = Number(process.env.SEED_RESTART_LIMIT || 10000);
const HEALTH_URL =
  process.env.SEED_RESTART_HEALTH_URL || 'http://localhost:8001/api/health';

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

function appendLog(line) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(RUN_LOG, `${new Date().toISOString()} ${line}\n`);
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { lastAlertAt: null };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastAlertAt: null };
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

function buildIssues(processes) {
  const issues = [];

  if (processes.length === 0) {
    issues.push({
      kind: 'no_process',
      worker: null,
      message: 'Claims database import is not running',
      detail:
        'The service that imports claims from the database and anchors them on the blockchain is stopped. No new claims are being processed.',
    });
    return issues;
  }

  if (STALE_MIN > 0) {
    const runningWorkers = [
      ...new Set(processes.map((p) => p.worker).filter(Boolean)),
    ];

    for (const w of runningWorkers) {
      const progress = readProgress(w);
      if (!progress?.lastImportedAt) continue;
      const ageMin =
        (Date.now() - new Date(progress.lastImportedAt).getTime()) / 60_000;
      const range = progress.range;
      const complete =
        range?.to != null &&
        Number(progress.lastClaimNumber) >= Number(range.to);
      if (!complete && ageMin >= STALE_MIN) {
        issues.push({
          kind: 'stale_progress',
          worker: w,
          message: 'Claims database import has stalled',
          detail: `No new claims have been imported for approximately ${Math.round(ageMin)} minutes. The import process may be hung or blocked.`,
          lastImportedAt: progress.lastImportedAt,
          lastClaimNumber: progress.lastClaimNumber,
          range,
        });
      }
    }
  }

  return issues;
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

function killStaleSeedProcesses(processes, issues) {
  const staleWorkers = new Set(
    issues.filter((i) => i.kind === 'stale_progress').map((i) => i.worker),
  );
  if (!staleWorkers.size && !issues.some((i) => i.kind === 'no_process')) {
    return [];
  }

  const killed = [];
  for (const p of processes) {
    const shouldKill =
      issues.some((i) => i.kind === 'no_process') ||
      (p.worker && staleWorkers.has(p.worker)) ||
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

/**
 * Start seed-from-db in background. Returns { ok, pid?, reason?, skipped? }.
 */
async function tryRestartSeed(issues) {
  const range = resolveRestartRange();
  if (!range) {
    return {
      ok: false,
      reason:
        'Restart range not configured (set SEED_RESTART_FROM / SEED_RESTART_TO or progress.range)',
    };
  }

  const { from, to, progress } = range;
  if (
    progress?.lastClaimNumber != null &&
    Number(progress.lastClaimNumber) >= to
  ) {
    return {
      ok: true,
      skipped: true,
      reason: `Worker ${RESTART_WORKER} range already complete (cursor #${progress.lastClaimNumber} ≥ ${to})`,
    };
  }

  const health = await checkBackendHealth();
  if (!health.ok) {
    return {
      ok: false,
      reason: `Backend health check failed (${HEALTH_URL} → ${health.status || health.error || 'unreachable'}). Import was not restarted.`,
    };
  }

  const processes = listSeedProcesses();
  killStaleSeedProcesses(processes, issues);
  // brief pause so SIGTERM can take effect before spawn
  await new Promise((r) => setTimeout(r, 1500));

  // if something still running for this worker after kill, don't double-start
  const still = listSeedProcesses().filter((p) => p.worker === RESTART_WORKER);
  if (still.length) {
    return {
      ok: true,
      skipped: true,
      reason: `Worker ${RESTART_WORKER} already running (pid ${still.map((p) => p.pid).join(', ')})`,
    };
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const runLog = path.join(LOG_DIR, `db-seed-runs-${RESTART_WORKER}.log`);
  const pidFile = path.join(LOG_DIR, `db-seed-worker-${RESTART_WORKER}.pid`);
  const outFd = fs.openSync(runLog, 'a');

  const child = spawn(
    process.execPath,
    [
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
    ],
    {
      cwd: root,
      detached: true,
      stdio: ['ignore', outFd, outFd],
      env: process.env,
    },
  );
  fs.closeSync(outFd);
  child.unref();

  fs.writeFileSync(pidFile, `${child.pid}\n`);
  await new Promise((r) => setTimeout(r, 2000));

  const alive = listSeedProcesses().some(
    (p) => String(p.pid) === String(child.pid) || p.worker === RESTART_WORKER,
  );
  if (!alive) {
    return {
      ok: false,
      pid: child.pid,
      reason: `Restart launched (pid ${child.pid}) but process is not running — check logs/db-seed-runs-${RESTART_WORKER}.log`,
    };
  }

  return {
    ok: true,
    pid: child.pid,
    reason: `Import service restarted (worker ${RESTART_WORKER}, range ${from}→${to}, pid ${child.pid}).`,
  };
}

async function sendAlert(transporter, { issues, restart }) {
  const fromName =
    process.env.SEED_ALERT_FROM_NAME || 'E-Claims Platform Alerts';
  const fromEmail = process.env.MAIL_DEFAULT_EMAIL || process.env.MAIL_USER;
  const checkedAt = formatWhen(new Date().toISOString());
  const primary = issues[0];

  const restartedOk = restart?.ok && !restart?.skipped;
  const subject = restartedOk
    ? '[E-Claims] Claims database import auto-restarted'
    : primary.kind === 'no_process'
      ? '[E-Claims] Claims database import is not running'
      : primary.kind === 'stale_progress'
        ? '[E-Claims] Claims database import has stalled'
        : `[E-Claims] Claims import alert — action required`;

  const statusLabel = restartedOk
    ? 'RESTARTED'
    : primary.kind === 'no_process'
      ? 'STOPPED'
      : 'STALLED';
  const statusColor = restartedOk ? '#2e7d32' : '#c62828';
  const statusBg = restartedOk ? '#e8f5e9' : '#ffebee';

  let actionText;
  if (restartedOk) {
    actionText =
      'The platform automatically restarted the claims database import service. No manual action is required unless further alerts arrive.';
  } else if (restart?.skipped) {
    actionText = restart.reason;
  } else if (restart && !restart.ok) {
    actionText = `Automatic restart was attempted but did not succeed: ${restart.reason} Please restart the import service on the E-Claims blockchain server.`;
  } else if (primary.kind === 'no_process') {
    actionText =
      'Please restart the claims database import service on the E-Claims blockchain server. Until it is restored, claims created in the source database will not be anchored on-chain.';
  } else {
    actionText =
      'Please investigate the import service on the E-Claims blockchain server. The process may need to be restarted to resume anchoring claims on-chain.';
  }

  const restartNote = restart?.reason
    ? `\nAuto-recovery: ${restart.reason}\n`
    : '';

  const text = `E-Claims — Claims database import alert

Status: ${statusLabel}
${primary.message}

${primary.detail || ''}
${restartNote}
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
                    ? `<div style="margin-top:10px;font-size:12px;color:#90a4ae;">Last successful import: ${formatWhen(i.lastImportedAt)}</div>`
                    : ''
                }
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');

  const actionBg = restartedOk ? '#e8f5e9' : '#fff8e1';
  const actionBorder = restartedOk ? '#a5d6a7' : '#ffe082';
  const actionFg = restartedOk ? '#1b5e20' : '#5d4037';

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
                ${primary.message}${restartedOk ? ' An automatic restart was performed.' : '.'}
              </div>
            </td>
          </tr>
          ${detailBlock}
          <tr>
            <td style="padding:8px 4px 0 4px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:${actionBg};border:1px solid ${actionBorder};border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:${actionFg};line-height:1.55;">
                    <strong>${restartedOk ? 'Auto-recovery' : 'Action required'}</strong><br/>
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

async function main() {
  const doRestart = (AUTO_RESTART || FORCE_RESTART) && !NO_RESTART;

  console.log('── DB seed worker check ──');
  console.log(`Check:            any seed-from-db.mjs process`);
  console.log(`Alert to:         ${ALERT_TO.join(', ') || '(none)'}`);
  console.log(`Cooldown:         ${COOLDOWN_MIN} min`);
  console.log(`Stale threshold:  ${STALE_MIN > 0 ? `${STALE_MIN} min` : 'off'}`);
  console.log(
    `Auto-restart:     ${doRestart ? `on (worker ${RESTART_WORKER})` : 'off'}`,
  );
  console.log(
    `Mode:             ${DRY_RUN ? 'dry-run' : FORCE ? 'force' : 'normal'}`,
  );

  if (!ALERT_TO.length) {
    throw new Error(
      'SEED_ALERT_TO (or BALANCE_ALERT_TO / MAIL_DEFAULT_EMAIL) is required',
    );
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

  const issues = buildIssues(processes);
  if (!issues.length) {
    console.log('OK — seed worker(s) running.');
    appendLog('result=ok');
    return;
  }

  for (const i of issues) {
    console.log(`ISSUE: ${i.message}`);
    appendLog(
      `issue kind=${i.kind} worker=${i.worker || '-'} msg=${i.message}`,
    );
  }

  let restart = null;
  if (doRestart) {
    if (DRY_RUN) {
      restart = {
        ok: true,
        skipped: true,
        reason: 'Dry-run — restart not executed',
      };
      console.log(`[dry-run] would auto-restart worker ${RESTART_WORKER}`);
    } else {
      console.log(`Attempting auto-restart of worker ${RESTART_WORKER}…`);
      restart = await tryRestartSeed(issues);
      console.log(
        restart.ok
          ? `Restart: ${restart.reason}`
          : `Restart FAILED: ${restart.reason}`,
      );
      appendLog(
        `restart ok=${restart.ok} skipped=${!!restart.skipped} pid=${restart.pid || '-'} ${restart.reason}`,
      );
    }
  }

  const state = loadState();
  if (!shouldAlert(state)) {
    console.log(
      `Alert suppressed (cooldown ${COOLDOWN_MIN} min). Use --force to re-send.`,
    );
    appendLog(
      `result=cooldown issues=${issues.length} restart=${restart ? restart.ok : 'n/a'}`,
    );
    return;
  }

  const transporter = createMailer();
  if (DRY_RUN) {
    console.log('Dry-run — email not sent.');
    appendLog(`result=dry-run issues=${issues.length}`);
    return;
  }

  await transporter.verify();
  console.log('SMTP OK');

  const info = await sendAlert(transporter, { issues, restart });
  console.log(
    `Alert sent → ${ALERT_TO.join(', ')}  messageId=${info.messageId || 'n/a'}`,
  );
  appendLog(
    `result=alerted issues=${issues.length} restart=${restart ? restart.ok : 'n/a'} to=${ALERT_TO.join(',')}`,
  );

  saveState({ lastAlertAt: new Date().toISOString() });
}

main().catch((err) => {
  console.error(err?.message || err);
  appendLog(`result=error ${err?.message || err}`);
  process.exit(1);
});

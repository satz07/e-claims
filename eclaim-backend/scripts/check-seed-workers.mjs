/**
 * Alert if DB seed worker(s) are not running (or progress is stale).
 *
 * Usage:
 *   node scripts/check-seed-workers.mjs
 *   node scripts/check-seed-workers.mjs --dry-run
 *   node scripts/check-seed-workers.mjs --force   # ignore cooldown
 *
 * Env (.env):
 *   MAIL_*  (SMTP)
 *   SEED_ALERT_TO=ops@example.com          (falls back to BALANCE_ALERT_TO / MAIL_DEFAULT_EMAIL)
 *   SEED_ALERT_COOLDOWN_MINUTES=360
 *   SEED_ALERT_STALE_MINUTES=45            (optional — alert if a running worker's progress is stale)
 *   SEED_ALERT_FROM_NAME=ADI L2 Seed Alerts
 *
 * Alerts when no seed-from-db.mjs process is running (any worker A/B/C/…).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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
      // pgrep -af: "12345 node scripts/seed-from-db.mjs --worker B ..."
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
      message: 'No seed-from-db.mjs process is running',
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
          message: `Worker ${w} progress stale (${Math.round(ageMin)} min since last import)`,
          lastImportedAt: progress.lastImportedAt,
          lastClaimNumber: progress.lastClaimNumber,
          range,
        });
      }
    }
  }

  return issues;
}

async function sendAlert(transporter, { issues, processes }) {
  const fromName = process.env.SEED_ALERT_FROM_NAME || 'ADI L2 Seed Alerts';
  const fromEmail = process.env.MAIL_DEFAULT_EMAIL || process.env.MAIL_USER;
  const checkedAt = new Date().toISOString();
  const host = process.env.HOSTNAME || 'eclaim-blockchain-backend';

  const subject =
    issues.length === 1
      ? `[ADI L2] DB seed alert — ${issues[0].message}`
      : `[ADI L2] DB seed alert — ${issues.length} issue(s)`;

  const issueText = issues.map((i) => `- ${i.message}`).join('\n');
  const procText =
    processes.length === 0
      ? '(none)'
      : processes
          .map(
            (p) =>
              `pid=${p.pid} worker=${p.worker || '?'} range=${p.from || '?'}→${p.to || '?'}`,
          )
          .join('\n');

  const text = `DB seed worker alert

Host: ${host}
Checked at: ${checkedAt}

Issues:
${issueText}

Running seed processes:
${procText}

Restart example:
  cd ~/e-claims/eclaim-backend
  nohup node scripts/seed-from-db.mjs --worker A --from ... --to ... --limit 10000 --no-wait >> logs/db-seed-runs-A.log 2>&1 &

Monitor:
  ps -ef | grep seed-from-db
  tail -f logs/db-seed-records-A.log
  node scripts/seed-from-db.mjs --worker A --status
`;

  const issueHtml = issues
    .map(
      (i) =>
        `<li style="margin:0 0 8px 0;color:#c62828;"><strong>${i.message}</strong></li>`,
    )
    .join('');

  const procHtml =
    processes.length === 0
      ? '<p style="color:#c62828;margin:0;">No seed-from-db.mjs process found.</p>'
      : `<pre style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px;overflow:auto;">${processes.map((p) => p.cmd).join('\n')}</pre>`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f8;padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:10px;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #eee;">
      <div style="font-size:18px;font-weight:700;color:#111;">DB seed worker alert</div>
      <div style="font-size:12px;color:#757575;margin-top:4px;">${host} · ${checkedAt}</div>
    </td></tr>
    <tr><td style="padding:20px 24px;">
      <ul style="padding-left:18px;margin:0 0 16px 0;">${issueHtml}</ul>
      <div style="font-size:13px;font-weight:600;color:#424242;margin-bottom:8px;">Running processes</div>
      ${procHtml}
    </td></tr>
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
  console.log('── DB seed worker check ──');
  console.log(`Check:            any seed-from-db.mjs process`);
  console.log(`Alert to:         ${ALERT_TO.join(', ') || '(none)'}`);
  console.log(`Cooldown:         ${COOLDOWN_MIN} min`);
  console.log(`Stale threshold:  ${STALE_MIN > 0 ? `${STALE_MIN} min` : 'off'}`);
  console.log(`Mode:             ${DRY_RUN ? 'dry-run' : FORCE ? 'force' : 'normal'}`);

  if (!ALERT_TO.length) {
    throw new Error('SEED_ALERT_TO (or BALANCE_ALERT_TO / MAIL_DEFAULT_EMAIL) is required');
  }

  const processes = listSeedProcesses();
  console.log(`Running: ${processes.length} seed process(es)`);
  for (const p of processes) {
    console.log(`  pid=${p.pid} worker=${p.worker || '?'} ${p.from || '?'}→${p.to || '?'}`);
    appendLog(`process pid=${p.pid} worker=${p.worker || '?'} cmd=${p.cmd}`);
  }

  const issues = buildIssues(processes);
  if (!issues.length) {
    console.log('OK — seed worker(s) running.');
    appendLog('result=ok');
    return;
  }

  for (const i of issues) {
    console.log(`ISSUE: ${i.message}`);
    appendLog(`issue kind=${i.kind} worker=${i.worker || '-'} msg=${i.message}`);
  }

  const state = loadState();
  if (!shouldAlert(state)) {
    console.log(`Alert suppressed (cooldown ${COOLDOWN_MIN} min). Use --force to re-send.`);
    appendLog(`result=cooldown issues=${issues.length}`);
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

  const info = await sendAlert(transporter, { issues, processes });
  console.log(`Alert sent → ${ALERT_TO.join(', ')}  messageId=${info.messageId || 'n/a'}`);
  appendLog(`result=alerted issues=${issues.length} to=${ALERT_TO.join(',')}`);

  saveState({ lastAlertAt: new Date().toISOString() });
}

main().catch((err) => {
  console.error(err?.message || err);
  appendLog(`result=error ${err?.message || err}`);
  process.exit(1);
});

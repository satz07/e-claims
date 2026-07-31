/**
 * Check native ADI balances for watched wallets; email via SMTP if below threshold.
 *
 * Usage:
 *   node scripts/check-wallet-balances.mjs
 *   node scripts/check-wallet-balances.mjs --dry-run
 *   node scripts/check-wallet-balances.mjs --force   # ignore cooldown
 *
 * Env (.env):
 *   MAIL_*  (SMTP — already configured)
 *   BALANCE_ALERT_THRESHOLD_ADI=20
 *   BALANCE_ALERT_TO=ops@example.com,you@example.com
 *   BALANCE_ALERT_ADDRESSES=0xabc...,0xdef...   (optional; falls back to OWNER_PRIVATE_KEY address)
 *   BALANCE_ALERT_COOLDOWN_MINUTES=360
 *   BALANCE_ALERT_RPC_URL=https://rpc.adifoundation.ai
 *   BALANCE_ALERT_CHAIN_ID=36900
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_DIR = path.join(root, 'logs');
const STATE_FILE = path.join(LOG_DIR, 'balance-alert-state.json');
const RUN_LOG = path.join(LOG_DIR, 'balance-alerts.log');

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
  process.env.BALANCE_ALERT_RPC_URL ||
  'https://rpc.adifoundation.ai';
const CHAIN_ID = Number(process.env.BALANCE_ALERT_CHAIN_ID || 36900);
const THRESHOLD = Number(process.env.BALANCE_ALERT_THRESHOLD_ADI || 20);
const COOLDOWN_MIN = Number(process.env.BALANCE_ALERT_COOLDOWN_MINUTES || 360);
const ALERT_TO = String(process.env.BALANCE_ALERT_TO || process.env.MAIL_DEFAULT_EMAIL || '')
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
  if (!fs.existsSync(STATE_FILE)) return { lastAlertAt: {} };
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { lastAlertAt: data.lastAlertAt || {} };
  } catch {
    return { lastAlertAt: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_FILE);
}

function resolveAddresses() {
  const fromEnv = String(process.env.BALANCE_ALERT_ADDRESSES || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const entry of fromEnv) {
    // Supports "label:0xabc..." or plain "0xabc..."
    let label = 'watched';
    let addr = entry;
    const colon = entry.indexOf(':');
    if (colon > 0 && !entry.slice(0, colon).startsWith('0x')) {
      label = entry.slice(0, colon).trim() || 'watched';
      addr = entry.slice(colon + 1).trim();
    }
    try {
      const checksum = ethers.getAddress(addr);
      if (!seen.has(checksum.toLowerCase())) {
        seen.add(checksum.toLowerCase());
        out.push({ address: checksum, label });
      }
    } catch {
      console.warn(`Invalid address skipped: ${entry}`);
    }
  }

  // Only fall back to OWNER_PRIVATE_KEY when no addresses were configured
  if (out.length === 0) {
    const key = process.env.OWNER_PRIVATE_KEY || process.env.ECLAIM_PRIVATE_KEY || '';
    if (key) {
      try {
        const pk = key.startsWith('0x') ? key : `0x${key}`;
        const w = new ethers.Wallet(pk);
        out.push({ address: w.address, label: 'owner' });
      } catch (err) {
        console.warn(`Could not derive owner address: ${err.message}`);
      }
    }
  }

  return out;
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

function shouldAlert(state, address) {
  if (FORCE) return true;
  const last = state.lastAlertAt[address.toLowerCase()];
  if (!last) return true;
  const ageMs = Date.now() - new Date(last).getTime();
  return ageMs >= COOLDOWN_MIN * 60_000;
}

async function sendAlert(transporter, rows) {
  const fromName =
    process.env.BALANCE_ALERT_FROM_NAME ||
    process.env.MAIL_DEFAULT_NAME ||
    'E-CLAIM Alerts';
  const fromEmail = process.env.MAIL_DEFAULT_EMAIL || process.env.MAIL_USER;
  const lines = rows
    .map(
      (r) =>
        `- ${r.label}: ${r.address}\n  Balance: ${r.adi} ADI (threshold: ${THRESHOLD} ADI)`,
    )
    .join('\n\n');

  const subject = `[E-CLAIM] Low ADI balance — ${rows.length} wallet${rows.length > 1 ? 's' : ''} below ${THRESHOLD} ADI`;
  const text = `E-CLAIM wallet balance alert

One or more watched wallets are below the configured ADI threshold.

Network: ADI Foundation (chain ${CHAIN_ID})
RPC: ${RPC}
Threshold: ${THRESHOLD} ADI
Checked at: ${new Date().toISOString()}

${lines}

Action required: top up these wallets so claim submit and registry transactions can continue.
`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 640px;">
  <h2 style="margin: 0 0 12px; font-size: 18px;">E-CLAIM wallet balance alert</h2>
  <p style="margin: 0 0 16px;">One or more watched wallets are below the configured ADI threshold.</p>
  <table cellpadding="0" cellspacing="0" style="margin: 0 0 16px; font-size: 14px;">
    <tr><td style="padding: 2px 12px 2px 0; color: #555;">Network</td><td>ADI Foundation (chain ${CHAIN_ID})</td></tr>
    <tr><td style="padding: 2px 12px 2px 0; color: #555;">RPC</td><td><code>${RPC}</code></td></tr>
    <tr><td style="padding: 2px 12px 2px 0; color: #555;">Threshold</td><td>${THRESHOLD} ADI</td></tr>
    <tr><td style="padding: 2px 12px 2px 0; color: #555;">Checked at</td><td>${new Date().toISOString()}</td></tr>
  </table>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; border-color: #ccc; width: 100%; font-size: 14px;">
    <thead>
      <tr style="background: #f5f5f5;">
        <th align="left">Label</th>
        <th align="left">Address</th>
        <th align="right">Balance (ADI)</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) =>
            `<tr>
              <td>${r.label}</td>
              <td><code style="font-size: 12px;">${r.address}</code></td>
              <td align="right" style="color: #b00020; font-weight: bold;">${r.adi}</td>
            </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <p style="margin: 16px 0 0;">Action required: top up these wallets so claim submit and registry transactions can continue.</p>
</body>
</html>
`;

  if (DRY_RUN) {
    console.log(`[dry-run] would email → ${ALERT_TO.join(', ')}`);
    console.log(text);
    return { messageId: 'dry-run' };
  }

  return transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: ALERT_TO.join(', '),
    subject,
    text,
    html,
  });
}

async function main() {
  console.log('── Wallet balance alert check ──');
  console.log(`RPC:        ${RPC}`);
  console.log(`Threshold:  ${THRESHOLD} ADI`);
  console.log(`Cooldown:         ${ALERT_TO.join(', ') || '(none)'}`);
  console.log(`Cooldownoldown:   ${COOLDOWN_MIN} min`);
  console.log(`Mode:       ${DRY_RUN ? 'dry-run' : FORCE ? 'force' : 'normal'}`);

  if (!ALERT_TO.length) {
    throw new Error('BALANCE_ALERT_TO (or MAIL_DEFAULT_EMAIL) is required');
  }

  const wallets = resolveAddresses();
  if (!wallets.length) {
    throw new Error(
      'No wallets to check. Set BALANCE_ALERT_ADDRESSES or OWNER_PRIVATE_KEY in .env',
    );
  }

  const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const state = loadState();
  const low = [];

  for (const w of wallets) {
    const bal = await provider.getBalance(w.address);
    const adi = Number(ethers.formatEther(bal));
    const status = adi < THRESHOLD ? 'LOW' : 'ok';
    console.log(`  ${w.address}  ${adi.toFixed(6)} ADI  [${w.label}]  ${status}`);
    appendLog(`${w.address} balance=${adi.toFixed(6)} label=${w.label} status=${status}`);

    if (adi < THRESHOLD) {
      low.push({ ...w, adi: adi.toFixed(6) });
    }
  }

  if (!low.length) {
    console.log('All watched wallets are above threshold.');
    appendLog('result=ok low=0');
    return;
  }

  const toAlert = low.filter((r) => shouldAlert(state, r.address));
  if (!toAlert.length) {
    console.log(
      `${low.length} wallet(s) below threshold, but cooldown active (use --force to re-send).`,
    );
    appendLog(`result=cooldown low=${low.length}`);
    return;
  }

  const transporter = createMailer();
  if (!DRY_RUN) {
    await transporter.verify();
    console.log('SMTP OK');
  }

  const info = await sendAlert(transporter, toAlert);
  console.log(`Alert sent → ${ALERT_TO.join(', ')}  messageId=${info.messageId || 'n/a'}`);
  appendLog(`result=alerted n=${toAlert.length} to=${ALERT_TO.join(',')}`);

  if (!DRY_RUN) {
    const now = new Date().toISOString();
    for (const r of toAlert) {
      state.lastAlertAt[r.address.toLowerCase()] = now;
    }
    saveState(state);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  try {
    appendLog(`FATAL ${err.message || err}`);
  } catch {
    /* ignore */
  }
  process.exit(1);
});

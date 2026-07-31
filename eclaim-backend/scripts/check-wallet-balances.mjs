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

function shortAddr(a) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function explorerUrl(address) {
  return `https://explorer.adifoundation.ai/address/${address}`;
}

/** Email-safe horizontal bar (0–100% of a display max). */
function balanceBar(adiNum, maxForScale) {
  const pct = Math.max(2, Math.min(100, Math.round((adiNum / maxForScale) * 100)));
  const low = adiNum < THRESHOLD;
  const color = low ? '#c62828' : '#2e7d32';
  const track = '#eceff1';
  return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:6px;">
      <tr>
        <td style="background:${track};border-radius:6px;padding:0;">
          <table cellpadding="0" cellspacing="0" width="${pct}%" style="min-width:8px;">
            <tr><td style="background:${color};height:10px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

async function sendAlert(transporter, { allRows, lowRows }) {
  const fromName =
    process.env.BALANCE_ALERT_FROM_NAME ||
    'ADI L2 Operator Alerts';
  const fromEmail = process.env.MAIL_DEFAULT_EMAIL || process.env.MAIL_USER;
  const checkedAt = new Date().toISOString();
  const maxForScale = Math.max(
    THRESHOLD * 2,
    ...allRows.map((r) => Number(r.adi) || 0),
    1,
  );

  const lowNames = lowRows.map((r) => r.label).join(', ');
  const subject = `[ADI L2] Low operator balance — ${lowNames} below ${THRESHOLD} ADI`;

  const textLines = allRows
    .map((r) => {
      const low = Number(r.adi) < THRESHOLD;
      return `${r.label.padEnd(8)}  ${r.adi} ADI  ${low ? 'LOW' : 'OK'}  ${r.address}\n  ${explorerUrl(r.address)}`;
    })
    .join('\n\n');

  const text = `ADI L2 operator balance alert

One or more L2 operator wallets (commit / prove / execute) are below ${THRESHOLD} ADI.

Network: ADI Mainnet (chain ${CHAIN_ID})
RPC: ${RPC}
Threshold: ${THRESHOLD} ADI
Checked at: ${checkedAt}

${textLines}

Please top up the LOW operator wallet(s) so L2 operations can continue.
`;

  const cards = allRows
    .map((r) => {
      const adiNum = Number(r.adi);
      const low = adiNum < THRESHOLD;
      const statusColor = low ? '#c62828' : '#2e7d32';
      const statusBg = low ? '#ffebee' : '#e8f5e9';
      const status = low ? 'LOW' : 'OK';
      const title =
        r.label.charAt(0).toUpperCase() + r.label.slice(1).toLowerCase();
      return `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;">
            <tr>
              <td style="padding:14px 16px;">
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="font-size:15px;font-weight:700;color:#111;">${title} operator</td>
                    <td align="right">
                      <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:${statusColor};background:${statusBg};">${status}</span>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:8px;font-size:26px;font-weight:700;color:${statusColor};letter-spacing:-0.02em;">
                  ${r.adi} <span style="font-size:13px;font-weight:600;color:#757575;">ADI</span>
                </div>
                ${balanceBar(adiNum, maxForScale)}
                <div style="margin-top:8px;font-size:11px;color:#9e9e9e;">
                  Threshold ${THRESHOLD} ADI
                  &nbsp;·&nbsp;
                  <a href="${explorerUrl(r.address)}" style="color:#546e7a;text-decoration:none;">${shortAddr(r.address)}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;">
          <tr>
            <td style="padding:0 4px 18px 4px;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#90a4ae;">ADI Mainnet · L2 operators</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#111;letter-spacing:-0.02em;">Balance alert</div>
              <div style="margin-top:6px;font-size:14px;color:#607d8b;line-height:1.45;">
                ${lowRows.length} operator${lowRows.length > 1 ? 's' : ''} below <b>${THRESHOLD} ADI</b>
                (${lowNames}).
              </div>
            </td>
          </tr>
          ${cards}
          <tr>
            <td style="padding:6px 4px 0 4px;font-size:12px;color:#90a4ae;line-height:1.5;">
              Checked ${checkedAt}<br/>
              RPC ${RPC} · chain ${CHAIN_ID}<br/>
              Please top up LOW operator wallets so L2 commit / prove / execute can continue.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
  console.log('── ADI L2 operator balance check ──');
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
  const allRows = [];
  const low = [];

  for (const w of wallets) {
    const bal = await provider.getBalance(w.address);
    const adi = Number(ethers.formatEther(bal));
    const status = adi < THRESHOLD ? 'LOW' : 'ok';
    const row = { ...w, adi: adi.toFixed(6) };
    allRows.push(row);
    console.log(`  ${w.address}  ${adi.toFixed(6)} ADI  [${w.label}]  ${status}`);
    appendLog(`${w.address} balance=${adi.toFixed(6)} label=${w.label} status=${status}`);

    if (adi < THRESHOLD) {
      low.push(row);
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

  const info = await sendAlert(transporter, { allRows, lowRows: toAlert });
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

/**
 * E-Claims analytics — L3 claim commits, L2 settlement batches, DB import progress.
 * Outputs HTML dashboard (Chart.js), CSV tables, JSON, and Markdown for PPT decks.
 *
 * Usage:
 *   node scripts/generate-eclaims-analytics.mjs
 *   node scripts/generate-eclaims-analytics.mjs --quick        # skip full chain scan
 *   node scripts/generate-eclaims-analytics.mjs --skip-db      # no QA MIS Postgres
 *   node scripts/generate-eclaims-analytics.mjs --out-dir reports
 *
 * Env (.env): APEIRO_RPC_URL, CLAIM_REGISTRY_ADDRESS, CLAIM_DB_*, BACKEND_URL, BALANCE_ALERT_*
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { ethers } from 'ethers';
import ABI from '../src/eclaim-contract/CLAIM_REGISTRY.json' with { type: 'json' };
import ABI_V1 from '../src/eclaim-contract/CLAIM_REGISTRY_V1.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const LOG_DIR = path.join(root, 'logs');

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

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');
const SKIP_DB = args.has('--skip-db');
const outArg = process.argv.find((a, i) => process.argv[i - 1] === '--out-dir');
const OUT_DIR = path.resolve(outArg || path.join(root, 'reports'));

const L3_RPC =
  process.env.APEIRO_RPC_URL ||
  process.env.CHAIN_RPC_URL ||
  process.env.RPC_URL ||
  'https://rpc.apeiro.adifoundation.ai';
const L3_CHAIN_ID = Number(process.env.ECLAIM_CHAIN_ID || process.env.CHAIN_ID || 37001);
const L3_EXPLORER = (
  process.env.CHAIN_EXPLORER_URL || 'https://explorer.apeiro.adifoundation.ai'
).replace(/\/$/, '');
const L3_BLS_EXPLORER = 'https://explorer-bls.apeiro.adifoundation.ai';
const L2_RPC = process.env.BALANCE_ALERT_RPC_URL || 'https://rpc.adifoundation.ai';
const L2_CHAIN_ID = Number(process.env.BALANCE_ALERT_CHAIN_ID || 36900);
const L2_BLS_EXPLORER = 'https://explorer-bls.adifoundation.ai';
const CLAIM_V3 = process.env.CLAIM_REGISTRY_ADDRESS || '';
const CLAIM_V1 = process.env.CLAIM_REGISTRY_V1_ADDRESS || '';
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8001').replace(/\/$/, '');

const DB = {
  host: process.env.CLAIM_DB_HOST,
  port: Number(process.env.CLAIM_DB_PORT || 5432),
  user: process.env.CLAIM_DB_USER,
  password: process.env.CLAIM_DB_PASSWORD,
  database: process.env.CLAIM_DB_NAME || 'claim',
  ssl: process.env.CLAIM_DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

function fmt(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((a / b) * 1000) / 10;
}

function dayKey(isoOrMs) {
  const d = new Date(isoOrMs);
  return d.toISOString().slice(0, 10);
}

async function fetchJson(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchBlsStats(baseUrl, label) {
  try {
    const stats = await fetchJson(`${baseUrl.replace(/\/$/, '')}/api/v2/stats`);
    return {
      label,
      ok: true,
      url: baseUrl,
      totalBlocks: Number(stats.total_blocks || 0),
      totalTransactions: Number(stats.total_transactions || 0),
      transactionsToday: Number(stats.transactions_today || 0),
      totalAddresses: Number(stats.total_addresses || 0),
      gasUsedToday: stats.gas_used_today || '0',
      averageBlockTimeMs: Number(stats.average_block_time || 0),
      networkUtilizationPct: Number(stats.network_utilization_percentage || 0),
    };
  } catch (err) {
    return { label, ok: false, url: baseUrl, error: err.message };
  }
}

async function fetchL3Head() {
  try {
    const provider = new ethers.JsonRpcProvider(L3_RPC, L3_CHAIN_ID, {
      staticNetwork: true,
    });
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    return {
      ok: true,
      rpc: L3_RPC,
      chainId: L3_CHAIN_ID,
      blockNumber,
      blockTimestamp: block?.timestamp
        ? new Date(block.timestamp * 1000).toISOString()
        : null,
    };
  } catch (err) {
    return { ok: false, rpc: L3_RPC, error: err.message };
  }
}

async function fetchL2Head() {
  try {
    const provider = new ethers.JsonRpcProvider(L2_RPC, L2_CHAIN_ID, {
      staticNetwork: true,
    });
    const blockNumber = await provider.getBlockNumber();
    return { ok: true, rpc: L2_RPC, chainId: L2_CHAIN_ID, blockNumber };
  } catch (err) {
    return { ok: false, rpc: L2_RPC, error: err.message };
  }
}

async function fetchBackendHealth() {
  const urls = [
    `${BACKEND}/api/public/integration/health`,
    `${BACKEND}/api/health`,
  ];
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      return { ok: true, url, ...data };
    } catch {
      /* try next */
    }
  }
  return { ok: false, url: BACKEND };
}

async function fetchBackendClaimTotal() {
  try {
    const data = await fetchJson(
      `${BACKEND}/api/public/eclaim-contract?page=0&size=1`,
    );
    return {
      ok: true,
      totalElements: Number(data.totalElements ?? data.total ?? 0),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function scanClaimUpserted() {
  if (QUICK) {
    return { skipped: true, reason: '--quick mode' };
  }
  if (!CLAIM_V3) {
    return { skipped: true, reason: 'CLAIM_REGISTRY_ADDRESS not set' };
  }

  const provider = new ethers.JsonRpcProvider(L3_RPC, L3_CHAIN_ID, {
    staticNetwork: true,
  });
  const latest = await provider.getBlockNumber();
  const CHUNK = 2000;
  const CONCURRENCY = 6;
  const claimNumbers = new Set();
  const claimIdHashes = new Set();
  const txHashes = new Set();
  const byDay = {};
  const blockTsCache = new Map();
  let rawEvents = 0;

  async function blockDay(blockNum) {
    if (blockTsCache.has(blockNum)) return blockTsCache.get(blockNum);
    try {
      const blk = await provider.getBlock(blockNum);
      const dk = blk?.timestamp ? dayKey(blk.timestamp * 1000) : null;
      blockTsCache.set(blockNum, dk);
      return dk;
    } catch {
      blockTsCache.set(blockNum, null);
      return null;
    }
  }

  async function scanContract(address, abiJson, label) {
    if (!address) return;
    const abi = abiJson.abi || abiJson;
    const iface = new ethers.Interface(abi);
    const topic0 = iface.getEvent('ClaimUpserted').topicHash;
    const ranges = [];
    for (let from = 0; from <= latest; from += CHUNK) {
      ranges.push([from, Math.min(from + CHUNK - 1, latest)]);
    }

    for (let i = 0; i < ranges.length; i += CONCURRENCY) {
      const batch = ranges.slice(i, i + CONCURRENCY);
      const parts = await Promise.all(
        batch.map(async ([from, to]) => {
          try {
            return await provider.send('eth_getLogs', [
              {
                address,
                fromBlock: ethers.toBeHex(from),
                toBlock: ethers.toBeHex(to),
                topics: [topic0],
              },
            ]);
          } catch {
            return [];
          }
        }),
      );
      for (const logs of parts) {
        rawEvents += logs.length;
        for (const log of logs) {
          try {
            const parsed = iface.parseLog(log);
            const cn = Number(parsed.args.claimNumber);
            claimNumbers.add(cn);
            claimIdHashes.add(String(parsed.args.claimIdHash).toLowerCase());
            if (log.transactionHash) txHashes.add(log.transactionHash);
            const block = Number(log.blockNumber);
            const dk = await blockDay(block);
            if (dk) byDay[dk] = (byDay[dk] || 0) + 1;
          } catch {
            /* ignore malformed log */
          }
        }
      }
      process.stdout.write(
        `\r  scanning ${label}: block ${Math.min((i + CONCURRENCY) * CHUNK, latest)}/${latest}…`,
      );
    }
    console.log(`\r  ${label}: ${rawEvents} ClaimUpserted log(s) scanned`);
  }

  console.log(`Scanning L3 ClaimUpserted (RPC ${L3_RPC}, head ${latest})…`);
  await scanContract(CLAIM_V3, ABI, 'V3');
  if (CLAIM_V1) await scanContract(CLAIM_V1, ABI_V1, 'V1');

  const dailySeries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    skipped: false,
    latestBlock: latest,
    rawEvents,
    uniqueClaimNumbers: claimNumbers.size,
    uniqueClaimIdHashes: claimIdHashes.size,
    commitTransactions: txHashes.size,
    dailyCommits: dailySeries,
  };
}

function loadSeedProgressFiles() {
  const workers = [];
  if (!fs.existsSync(LOG_DIR)) return workers;

  const names = fs
    .readdirSync(LOG_DIR)
    .filter((n) => n === 'db-seed-progress.json' || /^db-seed-progress-.+\.json$/.test(n));

  for (const name of names) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(LOG_DIR, name), 'utf8'));
      const worker =
        name === 'db-seed-progress.json'
          ? 'default'
          : name.replace(/^db-seed-progress-/, '').replace(/\.json$/, '');
      workers.push({
        worker,
        file: name,
        lastClaimNumber: Number(data.lastClaimNumber || 0),
        lastImportedAt: data.lastImportedAt || null,
        claimsOk: Number(data.totals?.claimsOk || 0),
        preauthsOk: Number(data.totals?.preauthsOk || 0),
        errors: Number(data.totals?.errors || 0),
        skipped: Number(data.totals?.skipped || 0),
        range: data.range || null,
      });
    } catch {
      /* ignore */
    }
  }
  return workers.sort((a, b) => a.worker.localeCompare(b.worker));
}

function loadSeedRecordsStats() {
  const byDay = {};
  let ok = 0;
  let dup = 0;
  let err = 0;
  if (!fs.existsSync(LOG_DIR)) return { ok, dup, err, byDay: [] };

  for (const name of fs.readdirSync(LOG_DIR)) {
    if (!name.startsWith('db-seed-records') || !name.endsWith('.log')) continue;
    const text = fs.readFileSync(path.join(LOG_DIR, name), 'utf8');
    for (const line of text.split('\n')) {
      const tsM = /^(\d{4}-\d{2}-\d{2})/.exec(line);
      const dk = tsM?.[1] || null;
      if (/\bOK\b/.test(line)) {
        ok++;
        if (dk) byDay[dk] = (byDay[dk] || 0) + 1;
      } else if (/\bDUP\b/.test(line)) dup++;
      else if (/\bERR\b/.test(line)) err++;
    }
  }

  const dailySeries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { ok, dup, err, byDay: dailySeries };
}

function loadChainTxStats() {
  const byDay = {};
  let totalFeeAdi = 0;
  let txCount = 0;
  if (!fs.existsSync(LOG_DIR)) return { txCount, totalFeeAdi, byDay: [] };

  for (const name of fs.readdirSync(LOG_DIR)) {
    if (!name.startsWith('chain-tx-') || !name.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(LOG_DIR, name), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        txCount++;
        const fee = Number(row.feePaidAdi || 0);
        if (fee) totalFeeAdi += fee;
        const dk = dayKey(row.timestamp || Date.now());
        byDay[dk] = (byDay[dk] || 0) + 1;
      } catch {
        /* ignore */
      }
    }
  }

  const dailySeries = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return {
    txCount,
    totalFeeAdi: Math.round(totalFeeAdi * 10000) / 10000,
    avgFeeAdi: txCount ? Math.round((totalFeeAdi / txCount) * 10000) / 10000 : 0,
    byDay: dailySeries,
  };
}

async function fetchDbStats() {
  if (SKIP_DB || !DB.password) {
    return { skipped: true, reason: SKIP_DB ? '--skip-db' : 'CLAIM_DB_PASSWORD not set' };
  }
  const client = new pg.Client(DB);
  await client.connect();
  try {
    const totals = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE c.use = 'Claim') AS total_claims,
        COUNT(*) FILTER (WHERE c.use = 'Preauthorization') AS total_preauths,
        COUNT(*) AS total_eligible,
        MIN(c.claim_number) AS min_claim_number,
        MAX(c.claim_number) AS max_claim_number
      FROM claims c
      JOIN provider pr ON pr.id = c.provider
      JOIN patient p ON p.id = c.patient
      WHERE pr.fid_code IS NOT NULL AND pr.fid_code <> ''
        AND p.cr_id IS NOT NULL AND p.cr_id <> ''
        AND c.use IN ('Claim', 'Preauthorization')
    `);
    const row = totals.rows[0];
    return {
      skipped: false,
      totalClaims: Number(row.total_claims),
      totalPreauths: Number(row.total_preauths),
      totalEligible: Number(row.total_eligible),
      minClaimNumber: Number(row.min_claim_number),
      maxClaimNumber: Number(row.max_claim_number),
    };
  } finally {
    await client.end();
  }
}

function mergeDailySeries(...seriesList) {
  const map = new Map();
  for (const series of seriesList) {
    for (const { date, count } of series || []) {
      map.set(date, (map.get(date) || 0) + count);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function buildSummaryTable(data) {
  const workers = data.seed.workers;
  const importedClaims = workers.reduce((s, w) => s + w.claimsOk, 0);
  const importedPreauths = workers.reduce((s, w) => s + w.preauthsOk, 0);
  const importedTotal = importedClaims + importedPreauths;
  const onChain =
    data.chainScan.uniqueClaimNumbers ||
    data.backendClaims.totalElements ||
    importedTotal;
  const dbTotal = data.db.totalEligible || null;
  const progressPct = dbTotal ? pct(onChain, dbTotal) : null;

  return [
    {
      category: 'L3 — Application layer (Apeiro)',
      metric: 'Chain ID / network',
      value: `${L3_CHAIN_ID} · Apeiro L3`,
    },
    {
      category: 'L3 — Application layer (Apeiro)',
      metric: 'Current L3 block height',
      value: fmt(data.l3Head.blockNumber),
    },
    {
      category: 'L3 — Application layer (Apeiro)',
      metric: 'ClaimRegistry contract',
      value: CLAIM_V3 || '—',
    },
    {
      category: 'L3 — Claim commits',
      metric: 'Unique claims anchored (ClaimUpserted)',
      value: fmt(onChain),
    },
    {
      category: 'L3 — Claim commits',
      metric: 'L3 commit transactions (unique tx hashes)',
      value: fmt(
        data.chainScan.commitTransactions ??
          (data.chainScan.skipped ? data.chainTx.txCount : null),
      ),
    },
    {
      category: 'L3 — Claim commits',
      metric: 'Claims imported (seed logs)',
      value: fmt(importedClaims),
    },
    {
      category: 'L3 — Claim commits',
      metric: 'Pre-auths imported (seed logs)',
      value: fmt(importedPreauths),
    },
    {
      category: 'L3 — Claim commits',
      metric: 'Import errors (seed logs)',
      value: fmt(workers.reduce((s, w) => s + w.errors, 0)),
    },
    {
      category: 'L3 — QA MIS database',
      metric: 'Total eligible claims + pre-auths',
      value: dbTotal != null ? fmt(dbTotal) : '— (DB not connected)',
    },
    {
      category: 'L3 — QA MIS database',
      metric: 'Import progress vs eligible DB rows',
      value: progressPct != null ? `${progressPct}%` : '—',
    },
    {
      category: 'L3 — QA MIS database',
      metric: 'Claim number range in DB',
      value:
        dbTotal != null
          ? `${fmt(data.db.minClaimNumber)} → ${fmt(data.db.maxClaimNumber)}`
          : '—',
    },
    {
      category: 'L2 — Settlement layer (BLS)',
      metric: 'Apeiro L2 settlement blocks (BLS explorer)',
      value: data.l3Bls.ok ? fmt(data.l3Bls.totalBlocks) : '—',
    },
    {
      category: 'L2 — Settlement layer (BLS)',
      metric: 'Apeiro L2 settlement transactions (BLS)',
      value: data.l3Bls.ok ? fmt(data.l3Bls.totalTransactions) : '—',
    },
    {
      category: 'L2 — Settlement layer (BLS)',
      metric: 'ADI Mainnet L2 blocks (BLS explorer)',
      value: data.l2Bls.ok ? fmt(data.l2Bls.totalBlocks) : '—',
    },
    {
      category: 'L2 — Settlement layer (BLS)',
      metric: 'ADI Mainnet L2 transactions (BLS)',
      value: data.l2Bls.ok ? fmt(data.l2Bls.totalTransactions) : '—',
    },
    {
      category: 'L2 — Settlement layer (BLS)',
      metric: 'ADI Mainnet L2 block height (RPC)',
      value: data.l2Head.ok ? fmt(data.l2Head.blockNumber) : '—',
    },
    {
      category: 'Cost & operations',
      metric: 'Gas spent (chain-tx audit logs, ADI)',
      value: data.chainTx.txCount
        ? `${data.chainTx.totalFeeAdi} ADI (${fmt(data.chainTx.txCount)} txs)`
        : '—',
    },
    {
      category: 'Cost & operations',
      metric: 'Avg gas per anchor tx (audit logs)',
      value: data.chainTx.txCount ? `${data.chainTx.avgFeeAdi} ADI` : '—',
    },
    {
      category: 'Cost & operations',
      metric: 'Backend health',
      value: data.backendHealth.ok ? 'Healthy' : 'Unreachable',
    },
  ];
}

function csvEscape(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(filePath, rows) {
  const header = 'Category,Metric,Value\n';
  const body = rows
    .map((r) => [r.category, r.metric, r.value].map(csvEscape).join(','))
    .join('\n');
  fs.writeFileSync(filePath, header + body + '\n');
}

function writeMarkdown(filePath, rows, data) {
  const stamp = new Date().toISOString().slice(0, 10);
  let md = `# E-Claims Analytics — ${stamp}\n\n`;
  md += `> L3 claim commits on Apeiro · L2 settlement batches via BLS explorer · QA MIS import progress\n\n`;
  md += `## Executive summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  for (const r of rows.filter((x) =>
    [
      'Unique claims anchored (ClaimUpserted)',
      'Total eligible claims + pre-auths',
      'Import progress vs eligible DB rows',
      'Apeiro L2 settlement blocks (BLS explorer)',
      'ADI Mainnet L2 blocks (BLS explorer)',
    ].includes(x.metric),
  )) {
    md += `| ${r.metric} | **${r.value}** |\n`;
  }
  md += `\n## Full metrics\n\n| Category | Metric | Value |\n|----------|--------|-------|\n`;
  for (const r of rows) {
    md += `| ${r.category} | ${r.metric} | ${r.value} |\n`;
  }
  md += `\n## Worker import status\n\n`;
  if (data.seed.workers.length) {
    md += `| Worker | Claims OK | Preauths OK | Errors | Last claim # | Last import |\n`;
    md += `|--------|-----------|-------------|--------|--------------|-------------|\n`;
    for (const w of data.seed.workers) {
      md += `| ${w.worker} | ${fmt(w.claimsOk)} | ${fmt(w.preauthsOk)} | ${fmt(w.errors)} | ${fmt(w.lastClaimNumber)} | ${w.lastImportedAt || '—'} |\n`;
    }
  } else {
    md += `_No seed progress files found in logs/_\n`;
  }
  md += `\n## Architecture (for slides)\n\n`;
  md += `\`\`\`\nQA MIS DB → E-Claims Backend → L3 ClaimRegistry (Apeiro)\n                              ↓ commit batches\n                         L2 ADI settlement (BLS)\n                              ↓ ZK proofs\n                         L1 Ethereum finality\n\`\`\`\n`;
  fs.writeFileSync(filePath, md);
}

function writeHtml(filePath, rows, data, charts) {
  const stamp = new Date().toISOString().slice(0, 10);
  const title = `E-Claims Analytics — ${stamp}`;
  const importedClaims = data.seed.workers.reduce((s, w) => s + w.claimsOk, 0);
  const importedPreauths = data.seed.workers.reduce((s, w) => s + w.preauthsOk, 0);
  const onChain =
    data.chainScan.uniqueClaimNumbers ||
    data.backendClaims.totalElements ||
    importedClaims + importedPreauths;
  const dbTotal = data.db.totalEligible || 0;
  const remaining = dbTotal ? Math.max(0, dbTotal - onChain) : null;

  const kpiCards = [
    { label: 'Claims anchored (L3)', value: fmt(onChain), sub: 'ClaimUpserted on Apeiro' },
    {
      label: 'DB import progress',
      value: dbTotal ? `${pct(onChain, dbTotal)}%` : '—',
      sub: dbTotal ? `${fmt(onChain)} / ${fmt(dbTotal)} eligible` : 'Connect QA DB',
    },
    {
      label: 'L3 commit transactions',
      value: fmt(data.chainScan.commitTransactions || data.chainTx.txCount || '—'),
      sub: 'Unique upsertClaim txs',
    },
    {
      label: 'L2 settlement blocks',
      value: data.l3Bls.ok ? fmt(data.l3Bls.totalBlocks) : '—',
      sub: 'Apeiro BLS explorer',
    },
    {
      label: 'L2 parent chain blocks',
      value: data.l2Bls.ok ? fmt(data.l2Bls.totalBlocks) : '—',
      sub: 'ADI Mainnet BLS',
    },
    {
      label: 'Gas spent (audit logs)',
      value: data.chainTx.txCount ? `${data.chainTx.totalFeeAdi} ADI` : '—',
      sub: data.chainTx.txCount ? `avg ${data.chainTx.avgFeeAdi} ADI/tx` : 'No chain-tx logs',
    },
  ];

  const tableRows = rows
    .map(
      (r) =>
        `<tr><td>${r.category}</td><td>${r.metric}</td><td><strong>${r.value}</strong></td></tr>`,
    )
    .join('\n');

  const workerRows = data.seed.workers
    .map(
      (w) =>
        `<tr><td>${w.worker}</td><td>${fmt(w.claimsOk)}</td><td>${fmt(w.preauthsOk)}</td><td>${fmt(w.errors)}</td><td>${fmt(w.lastClaimNumber)}</td><td>${w.lastImportedAt || '—'}</td></tr>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --accent:#4fc3f7; --green:#66bb6a; --orange:#ffa726; --text:#eceff1; --muted:#90a4ae; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text); padding:24px; }
    h1 { margin:0 0 4px; font-size:1.75rem; }
    .sub { color:var(--muted); margin-bottom:24px; font-size:0.95rem; }
    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px; margin-bottom:28px; }
    .kpi { background:var(--card); border-radius:12px; padding:18px; border-left:4px solid var(--accent); }
    .kpi .label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); }
    .kpi .value { font-size:1.8rem; font-weight:700; margin:6px 0; }
    .kpi .sub { font-size:0.8rem; color:var(--muted); }
    .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:20px; margin-bottom:28px; }
    .chart-card { background:var(--card); border-radius:12px; padding:20px; }
    .chart-card h3 { margin:0 0 12px; font-size:1rem; color:var(--accent); }
    .chart-wrap { position:relative; height:260px; }
    table { width:100%; border-collapse:collapse; font-size:0.85rem; }
    th,td { padding:10px 12px; text-align:left; border-bottom:1px solid #263238; }
    th { color:var(--muted); font-weight:600; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.05em; }
    .section { background:var(--card); border-radius:12px; padding:20px; margin-bottom:20px; }
    .section h2 { margin:0 0 16px; font-size:1.1rem; }
    .arch { font-family:monospace; background:#0d1117; padding:16px; border-radius:8px; line-height:1.6; font-size:0.85rem; color:#81d4fa; }
    .footer { color:var(--muted); font-size:0.75rem; margin-top:24px; }
    @media print { body { background:#fff; color:#111; } .kpi,.chart-card,.section { break-inside:avoid; border:1px solid #ddd; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="sub">E-Claims blockchain analytics · L3 claim commits · L2 settlement batches · QA MIS import · Generated ${new Date().toISOString()}</p>

  <div class="kpi-grid">
    ${kpiCards.map((k) => `<div class="kpi"><div class="label">${k.label}</div><div class="value">${k.value}</div><div class="sub">${k.sub}</div></div>`).join('\n')}
  </div>

  <div class="charts">
    <div class="chart-card"><h3>Import progress (L3 vs QA DB)</h3><div class="chart-wrap"><canvas id="progressChart"></canvas></div></div>
    <div class="chart-card"><h3>Claims vs pre-auths imported</h3><div class="chart-wrap"><canvas id="typeChart"></canvas></div></div>
    <div class="chart-card"><h3>Daily L3 commits (import log)</h3><div class="chart-wrap"><canvas id="dailyChart"></canvas></div></div>
    <div class="chart-card"><h3>L2 / L3 network activity</h3><div class="chart-wrap"><canvas id="networkChart"></canvas></div></div>
    <div class="chart-card"><h3>Worker import totals</h3><div class="chart-wrap"><canvas id="workerChart"></canvas></div></div>
    <div class="chart-card"><h3>Settlement stack (blocks)</h3><div class="chart-wrap"><canvas id="settlementChart"></canvas></div></div>
  </div>

  <div class="section">
    <h2>L3 → L2 → L1 settlement flow</h2>
    <div class="arch">QA MIS Postgres (claims + pre-auths)
    ↓ seed-from-db.mjs / API submit
E-Claims Backend (NestJS) → upsertClaim / upsertClaims
    ↓ L3 execution (Apeiro chain ${L3_CHAIN_ID})
ClaimRegistry · ClaimUpserted events · ${fmt(onChain)} anchors
    ↓ batch commit (ZK rollup)
L2 ADI settlement · ${data.l3Bls.ok ? fmt(data.l3Bls.totalBlocks) : '?'} BLS blocks · ${data.l3Bls.ok ? fmt(data.l3Bls.totalTransactions) : '?'} txs
    ↓ validity proofs
ADI Mainnet L2 · ${data.l2Bls.ok ? fmt(data.l2Bls.totalBlocks) : '?'} blocks
    ↓
Ethereum L1 finality</div>
  </div>

  <div class="section">
    <h2>Worker import status</h2>
    <table>
      <thead><tr><th>Worker</th><th>Claims OK</th><th>Preauths OK</th><th>Errors</th><th>Last claim #</th><th>Last import</th></tr></thead>
      <tbody>${workerRows || '<tr><td colspan="6">No worker progress files</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Full metrics table (copy to PPT / Excel)</h2>
    <table>
      <thead><tr><th>Category</th><th>Metric</th><th>Value</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <p class="footer">Sources: Apeiro RPC ${L3_RPC} · BLS explorers · seed progress logs · ${dbTotal ? 'QA MIS Postgres' : 'DB skipped'} · Run: node scripts/generate-eclaims-analytics.mjs</p>

  <script>
    const charts = ${JSON.stringify(charts)};
    Chart.defaults.color = '#90a4ae';
    Chart.defaults.borderColor = '#263238';

    new Chart(document.getElementById('progressChart'), {
      type: 'doughnut',
      data: {
        labels: ['Anchored on L3', 'Remaining in DB'],
        datasets: [{ data: [${onChain}, ${remaining ?? 0}], backgroundColor: ['#4fc3f7','#37474f'] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    new Chart(document.getElementById('typeChart'), {
      type: 'pie',
      data: {
        labels: ['Claims', 'Pre-auths'],
        datasets: [{ data: [${importedClaims}, ${importedPreauths}], backgroundColor: ['#66bb6a','#ffa726'] }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    const dailyLabels = charts.daily.map(d => d.date);
    const dailyData = charts.daily.map(d => d.count);
    new Chart(document.getElementById('dailyChart'), {
      type: 'bar',
      data: { labels: dailyLabels, datasets: [{ label: 'Commits / day', data: dailyData, backgroundColor: '#4fc3f7' }] },
      options: { scales: { x: { ticks: { maxRotation: 45 } } }, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('networkChart'), {
      type: 'bar',
      data: {
        labels: ['L3 block height', 'L3 BLS txs', 'ADI L2 blocks', 'ADI L2 txs'],
        datasets: [{
          label: 'Count',
          data: [${data.l3Head.blockNumber || 0}, ${data.l3Bls.totalTransactions || 0}, ${data.l2Bls.totalBlocks || 0}, ${data.l2Bls.totalTransactions || 0}],
          backgroundColor: ['#4fc3f7','#29b6f6','#ab47bc','#ce93d8']
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });

    const workerLabels = charts.workers.map(w => w.worker);
    new Chart(document.getElementById('workerChart'), {
      type: 'bar',
      data: {
        labels: workerLabels,
        datasets: [
          { label: 'Claims', data: charts.workers.map(w => w.claimsOk), backgroundColor: '#66bb6a' },
          { label: 'Pre-auths', data: charts.workers.map(w => w.preauthsOk), backgroundColor: '#ffa726' }
        ]
      },
      options: { scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    new Chart(document.getElementById('settlementChart'), {
      type: 'bar',
      data: {
        labels: ['Apeiro L2 settlement blocks', 'ADI Mainnet L2 blocks', 'ADI L2 RPC head'],
        datasets: [{
          data: [${data.l3Bls.totalBlocks || 0}, ${data.l2Bls.totalBlocks || 0}, ${data.l2Head.blockNumber || 0}],
          backgroundColor: ['#4fc3f7','#ab47bc','#78909c']
        }]
      },
      options: { plugins: { legend: { display: false } } }
    });
  </script>
</body>
</html>`;
  fs.writeFileSync(filePath, html);
}

async function main() {
  console.log('── E-Claims analytics ──');
  console.log(`L3 RPC:     ${L3_RPC}`);
  console.log(`L2 RPC:     ${L2_RPC}`);
  console.log(`Output:     ${OUT_DIR}`);
  console.log(`Mode:       ${QUICK ? 'quick (skip chain scan)' : 'full'}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const [l3Head, l2Head, l3Bls, l2Bls, backendHealth, backendClaims, db] =
    await Promise.all([
      fetchL3Head(),
      fetchL2Head(),
      fetchBlsStats(L3_BLS_EXPLORER, 'Apeiro L2 settlement (BLS)'),
      fetchBlsStats(L2_BLS_EXPLORER, 'ADI Mainnet L2 (BLS)'),
      fetchBackendHealth(),
      fetchBackendClaimTotal(),
      fetchDbStats().catch((e) => ({ skipped: true, error: e.message })),
    ]);

  console.log(`L3 head:    ${l3Head.ok ? l3Head.blockNumber : l3Head.error}`);
  console.log(`L2 head:    ${l2Head.ok ? l2Head.blockNumber : l2Head.error}`);
  console.log(
    `L3 BLS:     ${l3Bls.ok ? `${fmt(l3Bls.totalBlocks)} blocks, ${fmt(l3Bls.totalTransactions)} txs` : l3Bls.error}`,
  );
  console.log(
    `L2 BLS:     ${l2Bls.ok ? `${fmt(l2Bls.totalBlocks)} blocks, ${fmt(l2Bls.totalTransactions)} txs` : l2Bls.error}`,
  );

  const seed = {
    workers: loadSeedProgressFiles(),
    records: loadSeedRecordsStats(),
  };
  const chainTx = loadChainTxStats();
  const chainScan = await scanClaimUpserted().catch((e) => ({
    skipped: true,
    error: e.message,
  }));

  const data = {
    generatedAt: new Date().toISOString(),
    l3Head,
    l2Head,
    l3Bls,
    l2Bls,
    backendHealth,
    backendClaims,
    db,
    seed,
    chainTx,
    chainScan,
  };

  const summaryRows = buildSummaryTable(data);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = path.join(OUT_DIR, `eclaims-analytics-${stamp}`);

  const daily = mergeDailySeries(
    chainScan.dailyCommits,
    seed.records.byDay,
    chainTx.byDay,
  );

  writeCsv(`${base}.csv`, summaryRows);
  writeMarkdown(`${base}.md`, summaryRows, data);
  writeHtml(`${base}.html`, summaryRows, data, {
    daily,
    workers: seed.workers,
  });
  fs.writeFileSync(`${base}.json`, JSON.stringify(data, null, 2));

  console.log('\n── Done ──');
  console.log(`HTML dashboard:  ${base}.html  ← open in browser, screenshot for PPT`);
  console.log(`CSV (Excel/PPT): ${base}.csv`);
  console.log(`Markdown tables: ${base}.md`);
  console.log(`Raw JSON:        ${base}.json`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

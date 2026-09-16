/**
 * Generate management presentation HTML from live operations dashboard.
 *
 * Usage:
 *   node operations-dashboard/scripts/generate-presentation.mjs
 *   node operations-dashboard/scripts/generate-presentation.mjs --url https://eclaim-api.apeiro-digital.com/operation
 *
 * Output: operations-dashboard/presentation/eclaims-management-deck.html
 * Open in browser → Print to PDF or screenshot slides into PowerPoint
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'presentation');
const outFile = path.join(outDir, 'eclaims-management-deck.html');

const urlArg = process.argv.find((a, i) => process.argv[i - 1] === '--url');
const BASE = (urlArg || 'https://eclaim-api.apeiro-digital.com/operation').replace(/\/$/, '');

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

function pct(part, total) {
  if (!total) return '—';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

async function fetchSnapshot() {
  const res = await fetch(`${BASE}/api/snapshot`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function statusLabel(s) {
  if (s === 'healthy') return { text: 'Healthy', color: '#2e7d32' };
  if (s === 'watch') return { text: 'Watch', color: '#f9a825' };
  return { text: 'Action Required', color: '#c62828' };
}

function buildHtml(data) {
  const l3 = data.chains.l3;
  const l2 = data.chains.l2;
  const ec = data.eclaims;
  const ops = data.settlement?.operators || [];
  const commit = ops.find((o) => o.label === 'commit');
  const prove = ops.find((o) => o.label === 'prove');
  const execute = ops.find((o) => o.label === 'execute');
  const overall = statusLabel(data.overallStatus);
  const date = new Date(data.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const registryLabels = ec.registries?.map((r) => r.name.replace(' Registry', '')) || [];
  const registryTxs = ec.registries?.map((r) => r.counters?.transactionsCount || 0) || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>E-Claims Blockchain Operations — Management Briefing</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    @page { size: landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #111; color: #fff; }
    .slide {
      width: 100vw; height: 100vh; padding: 48px 64px;
      display: flex; flex-direction: column; justify-content: center;
      page-break-after: always; position: relative; overflow: hidden;
    }
    .slide::before {
      content: ''; position: absolute; top: 0; right: 0; width: 40%; height: 100%;
      background: linear-gradient(135deg, transparent 60%, rgba(79,195,247,.08));
      pointer-events: none;
    }
    .tag { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #4fc3f7; margin-bottom: 12px; }
    h1 { font-size: 2.6rem; font-weight: 700; line-height: 1.15; margin-bottom: 16px; }
    h2 { font-size: 1.6rem; font-weight: 600; margin-bottom: 24px; color: #4fc3f7; }
    .sub { font-size: 1.1rem; color: #90a4ae; max-width: 720px; line-height: 1.5; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 32px; }
    .kpi { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 20px; }
    .kpi .n { font-size: 2.2rem; font-weight: 700; color: #4fc3f7; }
    .kpi .l { font-size: .8rem; color: #90a4ae; margin-top: 6px; text-transform: uppercase; letter-spacing: .05em; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; margin-top: 20px; }
    .chart-box { height: 280px; }
    table { width: 100%; border-collapse: collapse; font-size: .95rem; margin-top: 16px; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.1); }
    th { color: #90a4ae; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
    .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600; }
    .arch { font-family: monospace; font-size: .85rem; line-height: 1.8; background: rgba(0,0,0,.3); padding: 24px; border-radius: 12px; color: #81d4fa; }
    .footer { position: absolute; bottom: 24px; left: 64px; right: 64px; font-size: .75rem; color: #546e7a; display: flex; justify-content: space-between; }
    .title-slide { background: linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d2137 100%); }
    .accent { color: #4fc3f7; }
    ul.bullets { margin: 16px 0 0 24px; line-height: 1.8; color: #cfd8dc; font-size: 1rem; }
    @media print {
      body { background: #fff; color: #111; }
      .slide { height: 100vh; background: #fff !important; color: #111; }
      .kpi { background: #f5f5f5; border-color: #ddd; }
      .kpi .n { color: #1565c0; }
      .arch { background: #f5f5f5; color: #333; }
      h2 { color: #1565c0; }
    }
  </style>
</head>
<body>

<!-- SLIDE 1: Title -->
<section class="slide title-slide">
  <div class="tag">SHA E-Claims Programme · ADI Blockchain</div>
  <h1>E-Claims On-Chain<br/>Operations Briefing</h1>
  <p class="sub">Live metrics from Apeiro L3 claim anchoring, ADI L2 settlement, and registry health.<br/>Data as of ${date} · Source: <a href="${BASE}/" style="color:#4fc3f7">${BASE}/</a></p>
  <div class="footer"><span>Apeiro Digital · E-Claims Platform</span><span>Confidential</span></div>
</section>

<!-- SLIDE 2: Executive Summary -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Executive summary</div>
  <h2>Platform at a Glance</h2>
  <div class="kpis">
    <div class="kpi"><div class="n">${fmt(ec.claimsAnchored)}</div><div class="l">Claims anchored on L3</div></div>
    <div class="kpi"><div class="n">${fmt(l3.totalTransactions)}</div><div class="l">L3 chain transactions</div></div>
    <div class="kpi"><div class="n">${fmt(l2.totalBlocks)}</div><div class="l">ADI L2 settlement blocks</div></div>
    <div class="kpi"><div class="n" style="color:${overall.color}">${overall.text}</div><div class="l">Overall status</div></div>
  </div>
  <ul class="bullets">
    <li><strong>${fmt(ec.claimsAnchored)}</strong> unique claims &amp; pre-auths cryptographically anchored on Apeiro L3 (ClaimRegistry)</li>
    <li><strong>${fmt(ec.commitTransactions)}</strong> on-chain commit transactions — verifiable on <a href="${l3.explorerUi}" style="color:#4fc3f7">Apeiro Explorer</a></li>
    <li>L3 activity settled to ADI Mainnet L2 — <strong>${fmt(commit?.nonce)}</strong> commit / <strong>${fmt(prove?.nonce)}</strong> prove / <strong>${fmt(execute?.nonce)}</strong> execute batches</li>
    <li>Zero PHI on-chain — only hashes, amounts, and dates stored; full FHIR payloads remain off-chain</li>
  </ul>
  <div class="footer"><span>Slide 2 · Executive Summary</span><span>${date}</span></div>
</section>

<!-- SLIDE 3: Architecture -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Architecture</div>
  <h2>L3 → L2 → L1 Settlement Stack</h2>
  <div class="arch">
QA MIS Database (claims + pre-auths)
        ↓ FHIR extract &amp; hash
E-Claims Backend API  →  upsertClaim / upsertClaims
        ↓ L3 execution (Apeiro · Chain ${l3.chainId})
ClaimRegistry · ${fmt(ec.claimsAnchored)} ClaimUpserted events
        ↓ ZK batch commit
ADI Mainnet L2 · ${fmt(l2.totalBlocks)} blocks · ${fmt(l2.totalTransactions)} txs
        ↓ validity proofs
Ethereum L1 finality
  </div>
  <ul class="bullets" style="margin-top:24px">
    <li><strong>Soft confirmation</strong> on L3 within seconds — operational use immediately</li>
    <li><strong>Strong confirmation</strong> builds as batches are proved on L2 and settled on L1</li>
    <li>Independent verification via public block explorers — no trust in a single organisation</li>
  </ul>
  <div class="footer"><span>Slide 3 · Architecture</span><span>${date}</span></div>
</section>

<!-- SLIDE 4: L3 Network -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Apeiro L3 · Chain ${l3.chainId}</div>
  <h2>Layer 3 — Application Network</h2>
  <div class="grid2">
    <div>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Block height</td><td><strong>${fmt(l3.blockHeight)}</strong></td></tr>
        <tr><td>Total transactions</td><td><strong>${fmt(l3.totalTransactions)}</strong></td></tr>
        <tr><td>Transactions today</td><td>${fmt(l3.transactionsToday)}</td></tr>
        <tr><td>Total blocks</td><td>${fmt(l3.totalBlocks)}</td></tr>
        <tr><td>Avg block interval</td><td>${l3.avgBlockSec || '—'}s</td></tr>
        <tr><td>Gas price</td><td>${l3.gasPriceGwei ?? '—'} Gwei</td></tr>
      </table>
    </div>
    <div class="chart-box"><canvas id="l3Chart"></canvas></div>
  </div>
  <div class="footer"><span>Slide 4 · L3 Network</span><span>explorer.apeiro.adifoundation.ai</span></div>
</section>

<!-- SLIDE 5: Claims -->
<section class="slide" style="background:#0f1419">
  <div class="tag">E-Claims anchoring</div>
  <h2>Claims On-Chain — ${fmt(ec.claimsAnchored)} Anchored</h2>
  <div class="grid2">
    <div>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Unique claims anchored</td><td><strong>${fmt(ec.claimsAnchored)}</strong></td></tr>
        <tr><td>Commit transactions</td><td>${fmt(ec.commitTransactions)}</td></tr>
        <tr><td>Raw ClaimUpserted events</td><td>${fmt(ec.rawEvents)}</td></tr>
        <tr><td>Data source</td><td>${ec.claimsSource || 'on-chain'}</td></tr>
        <tr><td>Claims per commit tx</td><td>~${ec.commitTransactions ? (ec.claimsAnchored / ec.commitTransactions).toFixed(2) : '—'}</td></tr>
      </table>
      <p style="margin-top:16px;color:#90a4ae;font-size:.9rem">Each anchor stores claim hash, amount, date &amp; status — tamper-evident proof of submission without exposing patient data.</p>
    </div>
    <div class="chart-box"><canvas id="claimsChart"></canvas></div>
  </div>
  <div class="footer"><span>Slide 5 · Claims Anchored</span><span>${date}</span></div>
</section>

<!-- SLIDE 6: Registries -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Smart contracts</div>
  <h2>Registry Contract Activity</h2>
  <div class="grid2">
    <div class="chart-box"><canvas id="registryChart"></canvas></div>
    <div>
      <table>
        <tr><th>Contract</th><th>Indexed Txs</th></tr>
        ${(ec.registries || []).map((r) => `<tr><td>${r.name}</td><td><strong>${fmt(r.counters?.transactionsCount)}</strong></td></tr>`).join('')}
      </table>
    </div>
  </div>
  <div class="footer"><span>Slide 6 · Registries</span><span>${date}</span></div>
</section>

<!-- SLIDE 7: L2 Settlement -->
<section class="slide" style="background:#0f1419">
  <div class="tag">ADI Mainnet L2 · Chain ${l2.chainId}</div>
  <h2>Layer 2 — Settlement &amp; Operator Pipeline</h2>
  <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><div class="n">${fmt(commit?.nonce)}</div><div class="l">Commit batches</div></div>
    <div class="kpi"><div class="n">${fmt(prove?.nonce)}</div><div class="l">Prove batches</div></div>
    <div class="kpi"><div class="n">${fmt(execute?.nonce)}</div><div class="l">Execute batches</div></div>
  </div>
  <table style="margin-top:24px">
    <tr><th>Operator</th><th>Balance (ADI)</th><th>Outbound Txs</th><th>Status</th></tr>
    ${ops.map((o) => {
      const st = statusLabel(o.status === 'critical' ? 'action_required' : o.status === 'watch' ? 'watch' : 'healthy');
      return `<tr><td>${o.label}</td><td><strong>${o.balanceAdi?.toFixed(2) ?? '—'}</strong></td><td>${fmt(o.nonce)}</td><td><span class="pill" style="background:${st.color}22;color:${st.color}">${st.text}</span></td></tr>`;
    }).join('')}
  </table>
  <div class="footer"><span>Slide 7 · L2 Settlement</span><span>${fmt(l2.totalBlocks)} L2 blocks · ${fmt(l2.totalTransactions)} L2 txs</span></div>
</section>

<!-- SLIDE 8: Throughput & Scaling -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Throughput analysis</div>
  <h2>150,000 Claims — Scaling Plan</h2>
  <div class="grid2">
    <div>
      <h3 style="color:#4fc3f7;margin-bottom:12px">Observed Server Throughput (Worker E · 1 Instance)</h3>
      <table>
        <tr><th>Metric</th><th>Value</th></tr>
        <tr><td>Peak hourly rate</td><td><strong>509 claims/hr</strong></td></tr>
        <tr><td>Sustained rate (healthy RPC)</td><td><strong>~500 claims/hr</strong></td></tr>
        <tr><td>Best day (Aug 17)</td><td><strong>2,048 claims</strong></td></tr>
        <tr><td>Best 24h projected</td><td><strong>~12,000 claims</strong></td></tr>
        <tr><td>Effective rate (incl. downtime)</td><td>~200–325 claims/hr</td></tr>
      </table>
      <p style="margin-top:14px;color:#ef5350;font-size:.85rem">⚠ RPC intermittent outages reduce effective throughput by 40-60%</p>
    </div>
    <div class="chart-box"><canvas id="scalingChart"></canvas></div>
  </div>
  <div style="margin-top:24px">
    <h3 style="color:#4fc3f7;margin-bottom:12px">Time to Complete 150,000 Claims</h3>
    <table>
      <tr><th>Instances</th><th>Wallets Needed</th><th>Conservative<br/>(200/hr)</th><th>Typical<br/>(325/hr)</th><th>Peak 24/7<br/>(500/hr)</th></tr>
      <tr><td><strong>1 instance</strong></td><td>1</td><td>31 days</td><td>19 days</td><td><strong>12.5 days</strong></td></tr>
      <tr><td><strong>2 instances</strong></td><td>2</td><td>16 days</td><td>10 days</td><td><strong>6.3 days</strong></td></tr>
      <tr><td><strong>3 instances</strong></td><td>3</td><td>10 days</td><td>6 days</td><td><strong>4.2 days</strong></td></tr>
      <tr><td><strong>5 instances</strong></td><td>5</td><td>6 days</td><td>4 days</td><td><strong>2.5 days</strong></td></tr>
      <tr style="background:rgba(79,195,247,.1)"><td><strong>13 instances</strong></td><td>13</td><td>2.4 days</td><td>1.5 days</td><td style="color:#66bb6a"><strong>~1 day</strong></td></tr>
    </table>
  </div>
  <div class="footer"><span>Slide 8 · Throughput &amp; Scaling</span><span>Based on live Worker E logs · Aug 16–19 2026</span></div>
</section>

<!-- SLIDE 9: Scaling Requirements -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Multi-instance scaling</div>
  <h2>What's Needed for Parallel Seeding</h2>
  <div class="grid2">
    <div>
      <h3 style="color:#66bb6a;margin-bottom:12px">✓ Prerequisites per Instance</h3>
      <ul class="bullets">
        <li><strong>Separate operator wallet</strong> — each instance needs its own funded wallet (nonce conflicts with shared wallet)</li>
        <li><strong>Disjoint claim ranges</strong> — each worker processes a non-overlapping range of claim numbers</li>
        <li><strong>Fund each wallet</strong> — gas fees for on-chain transactions (~0.001 ADI per claim)</li>
        <li><strong>Stable RPC</strong> — current intermittent 502 errors are the biggest bottleneck</li>
      </ul>
      <h3 style="color:#ef5350;margin:24px 0 12px">⚠ Current Constraints</h3>
      <ul class="bullets">
        <li><strong>1 wallet</strong> active — only 1 seed instance at a time today</li>
        <li><strong>RPC uptime ~50-60%</strong> — frequent 502 Bad Gateway outages</li>
        <li>Effective daily throughput ~1,500–2,000 claims (not 12,000 theoretical)</li>
      </ul>
    </div>
    <div>
      <h3 style="color:#4fc3f7;margin-bottom:12px">Recommended Scaling Path</h3>
      <table>
        <tr><th>Phase</th><th>Action</th><th>Target</th></tr>
        <tr><td><strong>Phase 1</strong></td><td>Stabilise RPC uptime to 95%+</td><td>~10K claims/day</td></tr>
        <tr><td><strong>Phase 2</strong></td><td>Add 3 wallets → 3 parallel workers</td><td>~30K claims/day</td></tr>
        <tr><td><strong>Phase 3</strong></td><td>Scale to 5-10 workers + batch txs</td><td>~60K–100K claims/day</td></tr>
      </table>
      <div style="margin-top:24px;padding:16px;background:rgba(102,187,106,.1);border-radius:8px;border:1px solid rgba(102,187,106,.3)">
        <strong style="color:#66bb6a">Target: 150K claims in &lt; 5 days</strong><br/>
        <span style="color:#cfd8dc;font-size:.9rem">Achievable with 5 parallel workers + stable RPC (Phase 2–3)</span>
      </div>
    </div>
  </div>
  <div class="footer"><span>Slide 9 · Scaling Requirements</span><span>${date}</span></div>
</section>

<!-- SLIDE 10: Risks & Next Steps -->
<section class="slide" style="background:#0f1419">
  <div class="tag">Status &amp; next steps</div>
  <h2>Operational Status &amp; Recommendations</h2>
  <div class="grid2">
    <div>
      <h3 style="color:#ef5350;margin-bottom:12px">⚠ Action Items</h3>
      <ul class="bullets">
        ${commit?.status === 'critical' ? `<li><strong>Commit operator wallet low</strong> — ${commit.balanceAdi?.toFixed(1)} ADI remaining (threshold ${commit.thresholdAdi} ADI). Top up to avoid settlement delays.</li>` : ''}
        <li>Continue DB → on-chain import (Worker E in progress)</li>
        <li>Monitor seed worker health via automated alerts (every 15 min)</li>
      </ul>
      <h3 style="color:#66bb6a;margin:24px 0 12px">✓ Achievements</h3>
      <ul class="bullets">
        <li><strong>${fmt(ec.claimsAnchored)}</strong> claims cryptographically anchored — independently verifiable</li>
        <li>Full registry stack live: Claim, Provider, Citizen, Clinician, Insurer</li>
        <li>L3 → L2 settlement pipeline operational (${fmt(execute?.nonce)} batches executed)</li>
        <li>Live operations dashboard: <a href="${BASE}/" style="color:#4fc3f7">${BASE}/</a></li>
      </ul>
    </div>
    <div>
      <table>
        <tr><th colspan="2">Key numbers for management</th></tr>
        <tr><td>Claims on blockchain</td><td><strong>${fmt(ec.claimsAnchored)}</strong></td></tr>
        <tr><td>L3 network transactions</td><td><strong>${fmt(l3.totalTransactions)}</strong></td></tr>
        <tr><td>L2 settlement blocks</td><td><strong>${fmt(l2.totalBlocks)}</strong></td></tr>
        <tr><td>Settlement batches executed</td><td><strong>${fmt(execute?.nonce)}</strong></td></tr>
        <tr><td>PHI on-chain</td><td><strong style="color:#66bb6a">Zero</strong></td></tr>
      </table>
    </div>
  </div>
  <div class="footer"><span>Slide 10 · Status</span><span>Thank you</span></div>
</section>

<script>
const registryLabels = ${JSON.stringify(registryLabels)};
const registryTxs = ${JSON.stringify(registryTxs)};

Chart.defaults.color = '#90a4ae';
Chart.defaults.borderColor = 'rgba(255,255,255,.1)';

new Chart(document.getElementById('l3Chart'), {
  type: 'bar',
  data: {
    labels: ['Blocks', 'Transactions', 'Tx Today'],
    datasets: [{ data: [${l3.totalBlocks}, ${l3.totalTransactions}, ${l3.transactionsToday}], backgroundColor: ['#4fc3f7','#29b6f6','#039be5'] }]
  },
  options: { plugins: { legend: { display: false }, title: { display: true, text: 'L3 Network Volume', color: '#fff' } } }
});

new Chart(document.getElementById('claimsChart'), {
  type: 'doughnut',
  data: {
    labels: ['Claims anchored', 'Commit txs'],
    datasets: [{ data: [${ec.claimsAnchored}, ${ec.commitTransactions}], backgroundColor: ['#66bb6a','#4fc3f7'] }]
  },
  options: { plugins: { title: { display: true, text: 'Claims vs Commit Txs', color: '#fff' } } }
});

new Chart(document.getElementById('scalingChart'), {
  type: 'bar',
  data: {
    labels: ['1 worker', '2 workers', '3 workers', '5 workers', '13 workers'],
    datasets: [
      { label: 'Conservative (200/hr)', data: [31.3, 15.6, 10.4, 6.3, 2.4], backgroundColor: '#ef5350' },
      { label: 'Typical (325/hr)', data: [19.2, 9.6, 6.4, 3.8, 1.5], backgroundColor: '#ffa726' },
      { label: 'Peak 24/7 (500/hr)', data: [12.5, 6.3, 4.2, 2.5, 1.0], backgroundColor: '#66bb6a' }
    ]
  },
  options: {
    plugins: { title: { display: true, text: 'Days to Complete 150K Claims', color: '#fff' } },
    scales: { y: { title: { display: true, text: 'Days', color: '#90a4ae' } } }
  }
});

new Chart(document.getElementById('registryChart'), {
  type: 'bar',
  data: {
    labels: registryLabels,
    datasets: [{ label: 'Indexed txs', data: registryTxs, backgroundColor: '#ab47bc' }]
  },
  options: { indexAxis: 'y', plugins: { legend: { display: false }, title: { display: true, text: 'Registry Activity', color: '#fff' } } }
});
</script>
</body>
</html>`;
}

async function main() {
  console.log(`Fetching live data from ${BASE}/api/snapshot …`);
  const data = await fetchSnapshot();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, buildHtml(data));
  console.log(`\nPresentation generated:`);
  console.log(`  ${outFile}`);
  console.log(`\nOpen in browser → File → Print → Save as PDF`);
  console.log(`Or screenshot each slide into PowerPoint.`);
  console.log(`\nKey stats:`);
  console.log(`  Claims anchored: ${fmt(data.eclaims.claimsAnchored)}`);
  console.log(`  L3 transactions: ${fmt(data.chains.l3.totalTransactions)}`);
  console.log(`  L2 blocks:       ${fmt(data.chains.l2.totalBlocks)}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

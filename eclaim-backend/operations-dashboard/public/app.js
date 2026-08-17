function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

function shortAddr(a) {
  if (!a || a.length < 12) return a || '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function ago(iso) {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function explorerAddr(url, addr) {
  return `${url.replace(/\/$/, '')}/address/${addr}`;
}

function render(data) {
  const l3 = data.chains.l3;
  const l2 = data.chains.l2;
  const ec = data.eclaims;
  const overall =
    data.overallStatus === 'healthy'
      ? { cls: 'ok', text: 'Healthy' }
      : data.overallStatus === 'watch'
        ? { cls: 'watch', text: 'Watch' }
        : { cls: 'bad', text: 'Action required' };

  const alerts = (data.settlement.operators || [])
    .filter((o) => o.status === 'critical' || o.status === 'watch')
    .map(
      (o) =>
        `<div class="alert"><strong>${o.label} operator:</strong> ${fmt(o.balanceAdi)} ADI remaining (threshold ${fmt(o.thresholdAdi)} ADI). <a href="${explorerAddr('https://explorer.adifoundation.ai', o.address)}" target="_blank">View wallet ↗</a></div>`,
    )
    .join('');

  const registryRows = (ec.registries || [])
    .map((r) => {
      const tx = r.counters?.ok ? fmt(r.counters.transactionsCount) : '—';
      return `<tr>
        <td><strong>${r.letter}</strong> ${r.name}</td>
        <td><code>${shortAddr(r.address)}</code></td>
        <td>${tx}</td>
        <td><a href="${explorerAddr(l3.explorerUi, r.address)}" target="_blank">Explorer ↗</a></td>
      </tr>`;
    })
    .join('');

  const opRows = (data.settlement.operators || [])
    .map((o) => {
      const tag =
        o.status === 'healthy'
          ? '<span class="tag ok">Healthy</span>'
          : o.status === 'watch'
            ? '<span class="tag watch">Watch</span>'
            : '<span class="tag bad">Critical</span>';
      return `<tr>
        <td>${o.label}</td>
        <td><code>${shortAddr(o.address)}</code></td>
        <td><strong>${o.ok ? o.balanceAdi.toFixed(3) : '—'} ADI</strong></td>
        <td>${fmt(o.nonce)}</td>
        <td>${tag}</td>
      </tr>`;
    })
    .join('');

  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <div class="brand">
        <span class="brand-badge">Apeiro + ADI</span>
        <span>E-Claims Operations Dashboard</span>
      </div>
      <div class="meta">
        Chains ${l3.chainId} / ${l2.chainId}<br/>
        Updated ${ago(data.generatedAt)} · refresh 60s
      </div>
    </div>

    <div class="wrap">
      <div class="hero">
        <h1>Apeiro L3 Operations & E-Claims Settlement</h1>
        <p>Live chain metrics from <a href="${l3.explorerUi}" target="_blank">Apeiro Explorer</a> + e-claims backend.</p>
        <div class="status-pill ${overall.cls}">Overall status: <strong>${overall.text}</strong></div>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="label">L3 block height</div>
          <div class="value">${fmt(l3.blockHeight)}</div>
          <div class="sub">Same as <a href="${l3.explorerUi}" target="_blank">explorer.apeiro</a> · last block ${ago(l3.lastBlockAt)}</div>
        </div>
        <div class="kpi">
          <div class="label">L3 total transactions</div>
          <div class="value">${fmt(l3.totalTransactions)}</div>
          <div class="sub"><strong>Not claim count.</strong> All chain txs: registries, demos, retries, anchors, ops</div>
        </div>
        <div class="kpi">
          <div class="label">Claims anchored (on-chain)</div>
          <div class="value">${fmt(ec.claimsAnchored)}</div>
          <div class="sub">${ec.claimsSource || '—'}${ec.commitTransactions ? ` · ${fmt(ec.commitTransactions)} txs` : ''}</div>
        </div>
        <div class="kpi">
          <div class="label">Commit transactions</div>
          <div class="value">${fmt(ec.commitTransactions)}</div>
          <div class="sub">Unique upsertClaim tx hashes on L3${ec.claimScanAt ? ` · scanned ${ago(ec.claimScanAt)}` : ''}</div>
        </div>
        <div class="kpi">
          <div class="label">ADI L2 blocks</div>
          <div class="value">${fmt(l2.totalBlocks)}</div>
          <div class="sub">${fmt(l2.totalTransactions)} settlement txs · head ${fmt(l2.blockHeight)}</div>
        </div>
        <div class="kpi">
          <div class="label">Backend</div>
          <div class="value">${ec.backend?.ok ? 'Live' : 'Down'}</div>
          <div class="sub">${ec.backend?.ok ? `Block ${fmt(ec.backend.blockNumber)}` : 'Health check failed'}</div>
        </div>
      </div>

      <div class="section">
        <h2>L3 → L2 Settlement Pipeline</h2>
        <div class="hint">Settlement operators on ADI Mainnet (L2).</div>
        <div class="pipeline">
          <div class="pipe-step"><div class="num">${fmt(data.settlement.operators.find(o=>o.label==='commit')?.nonce)}</div><div class="name">Commit txs</div></div>
          <div class="pipe-step"><div class="num">${fmt(data.settlement.operators.find(o=>o.label==='prove')?.nonce)}</div><div class="name">Prove txs</div></div>
          <div class="pipe-step"><div class="num">${fmt(data.settlement.operators.find(o=>o.label==='execute')?.nonce)}</div><div class="name">Execute txs</div></div>
        </div>
        ${alerts}
      </div>

      <div class="grid-2">
        <div class="section">
          <h2>Apeiro L3 · Network Live</h2>
          <table>
            <tr><td>Total L3 blocks</td><td><strong>${fmt(l3.totalBlocks)}</strong></td></tr>
            <tr><td>Total L3 transactions</td><td><strong>${fmt(l3.totalTransactions)}</strong></td></tr>
            <tr><td>Transactions today</td><td>${fmt(l3.transactionsToday)}</td></tr>
            <tr><td>Gas price</td><td>${l3.gasPriceGwei != null ? `${l3.gasPriceGwei} Gwei` : '—'}</td></tr>
          </table>
        </div>
        <div class="section">
          <h2>ADI Mainnet L2 · Settlement</h2>
          <table>
            <tr><td>L2 block height</td><td><strong>${fmt(l2.blockHeight)}</strong></td></tr>
            <tr><td>L2 total transactions</td><td>${fmt(l2.totalTransactions)}</td></tr>
            <tr><td>BLS explorer</td><td><a href="${l2.explorerApi}" target="_blank">explorer-bls.adifoundation.ai ↗</a></td></tr>
          </table>
        </div>
      </div>

      <div class="section">
        <h2>E-Claims Registry Contract Health · Apeiro L3</h2>
        <table>
          <thead><tr><th>Contract</th><th>Address</th><th>Indexed txs</th><th>Link</th></tr></thead>
          <tbody>${registryRows || '<tr><td colspan="4">No contracts configured</td></tr>'}</tbody>
        </table>
      </div>

      <div class="section">
        <h2>Settlement Operator Balances · ADI Mainnet</h2>
        <table>
          <thead><tr><th>Operator</th><th>Address</th><th>Balance</th><th>Outbound txs</th><th>Status</th></tr></thead>
          <tbody>${opRows || '<tr><td colspan="5">No operators configured</td></tr>'}</tbody>
        </table>
      </div>

      <div class="footer">
        Sources: ${data.sources.map((s) => `<a href="${s.url}" target="_blank">${s.name}</a>`).join(' · ')}
      </div>
    </div>
  `;
}

function apiBase() {
  const p = window.location.pathname.replace(/\/$/, '') || '';
  return p || '';
}

async function refresh() {
  try {
    const res = await fetch(`${apiBase()}/api/snapshot`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    render(data);
  } catch (err) {
    document.getElementById('app').innerHTML = `<div class="loading">Failed to load dashboard: ${err.message}</div>`;
  }
}

refresh();
setInterval(refresh, 60_000);

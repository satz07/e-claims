/**
 * Live E-Claims + Apeiro L3 operations dashboard API helpers.
 * Data sources: Apeiro BLS explorer, ADI BLS explorer, RPC, seed logs, backend health.
 */
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

export function loadEnvFile(filePath) {
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

export function fmt(n) {
  if (n == null || n === '' || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-US');
}

export function shortAddr(a) {
  if (!a || a.length < 12) return a || '—';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function fetchJson(url, timeoutMs = 8000) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchExplorerStats(baseUrl) {
  const r = await fetchJson(`${baseUrl.replace(/\/$/, '')}/api/v2/stats`);
  if (!r.ok) return { ok: false, url: baseUrl, error: r.error, latencyMs: r.latencyMs };
  const s = r.data;
  return {
    ok: true,
    url: baseUrl,
    latencyMs: r.latencyMs,
    totalBlocks: Number(s.total_blocks || 0),
    totalTransactions: Number(s.total_transactions || 0),
    transactionsToday: Number(s.transactions_today || 0),
    totalAddresses: Number(s.total_addresses || 0),
    gasUsedToday: s.gas_used_today || '0',
    gasPrices: s.gas_prices || {},
    averageBlockTimeMs: Number(s.average_block_time || 0),
    networkUtilizationPct: Number(s.network_utilization_percentage || 0),
  };
}

export async function fetchContractCounters(explorerUrl, address) {
  if (!address) return { ok: false, error: 'no address' };
  const r = await fetchJson(
    `${explorerUrl.replace(/\/$/, '')}/api/v2/addresses/${address}/counters`,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    transactionsCount: Number(r.data.transactions_count || 0),
    tokenTransfersCount: Number(r.data.token_transfers_count || 0),
    gasUsageCount: Number(r.data.gas_usage_count || 0),
  };
}

export async function fetchLatestBlock(explorerUrl) {
  const r = await fetchJson(
    `${explorerUrl.replace(/\/$/, '')}/api/v2/blocks?page=1`,
  );
  if (!r.ok || !r.data?.items?.length) {
    return { ok: false, error: r.error || 'no blocks' };
  }
  const b = r.data.items[0];
  return {
    ok: true,
    height: Number(b.height),
    timestamp: b.timestamp,
    txCount: Number(b.transactions_count || b.tx_count || 0),
    hash: b.hash,
  };
}

export async function fetchRpcHead(rpcUrl, chainId) {
  const t0 = Date.now();
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
      staticNetwork: true,
    });
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    const feeData = await provider.getFeeData();
    return {
      ok: true,
      latencyMs: Date.now() - t0,
      blockNumber,
      blockTimestamp: block?.timestamp
        ? new Date(block.timestamp * 1000).toISOString()
        : null,
      gasPriceGwei: feeData.gasPrice
        ? Number(ethers.formatUnits(feeData.gasPrice, 'gwei'))
        : null,
    };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: err.message };
  }
}

export async function fetchWalletBalance(rpcUrl, chainId, address) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
      staticNetwork: true,
    });
    const bal = await provider.getBalance(address);
    const txCount = await provider.getTransactionCount(address);
    return {
      ok: true,
      address,
      balanceAdi: Number(ethers.formatEther(bal)),
      nonce: txCount,
    };
  } catch (err) {
    return { ok: false, address, error: err.message };
  }
}

export function loadSeedProgress(logDir) {
  const workers = [];
  if (!fs.existsSync(logDir)) return workers;
  for (const name of fs.readdirSync(logDir)) {
    if (!/^db-seed-progress(-.+)?\.json$/.test(name)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(logDir, name), 'utf8'));
      const worker =
        name === 'db-seed-progress.json'
          ? 'default'
          : name.replace(/^db-seed-progress-/, '').replace(/\.json$/, '');
      workers.push({
        worker,
        lastClaimNumber: Number(data.lastClaimNumber || 0),
        lastImportedAt: data.lastImportedAt || null,
        claimsOk: Number(data.totals?.claimsOk || 0),
        preauthsOk: Number(data.totals?.preauthsOk || 0),
        errors: Number(data.totals?.errors || 0),
        range: data.range || null,
      });
    } catch {
      /* ignore */
    }
  }
  return workers.sort((a, b) => a.worker.localeCompare(b.worker));
}

export function loadImportDaily(logDir) {
  const byDay = {};
  if (!fs.existsSync(logDir)) return [];
  for (const name of fs.readdirSync(logDir)) {
    if (!name.startsWith('db-seed-records') || !name.endsWith('.log')) continue;
    for (const line of fs.readFileSync(path.join(logDir, name), 'utf8').split('\n')) {
      if (!/\bOK\b/.test(line)) continue;
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(line);
      if (m) byDay[m[1]] = (byDay[m[1]] || 0) + 1;
    }
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

export function parseOperatorAddresses() {
  const raw = String(process.env.BALANCE_ALERT_ADDRESSES || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const entry of raw) {
    let label = 'operator';
    let addr = entry;
    const colon = entry.indexOf(':');
    if (colon > 0 && !entry.slice(0, colon).startsWith('0x')) {
      label = entry.slice(0, colon).trim();
      addr = entry.slice(colon + 1).trim();
    }
    try {
      out.push({ label, address: ethers.getAddress(addr) });
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

export function getRegistryContracts() {
  return [
    {
      key: 'claim',
      name: 'Claim Registry',
      address: process.env.CLAIM_REGISTRY_ADDRESS || '',
      letter: 'C',
    },
    {
      key: 'provider',
      name: 'Provider Registry',
      address: process.env.PROVIDER_REGISTRY_ADDRESS || '',
      letter: 'P',
    },
    {
      key: 'citizen',
      name: 'Citizen Registry',
      address: process.env.CITIZEN_REGISTRY_ADDRESS || '',
      letter: 'C',
    },
    {
      key: 'clinician',
      name: 'Clinician Registry',
      address: process.env.CLINICIAN_REGISTRY_ADDRESS || '',
      letter: 'C',
    },
    {
      key: 'insurer',
      name: 'Insurer Registry',
      address: process.env.INSURER_REGISTRY_ADDRESS || '',
      letter: 'I',
    },
  ].filter((c) => c.address);
}

let claimCountCache = { at: 0, value: null };

export async function countClaimUpserted(rpcUrl, chainId, addresses, maxAgeMs = 300_000) {
  if (claimCountCache.value && Date.now() - claimCountCache.at < maxAgeMs) {
    return claimCountCache.value;
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
    staticNetwork: true,
  });
  const latest = await provider.getBlockNumber();
  const topic0 = ethers.id('ClaimUpserted(uint256,bytes32,uint8,bytes32)');
  const CHUNK = 4000;
  const claimNumbers = new Set();
  const txHashes = new Set();
  let rawEvents = 0;

  for (const address of addresses.filter(Boolean)) {
    for (let from = 0; from <= latest; from += CHUNK) {
      const to = Math.min(from + CHUNK - 1, latest);
      try {
        const logs = await provider.send('eth_getLogs', [
          {
            address,
            fromBlock: ethers.toBeHex(from),
            toBlock: ethers.toBeHex(to),
            topics: [topic0],
          },
        ]);
        rawEvents += logs.length;
        for (const log of logs) {
          if (log.topics?.[1]) {
            claimNumbers.add(BigInt(log.topics[1]).toString());
          }
          if (log.transactionHash) txHashes.add(log.transactionHash);
        }
      } catch {
        /* chunk may be too large — continue */
      }
    }
  }

  const result = {
    ok: true,
    latestBlock: latest,
    rawEvents,
    uniqueClaims: claimNumbers.size,
    commitTransactions: txHashes.size,
    scannedAt: new Date().toISOString(),
  };
  claimCountCache = { at: Date.now(), value: result };
  return result;
}

export async function fetchBackendClaimTotal(backendUrl) {
  const key =
    process.env.ECLAIM_API_KEY ||
    String(process.env.ECLAIM_API_KEYS || '').split(',')[0] ||
    '';
  const headers = key.trim() ? { 'X-API-Key': key.trim() } : {};
  try {
    const res = await fetch(
      `${backendUrl}/api/public/eclaim-contract?page=0&size=1`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      ok: true,
      totalElements: Number(data.totalElements ?? data.total ?? 0),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function loadSeedRecordsTotals(logDir) {
  let ok = 0;
  let dup = 0;
  let err = 0;
  if (!fs.existsSync(logDir)) return { ok, dup, err };
  for (const name of fs.readdirSync(logDir)) {
    if (!name.startsWith('db-seed-records') || !name.endsWith('.log')) continue;
    for (const line of fs.readFileSync(path.join(logDir, name), 'utf8').split('\n')) {
      if (/\bOK\b/.test(line)) ok++;
      else if (/\bDUP\b/.test(line)) dup++;
      else if (/\bERR\b/.test(line)) err++;
    }
  }
  return { ok, dup, err };
}

export async function fetchBackendHealth(backendUrl) {
  const urls = [
    `${backendUrl}/api/public/integration/health`,
    `${backendUrl}/api/health`,
  ];
  for (const url of urls) {
    const r = await fetchJson(url, 8000);
    if (r.ok) return { ok: true, url, ...r.data, latencyMs: r.latencyMs };
  }
  return { ok: false, url: backendUrl };
}

export async function buildSnapshot({ root, logDir }) {
  loadEnvFile(path.join(root, '.env'));

  const L3_RPC =
    process.env.APEIRO_RPC_URL ||
    process.env.CHAIN_RPC_URL ||
    'https://rpc.apeiro.adifoundation.ai';
  const L3_CHAIN_ID = Number(process.env.CHAIN_ID || 37001);
  const L3_EXPLORER_UI =
    process.env.CHAIN_EXPLORER_URL || 'https://explorer.apeiro.adifoundation.ai';
  const L3_BLS = 'https://explorer-bls.apeiro.adifoundation.ai';
  const L2_RPC =
    process.env.BALANCE_ALERT_RPC_URL || 'https://rpc.adifoundation.ai';
  const L2_CHAIN_ID = Number(process.env.BALANCE_ALERT_CHAIN_ID || 36900);
  const L2_BLS = 'https://explorer-bls.adifoundation.ai';
  const BACKEND = (
    process.env.OPS_DASHBOARD_BACKEND_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:8001'
  ).replace(/\/$/, '');
  const THRESHOLD = Number(process.env.BALANCE_ALERT_THRESHOLD_ADI || 20);

  const t0 = Date.now();
  const [
    l3Bls,
    l2Bls,
    l3Rpc,
    l2Rpc,
    l3LatestBlock,
    backendHealth,
    backendClaims,
  ] = await Promise.all([
    fetchExplorerStats(L3_BLS),
    fetchExplorerStats(L2_BLS),
    fetchRpcHead(L3_RPC, L3_CHAIN_ID),
    fetchRpcHead(L2_RPC, L2_CHAIN_ID),
    fetchLatestBlock(L3_BLS),
    fetchBackendHealth(BACKEND),
    fetchBackendClaimTotal(BACKEND),
  ]);

  const l3Stats = l3Bls;
  const avgBlockSec =
    l3Stats.ok && l3Stats.averageBlockTimeMs
      ? Math.round(l3Stats.averageBlockTimeMs / 1000)
      : null;
  const tps24h =
    l3Stats.ok && l3Stats.transactionsToday
      ? Math.round((l3Stats.transactionsToday / 86400) * 1000) / 1000
      : null;

  const registries = getRegistryContracts();
  const registryStats = await Promise.all(
    registries.map(async (r) => {
      const counters = await fetchContractCounters(L3_BLS, r.address);
      return { ...r, counters };
    }),
  );

  const operators = parseOperatorAddresses();
  const operatorBalances = await Promise.all(
    operators.map(async (op) => {
      const w = await fetchWalletBalance(L2_RPC, L2_CHAIN_ID, op.address);
      const status =
        !w.ok || w.balanceAdi == null
          ? 'unknown'
          : w.balanceAdi < THRESHOLD
            ? 'critical'
            : w.balanceAdi < THRESHOLD * 3
              ? 'watch'
              : 'healthy';
      return { ...op, ...w, status, thresholdAdi: THRESHOLD };
    }),
  );

  // Always scan ClaimUpserted on-chain (cached for 5 min in countClaimUpserted)
  const claimScan = await Promise.race([
    countClaimUpserted(L3_RPC, L3_CHAIN_ID, [
      process.env.CLAIM_REGISTRY_ADDRESS,
      process.env.CLAIM_REGISTRY_V1_ADDRESS,
    ]),
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ ok: false, skipped: true, reason: 'scan timeout' }),
        120_000,
      ),
    ),
  ]).catch((e) => ({ ok: false, error: e.message }));

  const claimRegistry = registryStats.find((r) => r.key === 'claim');
  const registryTxCount = claimRegistry?.counters?.ok
    ? claimRegistry.counters.transactionsCount
    : null;

  let claimsAnchored = null;
  let claimsSource = 'unavailable';
  if (claimScan.ok && claimScan.uniqueClaims > 0) {
    claimsAnchored = claimScan.uniqueClaims;
    claimsSource = 'on-chain ClaimUpserted log scan';
  } else if (backendClaims.ok && backendClaims.totalElements > 0) {
    claimsAnchored = backendClaims.totalElements;
    claimsSource = 'backend index (ClaimUpserted)';
  } else if (registryTxCount) {
    claimsAnchored = registryTxCount;
    claimsSource = 'ClaimRegistry explorer tx count (approx)';
  }

  const ownerKey =
    process.env.OWNER_PRIVATE_KEY || process.env.ECLAIM_PRIVATE_KEY || '';
  let ownerWallet = null;
  if (ownerKey) {
    try {
      const pk = ownerKey.startsWith('0x') ? ownerKey : `0x${ownerKey}`;
      const addr = new ethers.Wallet(pk).address;
      ownerWallet = await fetchWalletBalance(L3_RPC, L3_CHAIN_ID, addr);
      if (ownerWallet.ok) ownerWallet.label = 'Owner / deployer';
    } catch {
      /* ignore */
    }
  }

  const lowestOp = operatorBalances
    .filter((o) => o.ok)
    .sort((a, b) => a.balanceAdi - b.balanceAdi)[0];

  const overallStatus =
    operatorBalances.some((o) => o.status === 'critical')
      ? 'action_required'
      : operatorBalances.some((o) => o.status === 'watch')
        ? 'watch'
        : 'healthy';

  return {
    generatedAt: new Date().toISOString(),
    buildMs: Date.now() - t0,
    overallStatus,
    chains: {
      l3: {
        name: 'Apeiro L3',
        chainId: L3_CHAIN_ID,
        rpc: L3_RPC,
        explorerUi: L3_EXPLORER_UI,
        explorerApi: L3_BLS,
        blockHeight: l3LatestBlock.ok
          ? l3LatestBlock.height
          : l3Rpc.ok
            ? l3Rpc.blockNumber
            : null,
        lastBlockAt: l3LatestBlock.ok ? l3LatestBlock.timestamp : l3Rpc.blockTimestamp,
        totalTransactions: l3Stats.ok ? l3Stats.totalTransactions : null,
        transactionsToday: l3Stats.ok ? l3Stats.transactionsToday : null,
        totalBlocks: l3Stats.ok ? l3Stats.totalBlocks : null,
        tps24h,
        avgBlockSec,
        gasPriceGwei: l3Rpc.ok ? l3Rpc.gasPriceGwei : null,
        rpcLatencyMs: l3Rpc.latencyMs,
        explorerLatencyMs: l3Stats.ok ? l3Stats.latencyMs : null,
      },
      l2: {
        name: 'ADI Mainnet L2',
        chainId: L2_CHAIN_ID,
        rpc: L2_RPC,
        explorerApi: L2_BLS,
        blockHeight: l2Rpc.ok ? l2Rpc.blockNumber : null,
        totalTransactions: l2Bls.ok ? l2Bls.totalTransactions : null,
        totalBlocks: l2Bls.ok ? l2Bls.totalBlocks : null,
        transactionsToday: l2Bls.ok ? l2Bls.transactionsToday : null,
        rpcLatencyMs: l2Rpc.latencyMs,
        explorerLatencyMs: l2Bls.ok ? l2Bls.latencyMs : null,
      },
    },
    settlement: {
      // Batch number approximated from L2 commit operator nonce activity
      latestBatch: lowestOp?.nonce ? Math.max(...operatorBalances.filter(o => o.ok).map(o => o.nonce || 0)) : null,
      operators: operatorBalances,
      lowestRunwayLabel: lowestOp?.label || null,
    },
    eclaims: {
      claimsAnchored,
      claimsSource,
      commitTransactions: claimScan.commitTransactions ?? null,
      rawEvents: claimScan.rawEvents ?? null,
      claimScanAt: claimScan.scannedAt || null,
      registries: registryStats,
      backend: backendHealth,
      backendClaims,
    },
    treasury: {
      owner: ownerWallet,
    },
    sources: [
      { name: 'Apeiro Explorer UI', url: L3_EXPLORER_UI },
      { name: 'Apeiro BLS Explorer API', url: L3_BLS },
      { name: 'ADI Mainnet BLS Explorer', url: L2_BLS },
      { name: 'E-Claims Backend', url: BACKEND },
    ],
  };
}

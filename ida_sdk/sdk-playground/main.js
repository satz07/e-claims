import {
  IDAClient,
  lookupDIDOnChain,
  confirmSponsorshipOnChain, getSponsorOnChain, revokeSponsorshipOnChain,
  listChains,
} from '@myida/sdk';
import { Wallet, BrowserProvider } from 'ethers';

// ── DOM helpers ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const logEl = $('log');

function log(op, data, kind = '') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${kind}`;
  const t = new Date().toLocaleTimeString();
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  entry.innerHTML = `<span class="t">${t}</span> <span class="op">${op}</span><pre></pre>`;
  entry.querySelector('pre').textContent = body;
  logEl.prepend(entry);
}

function errMsg(e) {
  // ethers wraps chain reverts / gas errors; surface the useful part.
  return e?.shortMessage || e?.reason || e?.message || String(e);
}

// ── Client wiring ───────────────────────────────────────────────────────────────
let client = null;

function buildClient() {
  client = new IDAClient({
    apiUrl: $('apiUrl').value.trim(),
    apiKey: $('apiKey').value.trim(),
    chain: {
      rpcUrl: $('rpcUrl').value.trim(),
      chainId: Number($('chainId').value),
      didRegistry: $('didRegistry').value.trim(),
      agentTrustRegistry: $('agentRegistry').value.trim(),
    },
  });
  return client;
}
function need() { if (!client) buildClient(); return client; }

// MetaMask signer (set once connected). When present, (signer) ops route
// through the extension and trigger a confirmation popup per transaction.
let mmSigner = null;

/**
 * Resolve the signer for a self-sovereign op:
 *  1. MetaMask signer if connected (real popup), else
 *  2. the raw in-page private key.
 * The SDK accepts either an ethers Signer or a hex key.
 */
function signer() {
  if (mmSigner) return mmSigner;
  const pk = $('pk').value.trim();
  if (!pk) throw new Error('No wallet. Connect MetaMask, or generate/load a raw key in the Self-Sovereign Wallet card.');
  return pk;
}

// ── Health check + version ───────────────────────────────────────────────────────

// Injected by Vite from the SDK's package.json — see vite.config.js.
$('ver').textContent = 'SDK v' + __SDK_VERSION__;

/**
 * Probes GET /api/v1/chains rather than /health.
 *
 * /health sits at the API's root, and a typical deployment puts the portal SPA
 * there and proxies only /api/v1/*. The request then lands on the SPA's
 * catch-all, comes back as HTML with no CORS headers, and the browser reports a
 * CORS failure — which reads as "the API is blocking us" when the API was never
 * reached. /api/v1/chains is proxied, needs no auth, and returns JSON.
 *
 * Any HTTP answer means the API is reachable, including 401: an auth failure
 * still proves something on the other end is listening and speaking HTTP.
 */
async function checkHealth() {
  const base = $('apiUrl').value.trim().replace(/\/$/, '');
  try {
    const res = await fetch(base + '/api/v1/chains');
    const type = res.headers.get('content-type') || '';

    if (type.includes('text/html')) {
      // Reached a web server, but it served a page instead of the API.
      $('apidot').className = 'dot err';
      $('apistate').textContent = 'wrong URL';
      $('apidot').title =
        `${base} served HTML, not the API. If the portal is hosted at this domain, ` +
        `point API URL at the API itself — often the same host with /api/v1 already ` +
        `proxied, or a separate api.* hostname.`;
      return;
    }

    $('apidot').className = 'dot ok';
    $('apistate').textContent = res.ok ? 'online' : `online (${res.status})`;
    $('apidot').title = '';
  } catch {
    // Network-level failure: DNS, TLS, connection refused, or a CORS block.
    $('apidot').className = 'dot err';
    $('apistate').textContent = 'offline';
    $('apidot').title = `Could not reach ${base}. Check the URL, and that the API allows this origin.`;
  }
}

// ── Operations map ────────────────────────────────────────────────────────────────
const ops = {
  async createDidApi() {
    const r = await need().createDID({ keyType: 'ed25519' });
    if (r.did) $('did').value = r.did;
    log('createDID (API)', r, 'ok');
  },

  async createDidChain() {
    const c = need();
    const r = await c.createDID({ signer: signer() });
    if (r.did) { $('did').value = r.did; $('opDid').value = r.did; }
    log('createDID (signer, on-chain)', r, 'chain');
  },

  async resolveDid() {
    const did = $('did').value.trim();
    if (!did) throw new Error('Enter a DID to resolve.');
    const r = await need().resolveDID(did);
    log('resolveDID', r, 'ok');
  },

  async lookupDid() {
    const input = $('lookupInput').value.trim();
    if (!input) throw new Error('Enter a wallet address or DID to look up.');
    need();
    const r = await lookupDIDOnChain(client.config.chain, input);
    if (!r.exists) {
      log('lookupDID (on-chain)', { ...r, answer: '✗ No DID registered on-chain for this wallet.' }, 'err');
    } else {
      log('lookupDID (on-chain)', {
        did: r.did,
        owner: r.owner,
        status: r.deactivated ? 'DEACTIVATED' : 'ACTIVE',
        created: r.created ? new Date(r.created * 1000).toISOString() : undefined,
        updated: r.updated ? new Date(r.updated * 1000).toISOString() : undefined,
        document: r.document,
      }, 'chain');
    }
  },

  async deactivateChain() {
    const did = $('did').value.trim();
    if (!did) throw new Error('Enter the DID to deactivate (must be one your wallet owns).');
    const r = await need().deactivateDID(did, { signer: signer() });
    log('deactivateDID (signer, on-chain)', r, 'chain');
  },

  async provisionAgent() {
    const opDid = $('opDid').value.trim() || $('did').value.trim();
    if (!opDid) throw new Error('Need an operator DID — create one first.');
    const r = await need().provisionAgent({
      name: $('agentName').value.trim() || 'Playground Agent',
      operatorDid: opDid,
      sponsorDid: opDid,
      platform: 'playground',
      // Intern. Autonomy is earned from recorded trust signals; the upper
      // levels also need a volume of them, so asking for a higher level here
      // would not grant it. Note the response reports a score-derived level,
      // so it reads "Junior" even though the stored level is Intern.
      autonomyLevel: 0,
      labels: parseLabels($('agentLabels').value),
      modelInfo: { provider: 'Anthropic', name: 'claude-sonnet-5', version: '2026-02' },
      capabilities: [{ name: 'demo.run', description: 'Demo capability' }],
    });
    if (r.agentDid) $('agentDid').value = r.agentDid;
    log('provisionAgent', r, 'ok');
  },

  // Provision several agents against the same operator/sponsor in one go. Each
  // call mints a fresh key pair, so the DIDs are always distinct — the point
  // being that one accountable party can stand up a whole fleet.
  async provisionFleet() {
    const opDid = $('opDid').value.trim() || $('did').value.trim();
    if (!opDid) throw new Error('Need an operator DID — create one first.');
    const count = Math.min(10, Math.max(1, Number($('fleetSize').value) || 3));
    const labels = parseLabels($('agentLabels').value);
    const dids = [];

    for (let i = 1; i <= count; i++) {
      const r = await need().provisionAgent({
        name: `${$('agentName').value.trim() || 'Playground Agent'} ${i}`,
        operatorDid: opDid,
        sponsorDid: opDid,
        platform: 'playground',
        autonomyLevel: 0,
        labels,
        modelInfo: { provider: 'Anthropic', name: 'claude-sonnet-5', version: '2026-02' },
        capabilities: [{ name: 'demo.run', description: 'Demo capability' }],
      });
      dids.push(r.agentDid);
    }
    if (dids[0]) $('agentDid').value = dids[0];
    log(`provisionAgent ×${count}`, {
      sponsor: opDid,
      labels,
      agentDids: dids,
      distinct: new Set(dids).size,
    }, 'ok');
  },

  // Listings are scoped to the caller: an agent appears when its operator is
  // your own subject or a DID you own. A shared service key whose subject owns
  // nothing will provision happily and then list nothing back.
  async listAgents() {
    const labels = parseLabels($('labelFilter').value);
    const r = await need().listAgents({ labels, limit: 50 });
    log(
      Object.keys(labels).length ? `listAgents ${JSON.stringify(labels)}` : 'listAgents (all)',
      {
        totalCount: r.totalCount,
        agents: (r.items ?? []).map((a) => ({
          name: a.name,
          did: a.id ?? a.did,
          labels: a.labels,
          autonomyLevel: a.autonomyLevel,
          trustScore: a.trustScore,
        })),
      },
      'ok',
    );
  },

  async registerAgentChain() {
    const opDid = $('opDid').value.trim();
    const agentDid = $('agentDid').value.trim() || `did:adi:agent-${Date.now()}`;
    if (!opDid) throw new Error('Enter an operator DID.');
    $('agentDid').value = agentDid;
    const r = await need().registerAgent(
      { operator: opDid, name: 'Playground Agent', modelInfo: { provider: 'Anthropic', name: 'claude-sonnet-5', version: '2026-02' }, capabilities: ['demo.run'] },
      { signer: signer(), agentDid },
    );
    log('registerAgent (signer, on-chain)', r, 'chain');
  },

  async trustApi() {
    const agentDid = $('agentDid').value.trim();
    if (!agentDid) throw new Error('Enter an agent DID.');
    const r = await need().recordTrustSignal(agentDid, { type: 'task_completed', source: 'playground', details: 'Manual test signal' });
    log('recordTrustSignal (API)', r, 'ok');
  },

  async trustChain() {
    const agentDid = $('agentDid').value.trim();
    if (!agentDid) throw new Error('Enter an agent DID.');
    const r = await need().recordTrustSignal(agentDid, { type: 'task_completed', details: 'Manual test signal' }, { signer: signer() });
    log('recordTrustSignal (signer, on-chain)', r, 'chain');
  },

  // ── Provable sponsorship (agentDID → sponsorDID, on the agent record) ──────────
  async sponsor() {
    const agentDid = requireAgentDid();
    const sponsorDid = $('sponsorDid').value.trim();
    const sponsorPk = $('sponsorPk').value.trim();
    if (!sponsorDid || !sponsorPk) throw new Error('Generate the sponsor (①) first — need its DID and key.');
    need();
    // The SPONSOR's key signs confirmSponsorship on the AgentTrustRegistry.
    const r = await confirmSponsorshipOnChain(sponsorPk, client.config.chain, agentDid, sponsorDid);
    log('confirmSponsorship (sponsor signs on-chain)', {
      ...r, agentDid, sponsorDid,
      note: 'Recorded on the AGENT record from the sponsor’s msg.sender — cannot be forged by the operator.',
    }, 'chain');
  },

  async verifySponsor() {
    const agentDid = requireAgentDid();
    need();
    // The core lookup: give an agent DID, get its sponsor back — trusting only the chain.
    const info = await getSponsorOnChain(client.config.chain, agentDid);
    log('getSponsor (read chain — who sponsors this agent?)', {
      agentDid,
      sponsorDid: info.sponsorDid || '(none)',
      sponsorAddress: info.sponsor,
      confirmed: info.confirmed,
      answer: info.confirmed
        ? `✓ This agent is sponsored by ${info.sponsorDid}`
        : '✗ No confirmed sponsor for this agent.',
    }, info.confirmed ? 'chain' : 'err');
  },

  async revokeSponsor() {
    const agentDid = requireAgentDid();
    const sponsorPk = $('sponsorPk').value.trim();
    if (!sponsorPk) throw new Error('Need the sponsor key (only the recorded sponsor can revoke).');
    need();
    const r = await revokeSponsorshipOnChain(sponsorPk, client.config.chain, agentDid);
    log('revokeSponsorship (sponsor signs on-chain)', r, 'chain');
  },
};

/**
 * Parses `team:finance, env:prod` into { team: 'finance', env: 'prod' }.
 *
 * Labels are caller-defined: IDA stores the pairs verbatim and never
 * interprets them. Splitting on the first colon only means a value may itself
 * contain colons. An empty field yields {}, which matches every agent.
 */
function parseLabels(raw) {
  const out = {};
  for (const part of String(raw || '').split(',')) {
    const entry = part.trim();
    if (!entry) continue;
    const idx = entry.indexOf(':');
    if (idx < 1) throw new Error(`Label "${entry}" must be key:value, e.g. team:finance`);
    out[entry.slice(0, idx).trim()] = entry.slice(idx + 1).trim();
  }
  return out;
}

// Sponsorship is keyed by AGENT DID (a string), recorded on the agent record.
function requireAgentDid() {
  const v = $('ssAgentDid').value.trim();
  if (!v) throw new Error('Need the agent DID. Click "Generate agent" (②), or paste a registered agent DID.');
  if (!v.startsWith('did:')) throw new Error('Enter a full agent DID (did:adi:…), not a bare address.');
  return v;
}

// ── Event wiring ──────────────────────────────────────────────────────────────────
document.querySelectorAll('button[data-op]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const op = btn.dataset.op;
    btn.disabled = true;
    try {
      await ops[op]();
    } catch (e) {
      log(op + ' — error', errMsg(e), 'err');
    } finally {
      btn.disabled = false;
    }
  });
});

// ── Network preset ──────────────────────────────────────────────────────────────
// Fills the four on-chain fields from the SDK's chain registry, so a newly
// deployed network is selectable here without editing this file. Picking
// "Custom…" leaves whatever is in the inputs alone.
$('chainPreset').addEventListener('change', (e) => {
  const value = e.target.value;
  if (value === 'custom') return;

  const chain = listChains().find((c) => String(c.chainId) === value);
  if (!chain) {
    log('network preset — unknown', `chain ${value} is not in the SDK registry`, 'err');
    return;
  }

  $('rpcUrl').value = chain.rpcUrl ?? '';
  $('chainId').value = String(chain.chainId);
  $('didRegistry').value = chain.didRegistry ?? '';
  $('agentRegistry').value = chain.agentTrustRegistry ?? '';

  // Contract addresses repeat across chains — same deployer, same nonce — so
  // the chain id is what distinguishes one deployment from another.
  log('network preset', {
    name: chain.name,
    chainId: chain.chainId,
    didFormat: chain.didFormat,
    faucet: chain.faucet ?? '(none)',
  });
  client = null;   // force a rebuild against the new network on next use
});

// Wrapped like the data-op buttons are. Without this a malformed URL or key
// threw into the console only, so a failed click looked exactly like a
// successful one — the button configures state in memory and has no other
// visible effect.
$('connect').addEventListener('click', () => {
  try {
    buildClient();
    checkHealth();
    log('connect', 'API client configured for ' + $('apiUrl').value + '. (This does NOT open MetaMask — use "Connect MetaMask" in the wallet card for on-chain signing.)', 'ok');
  } catch (e) {
    log('connect — error', errMsg(e), 'err');
  }
});
$('clear').addEventListener('click', () => { logEl.innerHTML = ''; });

// ── MetaMask ────────────────────────────────────────────────────────────────────
const ADI_HEX = '0x' + Number($('chainId').value).toString(16); // e.g. 0x9024 for 36900

async function ensureAdiNetwork(eth) {
  const want = '0x' + Number($('chainId').value).toString(16);
  const current = await eth.request({ method: 'eth_chainId' });
  if (current === want) return true;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] });
    return true;
  } catch (e) {
    // 4902 = chain not added to MetaMask; offer to add it.
    if (e?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: want,
          chainName: 'ADI (' + $('chainId').value + ')',
          rpcUrls: [$('rpcUrl').value.trim()],
          nativeCurrency: { name: 'ADI', symbol: 'ADI', decimals: 18 },
        }],
      });
      return true;
    }
    log('network switch — warning', 'Stay on ' + $('chainId').value + ' for on-chain ops. ' + errMsg(e), 'err');
    return false;
  }
}

$('connectMM').addEventListener('click', async () => {
  const eth = window.ethereum;
  if (!eth) {
    log('MetaMask — not found', 'Install MetaMask (metamask.io) to use the extension wallet, or use a raw key below.', 'err');
    return;
  }
  try {
    const accounts = await eth.request({ method: 'eth_requestAccounts' }); // triggers popup
    await ensureAdiNetwork(eth);
    const provider = new BrowserProvider(eth);
    mmSigner = await provider.getSigner();
    const addr = await mmSigner.getAddress();
    const net = await provider.getNetwork();
    $('mmAddr').value = addr;
    $('mmdot').className = 'dot ok';
    $('mmstate').textContent = 'connected';
    $('mmChainHint').textContent = `Chain ${net.chainId} — (signer) ops will now prompt MetaMask.`;
    log('MetaMask connected', { address: addr, chainId: Number(net.chainId) }, 'chain');

    // React to account/chain changes.
    eth.on?.('accountsChanged', (a) => {
      if (!a.length) { mmSigner = null; $('mmdot').className = 'dot err'; $('mmstate').textContent = 'disconnected'; $('mmAddr').value = ''; log('MetaMask', 'account disconnected', 'err'); }
      else { $('mmAddr').value = a[0]; log('MetaMask', 'account changed → ' + a[0], 'chain'); location.reload(); }
    });
    eth.on?.('chainChanged', () => location.reload());
  } catch (e) {
    log('MetaMask connect — error', errMsg(e), 'err');
  }
});

$('genWallet').addEventListener('click', () => {
  const w = Wallet.createRandom();
  $('pk').value = w.privateKey;
  $('addr').value = w.address;
  mmSigner = null; // prefer this raw key now
  log('wallet generated', { address: w.address, note: 'random — fund with ~0.1 ADI to land on-chain txs. Clears MetaMask preference.' }, 'chain');
});

$('loadWallet').addEventListener('click', () => {
  try {
    const w = new Wallet($('pk').value.trim());
    $('addr').value = w.address;
    log('wallet loaded', { address: w.address }, 'chain');
  } catch (e) {
    log('wallet load — error', errMsg(e), 'err');
  }
});

// Lookup helpers — pre-fill the input from the raw or MetaMask wallet.
$('useMyWallet').addEventListener('click', () => {
  const a = $('addr').value.trim();
  if (!a) { log('lookup', 'Generate or load a raw wallet first.', 'err'); return; }
  $('lookupInput').value = a;
});
$('useMMWallet').addEventListener('click', () => {
  const a = $('mmAddr').value.trim();
  if (!a) { log('lookup', 'Connect MetaMask first.', 'err'); return; }
  $('lookupInput').value = a;
});

// ① Generate the SPONSOR wallet (a human/org). Their DID is wallet-based.
$('genSponsor').addEventListener('click', () => {
  const w = Wallet.createRandom();
  $('sponsorPk').value = w.privateKey;
  $('sponsorDid').value = 'did:adi:' + w.address.toLowerCase();
  log('① sponsor wallet generated', {
    sponsorDid: 'did:adi:' + w.address.toLowerCase(),
    address: w.address,
    role: 'SPONSOR (human/org) — signs the sponsorship attestation with this key',
  }, 'chain');
});

// Auto-derive the sponsor DID from whatever key is pasted (e.g. the operator's
// key, if the operator is also the sponsor). Keeps DID and key consistent.
$('sponsorPk').addEventListener('input', () => {
  const pk = $('sponsorPk').value.trim();
  try {
    const w = new Wallet(pk);
    $('sponsorDid').value = 'did:adi:' + w.address.toLowerCase();
  } catch {
    if (!pk) $('sponsorDid').value = '';
  }
});

// ② Generate the AGENT wallet. Wallet-based so it has an ADDRESS the sponsor can
// delegate to (on-chain delegates are addresses, not DID strings).
$('genAgent').addEventListener('click', () => {
  const w = Wallet.createRandom();
  $('agentAddr').value = w.address;
  $('ssAgentDid').value = 'did:adi:' + w.address.toLowerCase();
  log('② agent wallet generated', {
    agentDid: 'did:adi:' + w.address.toLowerCase(),
    agentAddress: w.address,
    role: 'AGENT — the party being sponsored. The sponsor delegates to this address.',
    note: 'To also register this agent on-chain, fund it and use createDID (signer) with this key.',
  }, 'chain');
});

// ── Multi-chain: populate the network selector from the SDK registry ─────────────
function fillFromChain(c) {
  $('rpcUrl').value = c.rpcUrl;
  $('chainId').value = String(c.chainId);
  $('didRegistry').value = c.didRegistry || '';
  $('agentRegistry').value = c.agentTrustRegistry || '';
  buildClient();
  log('network selected', {
    network: c.name, chainId: c.chainId,
    enabled: c.enabled, faucet: c.faucet ?? '(mainnet)',
    note: c.enabled ? 'Signer ops will submit to this chain.' : 'Registries not deployed here yet — writes will be refused.',
  }, 'chain');
}
{
  const sel = $('networkSel');
  for (const c of listChains()) {
    const o = document.createElement('option');
    o.value = String(c.chainId);
    o.textContent = `${c.name} (${c.chainId})${c.testnet ? ' — testnet' : ''}${c.enabled ? '' : ' — coming soon'}`;
    o.disabled = !c.enabled;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    const c = listChains().find((x) => x.chainId === Number(sel.value));
    if (c) fillFromChain(c);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────────
buildClient();
checkHealth();
setInterval(checkHealth, 15000);

// Best-effort SDK version display (from the installed package.json).
import('@myida/sdk/package.json', { with: { type: 'json' } })
  .then((m) => { $('ver').textContent = 'v' + (m.default?.version ?? m.version ?? '?'); })
  .catch(() => { $('ver').textContent = 'v1.2.0'; });

# AgentSight Quickstart

Runnable examples showing how to use the `@myida/sdk` to mint DIDs, provision AI agents, record trust signals, manage webhooks, resolve DID documents, revoke credentials, and — new in SDK v1.2.0 — run **self-sovereign on-chain** operations signed with your own wallet.

## Prerequisites

- Node.js ≥ 20
- IDA API running locally (`make dev` from the repo root) **or** access to a hosted environment
- For the self-sovereign step (07): a gas-funded ADI wallet (~0.1 ADI). Optional — the step also runs unfunded to prove signing/submission.

## Setup

```bash
cd examples/agentsight-quickstart
npm install
```

## Run the full walkthrough

```bash
npm run all
```

This runs steps 1–6 in sequence using `http://localhost:8080` and the default `dev-api-key`. (Step 07, self-sovereign, is run separately because it needs a funded wallet.)

## Run individual steps

| Command | What it does |
|---|---|
| `npm run 01:mint-did` | Mint a new DID (API-managed) |
| `npm run 02:provision-agent` | Provision AI agents (DID + VC + IBCT key each) — `FLEET_SIZE=3` for several under one sponsor |
| `npm run 03:trust-signals` | Record trust signals against an agent |
| `npm run 04:webhooks` | Register, list, and delete webhook subscriptions |
| `npm run 05:resolve-did` | Fetch and display a DID Document |
| `npm run 06:revocation` | Issue → check → revoke → check a credential |
| `npm run 07:self-sovereign` | **On-chain DID + agent signed with your own wallet** |
| `npm run 08:multichain` | **Multi-chain: discover networks, mint a DID on the chain you choose** |

Steps that need an existing DID accept it via environment variable:

```bash
# Step 2 — use your own operator DID instead of minting a fresh one
OPERATOR_DID=did:adi:... npm run 02:provision-agent

# Step 2 — a fleet of agents under one sponsor, each with its own DID
FLEET_SIZE=3 OPERATOR_DID=did:adi:... npm run 02:provision-agent

# Step 2 — separate operator and sponsor (enterprise: tenant sponsors, team operates)
OPERATOR_DID=did:adi:... SPONSOR_DID=did:adi:... npm run 02:provision-agent

# Step 3 — record signals against a specific agent
AGENT_DID=did:adi:... npm run 03:trust-signals

# Step 4 — manage webhooks for a specific owner
OWNER_DID=did:adi:... npm run 04:webhooks

# Step 5 — resolve any DID
DID=did:adi:... npm run 05:resolve-did

# Step 7 — self-sovereign, using your own funded wallet
PRIVATE_KEY=0x... npm run 07:self-sovereign

# Step 8 — multi-chain: mint a DID on a specific network
PRIVATE_KEY=0x... NETWORK=base-sepolia npm run 08:multichain
PRIVATE_KEY=0x... NETWORK=apiero       npm run 08:multichain
```

### Networks

`npm run 08:multichain` prints the live list — it reads the SDK's chain
registry, so networks appear here as they are deployed rather than being
hard-coded in the examples.

| Network | `NETWORK` | Chain ID | DID format |
|---|---|---|---|
| ADI Mainnet | `adi` | 36900 | `did:adi:0x…` (bare — home chain) |
| ADI Testnet | `adi-testnet` | 99991 | `did:adi:99991:0x…` |
| Apiero | `apiero` | 37001 | `did:adi:37001:0x…` |
| Base Sepolia | `base-sepolia` | 84532 | `did:adi:84532:0x…` |
| Ethereum Sepolia | `sepolia` | 11155111 | `did:adi:11155111:0x…` |

All five registries (DIDRegistry, SchemaRegistry, RevocationRegistry,
AgentTrustRegistry, ZKProofVerifier) are deployed on each enabled network.
Contract addresses repeat across chains — the same deployer at the same nonce
produces the same address everywhere — so the chain ID, not the address, is
what identifies a deployment.

## Targeting a different environment

```bash
IDA_API_URL=https://api.ida.infinia.network \
IDA_API_KEY=your-production-key \
npm run all
```

## What each step demonstrates

**Step 1 — Mint a DID**  
Creates an Ed25519 key pair and anchors the DID on the ADI blockchain. The private key is returned once and must be stored in a secrets manager.

**Step 2 — Provision agents**  
One API call per agent: mints that agent's own DID, issues a W3C AgentIdentityCredential, and returns a one-time IBCT signing key. The recommended entry point for AgentSight integrations.

Every call mints a fresh key pair, so a single sponsor can back a whole fleet — each agent with its own identity, all traceable to one accountable party. Run with `FLEET_SIZE=3` to see it.

`operatorDid` is who runs the agent day to day (it decides whose `/agents/me` the agent appears in); `sponsorDid` is the principal accountable for it, and is optional. Both must be a DID you own, or one this platform has never seen — so an external partner's DID is fine, but naming a DID belonging to another user is refused with 403.

### Naming and grouping agents

`name` is a human-readable label for the agent — without it, a fleet is a list of opaque DIDs.

`labels` are caller-defined key/value pairs stored verbatim; IDA never interprets them. Use whatever dimensions you group by:

```typescript
await client.provisionAgent({
  name: 'Invoice Processor',
  operatorDid,
  labels: { team: 'finance', env: 'prod', costCentre: 'CC-4471' },
  // …
});
```

Then filter, and get back the matching agents with their DIDs:

```bash
GET /api/v1/agents/me?label=team:finance                  # every finance agent
GET /api/v1/agents/me?label=team:finance&label=env:prod   # finance AND prod
```

Repeating `label` requires *all* of them to match, so each one narrows the result. A value without a colon is rejected with 400.

`/agents/me` is scoped to the caller — it returns agents whose operator is the caller's own subject, or a DID the caller owns. So the filter finds your agents when the API key was issued from **Settings** (it resolves to your user) and `OPERATOR_DID` is a DID that user owns. The shared `dev-api-key` authenticates as a sentinel that owns nothing, so it provisions fine but lists nothing back.

Autonomy is earned from recorded trust signals (step 3), and the upper levels require a volume of recorded activity as well as a good score — an agent cannot be promoted to Senior on one or two signals.

> **Note:** `autonomyLevel` in the request is what gets stored, but the `autonomyLevel` in the *response* is derived from the agent's starting trust score (50), so a freshly provisioned agent reports `Junior` even when you asked for `0` (Intern). The stored level is the one that governs permissions — read it back with `getAgent(agentDid)`.

**Step 3 — Trust signals**  
Shows how `task_completed`, `compliance_passed`, and `task_failed` signals move the trust score and change the autonomy level (Intern → Junior → Senior → Principal).

**Step 4 — Webhooks**  
Demonstrates subscribing to `agent.provisioned`, `agent.revoked`, and `agent.trust_updated` events. Deliveries are HMAC-SHA256 signed with your secret.

**Step 5 — Resolve a DID**  
Fetches the W3C DID Document for any `did:adi` identifier, showing the public key material and service endpoints.

**Step 6 — Credential revocation**  
Issues a Verifiable Credential, checks its status, revokes it, and confirms the revoked status.

**Step 7 — Self-sovereign on-chain (new in v1.2.0)**  
Uses your own wallet key to sign and submit transactions **directly to the ADI chain** — no platform key involved. Demonstrates `createDID`, `setAttribute`, `addDelegate`, `registerAgent`, and `recordTrustSignal`, all with `{ signer }`. Each write returns a real `{ txHash, blockNumber }`. The wallet must hold ~0.1 ADI for gas; without it, the step still proves the SDK correctly signs and submits (the chain rejects only for missing gas).

**Step 8 — Multi-chain (new in v1.4.0)**  
Lists the available networks (`listChains`), explains the DID formats
(bare = home chain, `did:adi:<chainId>:0x…` = chain-qualified), demonstrates
self-routing resolution, and mints a DID on the network you pick with a single
`network` parameter: `client.createDID({ signer, network: 'base-sepolia' })`.
Deployed + enabled today: ADI mainnet/testnet, Ethereum Sepolia, Base Sepolia.

## Targeting a different chain

The self-sovereign step reads chain config from env vars (defaults are ADI mainnet):

```bash
RPC_URL=https://rpc.ab.testnet.adifoundation.ai/ \
CHAIN_ID=99999 \
DID_REGISTRY=0xB5dC55fb7acFDFBc826a4c3eaef04F13e799dd57 \
PRIVATE_KEY=0x... \
npm run 07:self-sovereign
```

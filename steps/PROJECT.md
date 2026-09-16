# E-claims — project brief

Local folder: `/Users/satheesh/go/src/gc/e-claims`  
GitHub: https://github.com/satz07/e-claims.git  
Branch: typically `main` (check `git branch`)  
Main apps: `eclaim-backend/` (NestJS) · `eclaim-frontend/` (Next.js) · `deploy-contracts/` (Hardhat)

## What it is

SHA e-claims blockchain stack: claim / pre-auth records are **anchored on-chain** (hashes, amounts, dates — no PHI). NestJS API signs txs and talks to Apeiro L3 (ClaimRegistry + registries). Frontend and MIS integrate via public REST APIs.

## High-level structure

```
e-claims/
├── eclaim-backend/          # NestJS API + seed/ops scripts
│   ├── src/                 # eclaim-contract, registries, auth, …
│   ├── scripts/             # seed-from-db, check-seed-workers, analytics
│   ├── operations-dashboard/# live L2/L3 ops UI (port 8090)
│   └── logs/                # seed progress + chain-tx audits
├── eclaim-frontend/         # Next.js + Wagmi (issue / search / list)
├── deploy-contracts/        # Hardhat · ClaimRegistry.sol
└── docs/                    # integration guides, overview, whitepapers
```

## Chains

* **L3 (Apeiro / Spearhead)** — claim commits (`upsertClaim` / `upsertClaims`)
* **L2 (ADI Mainnet)** — ZK settlement (commit / prove / execute)
* **L1** — Ethereum finality (via rollup)

## Auth (API)

* Public integration routes use API key (see backend env / integration guide)
* Gateway → chain: operator wallet signs; gas paid by platform

## Useful docs

* `docs/eclaims-project-overview.md`
* `docs/eclaims-api-integration-guide.md`
* `docs/demo-runbook.md`
* `eclaim-backend/operations-dashboard/README.md`

## Run locally (quick)

```bash
cd /Users/satheesh/go/src/gc/e-claims/eclaim-backend
yarn install && yarn dev          # API · default :8001

cd /Users/satheesh/go/src/gc/e-claims/eclaim-frontend
# npm/yarn install && npm run dev  # UI

cd /Users/satheesh/go/src/gc/e-claims/eclaim-backend
yarn dashboard:ops               # ops dashboard · :8090
```

## Step files

1. [01-background.md](01-background.md)
2. [02-local-git-setup.md](02-local-git-setup.md)
3. [03-run-locally.md](03-run-locally.md)

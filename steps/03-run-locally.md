# E-claims — run locally

## Prerequisites

* Node.js + yarn/npm
* PostgreSQL access (claim DB / Nest DB as configured)
* `.env` for backend (copy from `eclaim-backend/env.example` if present)
* Working Apeiro RPC URL in `.env`

## 1. Backend

```bash
cd /Users/satheesh/go/src/gc/e-claims/eclaim-backend
yarn install
yarn dev
```

Default API: `http://localhost:8001`  
Prefix: `/api`

Smoke:

```bash
curl -s http://localhost:8001/api/public/integration/health
```

## 2. Frontend (optional)

```bash
cd /Users/satheesh/go/src/gc/e-claims/eclaim-frontend
# install deps, then:
npm run dev
# or yarn dev
```

Point UI env / contract address at the same L3 deployment as backend.

## 3. Contracts (only if deploying)

```bash
cd /Users/satheesh/go/src/gc/e-claims/deploy-contracts
# npm install && npx hardhat compile
# deploy scripts as documented in that folder
```

## 4. Seed from DB (bulk on-chain import)

```bash
cd /Users/satheesh/go/src/gc/e-claims/eclaim-backend
node scripts/seed-from-db.mjs --worker E --from <FROM> --to <TO> --limit 20000 --no-wait --skip-ensure-registries
```

Progress: `logs/db-seed-progress-<WORKER>.json`  
Records: `logs/db-seed-records-<WORKER>.log`

Monitor / auto-restart:

```bash
node scripts/check-seed-workers.mjs
# or loop mode:
node scripts/check-seed-workers.mjs --loop
```

## 5. Operations dashboard

```bash
cd /Users/satheesh/go/src/gc/e-claims/eclaim-backend
yarn dashboard:ops
# → http://localhost:8090
```

Management deck:

```bash
yarn dashboard:ppt
# → operations-dashboard/presentation/eclaims-management-deck.html
```

## 6. RPC check

```bash
curl -s -m 5 -X POST https://rpc.apeiro.adifoundation.ai \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
```

Healthy → JSON with `"result":"0x…"`. Down → `502` / timeout.

## More detail

* Integration: `docs/eclaims-api-integration-guide.md`
* Overview: `docs/eclaims-project-overview.md`
* Demo: `docs/demo-runbook.md`
* Dashboard deploy: `eclaim-backend/operations-dashboard/README.md`

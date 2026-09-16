# E-claims — background (high level)

## Purpose

Anchor insurance **claims and pre-authorizations** on ADI’s Apeiro L3 so submissions are tamper-evident and independently verifiable, without putting PHI on-chain.

## Stack at a glance

```
QA MIS / partner systems
        │  FHIR Bundle + API key
        ▼
eclaim-backend (NestJS · :8001)
        │  ensure registries → upsertClaim(s)
        ▼
ClaimRegistry on Apeiro L3
        │  ZK batches
        ▼
ADI L2 settlement → L1 finality
```

Also:

* **eclaim-frontend** — demo UI (wallet issue / search / list)
* **seed-from-db** — bulk import from PostgreSQL claim DB onto chain
* **check-seed-workers** — monitor / auto-restart seed when RPC recovers
* **operations-dashboard** — live L2/L3 KPIs (often under `/operation/` on server)

## What is on-chain

* Claim hash, amount, dates, status, registry IDs
* Events such as `ClaimUpserted`
* Provider / citizen / scheme registries as needed

## What stays off-chain

* Full FHIR payloads and patient-identifying detail
* Optional display metadata (`claim-meta.json` / DB)

## Key backend routes (integration)

| Area | Path prefix |
|------|-------------|
| Health / integration | `/api/public/integration/…` |
| Submit claim | `/api/public/eclaim-contract/submit` |
| Registries | `/api/public/provider-registry/…` (and related) |

Full details: `docs/eclaims-api-integration-guide.md`

## Ops notes (server)

* Backend often run under **pm2** as `eclaim-backend_v2`
* Seed workers (`A`–`F`) use **disjoint claim_number ranges** and progress files under `eclaim-backend/logs/`
* RPC URL in `.env` must be healthy for seed + submit to work
* Ops dashboard: `yarn dashboard:ops` or nginx path `/operation/`

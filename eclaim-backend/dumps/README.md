# Claim sample dumps (no DB access for teammates)

## Export (maintainers — VPN + `CLAIM_DB_*`)

```bash
cd eclaim-backend

# Prefer a high claim_number range less likely already seeded
node scripts/export-db-sample.mjs --limit 200 --after 780000 --out dumps/qa-sample.jsonl
```

Skips:

- duplicate `claim_id` in the dump
- zero amount
- IDs already in local `logs/db-seed-records*.log` (OK/DUP)
- claims already on-chain (V1 + V3 `claimIdHash` scan)

Optional: `--skip-onchain-check` (faster, less safe).

## Seed (teammates — no DB)

```bash
cd eclaim-backend
# BACKEND_URL=http://localhost:8001   # or shared seed server

node scripts/seed-from-dump.mjs --file dumps/qa-sample.jsonl --limit 50 --no-wait
```

Dump is **JSONL rows** (not FHIR). FHIR is built at submit time. Missing providers / schemes / citizens are registered via the backend when the wallet is allowed.

## Share

Send `dumps/qa-sample.jsonl` + `qa-sample.meta.json` (zip / Drive). Do **not** share DB passwords.

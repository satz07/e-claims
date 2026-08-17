# E-Claims Analytics — 2026-08-17

> L3 claim commits on Apeiro · L2 settlement batches via BLS explorer · QA MIS import progress

## Executive summary

| Metric | Value |
|--------|-------|
| Unique claims anchored (ClaimUpserted) | **9,170** |
| Total eligible claims + pre-auths | **— (DB not connected)** |
| Import progress vs eligible DB rows | **—** |
| Apeiro L2 settlement blocks (BLS explorer) | **62,933** |
| ADI Mainnet L2 blocks (BLS explorer) | **931,331** |

## Full metrics

| Category | Metric | Value |
|----------|--------|-------|
| L3 — Application layer (Apeiro) | Chain ID / network | 37001 · Apeiro L3 |
| L3 — Application layer (Apeiro) | Current L3 block height | 62,932 |
| L3 — Application layer (Apeiro) | ClaimRegistry contract | 0xC797A6e0c7C2F631F176279980E638FBB255E9B0 |
| L3 — Claim commits | Unique claims anchored (ClaimUpserted) | 9,170 |
| L3 — Claim commits | L3 commit transactions (unique tx hashes) | NaN |
| L3 — Claim commits | Claims imported (seed logs) | 9,170 |
| L3 — Claim commits | Pre-auths imported (seed logs) | 0 |
| L3 — Claim commits | Import errors (seed logs) | 11,053 |
| L3 — QA MIS database | Total eligible claims + pre-auths | — (DB not connected) |
| L3 — QA MIS database | Import progress vs eligible DB rows | — |
| L3 — QA MIS database | Claim number range in DB | — |
| L2 — Settlement layer (BLS) | Apeiro L2 settlement blocks (BLS explorer) | 62,933 |
| L2 — Settlement layer (BLS) | Apeiro L2 settlement transactions (BLS) | 89,367 |
| L2 — Settlement layer (BLS) | ADI Mainnet L2 blocks (BLS explorer) | 931,331 |
| L2 — Settlement layer (BLS) | ADI Mainnet L2 transactions (BLS) | 1,615,473 |
| L2 — Settlement layer (BLS) | ADI Mainnet L2 block height (RPC) | 931,335 |
| Cost & operations | Gas spent (chain-tx audit logs, ADI) | 0 ADI (11,287 txs) |
| Cost & operations | Avg gas per anchor tx (audit logs) | 0 ADI |
| Cost & operations | Backend health | Healthy |

## Worker import status

| Worker | Claims OK | Preauths OK | Errors | Last claim # | Last import |
|--------|-----------|-------------|--------|--------------|-------------|
| A | 2,191 | 0 | 181 | 379,305 | 2026-08-13T12:40:26.327Z |
| C | 6,881 | 0 | 10,872 | 376,895 | 2026-08-06T19:12:36.564Z |
| D | 98 | 0 | 0 | 376,995 | 2026-08-13T12:40:44.406Z |
| F | 0 | 0 | 0 | 413,013 | — |

## Architecture (for slides)

```
QA MIS DB → E-Claims Backend → L3 ClaimRegistry (Apeiro)
                              ↓ commit batches
                         L2 ADI settlement (BLS)
                              ↓ ZK proofs
                         L1 Ethereum finality
```

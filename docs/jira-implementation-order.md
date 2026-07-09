# Jira implementation order — blockchain expansion

Work **top to bottom**. Each row depends on the previous unless marked parallel.

| Order | Jira theme | Deliverable | Repo area |
|------|------------|-------------|-----------|
| **1** | Provider Registry (`ProviderRegistry.sol`) | Registration, de-registration, status history, events | `deploy-contracts/contracts/ProviderRegistry.sol` |
| **2** | Provider license management | License dates, expiry flagging, license history | Same contract (extends #1) |
| **3** | Provider tier management | Tier assign/change, tier history, audit events | Same contract (extends #1) |
| **4** | Deploy ProviderRegistry to Spearhead test | Deploy script + address in docs | `deploy-contracts/scripts/` |
| **5** | Integrate claim validation with Provider Registry | `ClaimRegistry` checks provider before upsert | `ClaimRegistry.sol` + backend |
| **6** | PreAuth contract design (`PreAuthRegistry.sol`) | Create, approve, reject, expiry | New contract |
| **7** | Link guarantee records to claims | `consumePreAuth`, `guaranteeIdHash` mapping | PreAuth + ClaimRegistry + backend |
| **8** | Pre-auth lifecycle events | Requested / Approved / Rejected / Expired | PreAuth contract |
| **9** | Pre-authorization dashboard APIs | Search by provider, guarantee, patient hash | `eclaim-backend` |
| **10** | Settlement ledger (`PaymentLedger.sol`) | Payment records, refs, timestamps, events | New contract |
| **11** | Record provider settlement transactions | Claim + provider + amount on-chain | PaymentLedger + backend |
| **12** | Payment verification service | ERP callback → chain tx, failure handling | `eclaim-backend` |
| **13** | Settlement reporting dashboard | History + export | Backend + frontend |

**Current status:** **#1–#4 done.** Next: **#5** — integrate claim validation with `ProviderRegistry`.

See [blockchain-expansion-plan.md](./blockchain-expansion-plan.md) for architecture detail.

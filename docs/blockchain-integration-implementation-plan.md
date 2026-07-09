# Blockchain integration — implementation plan (roadmap)

> **For this week's planned delivery**, see **[E-claims weekly implementation plan](./eclaims-weekly-implementation-plan.md)** — contracts, APIs, dependencies, and acceptance criteria framed as **to do**.

**Audience:** Engineering, project management, integration partners  
**Purpose:** Longer-term roadmap for Spearhead L3 in the SHA E-claims programme.

**Related docs:**
- [Weekly plan (this week)](./eclaims-weekly-implementation-plan.md) ← **start here**
- [FHIR integration mapping](./blockchain-fhir-integration.md)
- [Network & contract reference](./network-and-contract-reference.md)
- [Blockchain whitepaper](./blockchain-whitepaper.md)

---

## Programme scope

| In scope (E-claims delivery) | Out of scope (national / other systems) |
|------------------------------|----------------------------------------|
| `ClaimRegistry` minimal anchor | `ProviderRegistry` on-chain validation |
| FHIR QA MIS submit (claim + pre-auth) | Payers adjudication sync |
| Backend-sponsored gas | IFS / Payment Gateway settlement on-chain |
| Read/list/search APIs | `PaymentLedger`, `PreAuthRegistry` |

---

## Roadmap phases (after week 1)

| Phase | Focus | Duration (indicative) |
|-------|--------|------------------------|
| **1** | ClaimRegistry + FHIR submit + portal | This week — see [weekly plan](./eclaims-weekly-implementation-plan.md) |
| **2** | Production hardening (auth, KMS, monitoring) | 1–2 weeks |
| **3** | Payers status webhook → `setClaimStatus` | 2 weeks |
| **4** | Provider master sync / ProviderRegistry | 2 weeks |
| **5** | Payment settlement anchor | 3–4 weeks |
| **6** | Regulator dashboards, fraud analytics | Post-MVP |

---

## Design principles

1. **Anchor, do not replicate** — full FHIR and PHI stay off-chain.
2. **Hash-only on-chain** — `bundleContentHash` proves full bundle integrity.
3. **Backend signs production txs** — providers do not need wallets.
4. **One hash rule** — `keccak256(utf8(string))` everywhere.

---

## Success metrics (programme)

| Metric | Target |
|--------|--------|
| Submit API p95 latency | < 10s including chain |
| Duplicate claim prevention | 100% at intake |
| Zero PHI on-chain | Privacy review pass |
| Payers–chain status match | 99% within 5 min (when Phase 3 live) |

---

*This file is the long-term roadmap. Detailed technical specs and weekly tasks are in [eclaims-weekly-implementation-plan.md](./eclaims-weekly-implementation-plan.md).*

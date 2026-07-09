# E-Claims — Weekly Implementation Plan

**Target:** Spearhead **Mainnet** deployment  
**Programme:** SHA E-claims / ADI Spearhead  
**Week of:** 7 July 2026

---

## 1. Objective (this week)

Prepare and deploy the E-Claims claim anchoring platform on **Spearhead Mainnet** so that:

1. A provider can submit a full institutional FHIR bundle (claim or pre-authorization).
2. E-Claims validates the bundle and anchors hashed fields on the blockchain.
3. Users can submit, list, and search anchored claims through the portal.
4. Configuration, documentation, and demo materials are ready for SHA review.

---

## 2. What will be done this week

| Area | Work |
|------|------|
| **Smart contract** | Finalize Claim Registry; deploy to Spearhead Mainnet; record contract address and owner wallet |
| **Backend** | FHIR parser, submit API, list/search/get APIs, duplicate check, sponsored gas from production signer |
| **Frontend** | Submit FHIR page, claims list, claim search |
| **Configuration** | Mainnet RPC, contract address, owner wallet, gas funding |
| **Documentation** | Implementation plan, runbook, network reference for SHA and partners |
| **Testing** | End-to-end submit → anchor → list → search on mainnet |

---

## 3. Features available after this week

| Feature | Available |
|---------|-----------|
| Submit institutional FHIR **claim** | Yes |
| Submit institutional FHIR **pre-authorization** | Yes |
| Full bundle integrity hash on-chain | Yes |
| Duplicate claim prevention | Yes |
| Sponsored gas (provider does not need a wallet) | Yes |
| List anchored claims | Yes |
| Search by Claim ID or claim number | Yes |
| Duplicate check before submit | Yes |
| Optional manual status update | Yes |
| Portal submit, list, and search | Yes |
| Transaction visible on Spearhead explorer | Yes |
| No PHI on-chain (hash-only model) | Yes |

**Not included this week:** payer status sync, provider registry validation, payment settlement on-chain, regulator dashboard, member/benefit registries.

---

## 4. Dependencies

- Spearhead Mainnet access and production RPC (ADI Foundation)
- Funded owner wallet with ADI for gas
- PostgreSQL and Redis for backend
- Golden FHIR sample bundle (QA MIS profile)

---

## 5. Acceptance criteria (end of week)

1. Full FHIR bundle anchors successfully on **mainnet** without a provider wallet.  
2. Duplicate Claim UUID is rejected.  
3. No personal health information on-chain.  
4. Pre-authorization works with `Claim.use = preauthorization`.  
5. Anchored claims appear in list and search.  
6. Transaction visible on Spearhead mainnet explorer.  
7. Clear errors when owner wallet or gas is misconfigured.

---

**Full programme roadmap:** [eclaims-implementation-plan.md](./eclaims-implementation-plan.md) · [ADI programme c–f](./adi-programme-eclaims-implementation-plan.md)

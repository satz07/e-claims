# Jira backlog — data classification, contracts, and APIs

Epic-level breakdown for E-claims blockchain integration based on FHIR claim bundle design, existing `ClaimRegistry` / `ProviderRegistry`, and integration with Provider, Payers, IFS, and Payment Gateway.

**Status:** ProviderRegistry (#1–4) done. Remaining items below are ready for Jira import.

---

## EPIC A — Data architecture: database vs blockchain

### A1. Define on-chain vs off-chain data classification

**Type:** Story / Spike  
**Priority:** Highest (blocks all contract and API work)

**Description:**  
Document which FHIR bundle and E-claims fields are stored in operational databases (Payers DB, IFS, HAPI, datalake) versus which are anchored on Spearhead L3. Align with SHA data governance and privacy requirements.

**Scope — OFF-CHAIN (DB / Payers / IFS only):**
- Full FHIR Bundle JSON
- Patient: name, birthDate, gender, phone, address
- Practitioner resources
- Coverage details (SHA + PMF dual coverage objects)
- Diagnosis narrative and ICD display text
- Claim items, intervention descriptions, attachments (PDF URLs and files)
- Invoice line detail, patient share breakdown
- Rule Engine decisions, global budget allocations
- ERP payment instructions and bank account detail

**Scope — ON-CHAIN (hashes, amounts, status, timestamps only):**
- Claim UUID (`claimIdHash`)
- Bundle ID and canonical bundle content hash (`bundleIdHash`, `shaPackageCodeHash`)
- Facility ID FID (`providerIdHash` — validate via ProviderRegistry)
- Patient CR id and optional national ID (`crIdHash`, `nationalIdHash`) — hashed only
- Claim type / subType (`claimTypeHash`, `ipsClaim`)
- Intervention code optional (`claimCodeHash` e.g. PMF-12-001)
- Scheme code optional (`accessCodeHash` e.g. CAT-SHA-001)
- Claimed / approved / adjustment amounts
- Service period (`dateFrom`, `dateTo`)
- Pre-auth guarantee id (`guaranteeIdHash`)
- External refs: invoice id, payer claim number (`externalIdHash`)
- Lifecycle status and adjudication milestones
- Payment reference hash (PaymentLedger — future)

**Acceptance criteria:**
- [ ] Data classification matrix published (FHIR path → storage location → ClaimRegistry field if any)
- [ ] Privacy review: no plaintext PII on-chain
- [ ] Signed off by architecture / SHA data governance
- [ ] Referenced by all contract and API stories below

---

### A2. Define canonical bundle hashing standard

**Type:** Story  
**Priority:** High

**Description:**  
Specify how E-claims computes `shaPackageCodeHash` from inbound FHIR bundles (canonical JSON rules, field ordering, excluded fields) so Payers, providers, and auditors can reproduce the hash for dispute resolution.

**Acceptance criteria:**
- [ ] Canonicalization rules documented (UTF-8, stable key order, normalised dates)
- [ ] Sample bundle (institutional ip claim with dual coverage) produces documented test vector
- [ ] Backend and any client SDK use the same algorithm as documented

---

### A3. Define identifier and hashing conventions

**Type:** Story  
**Priority:** High

**Description:**  
Standardise `keccak256(utf8(string))` usage across contracts, backend, and integration guides. Document mapping for FID, CR id, claim UUID, guarantee id, intervention codes, invoice identifiers.

**Acceptance criteria:**
- [ ] Convention doc aligned with `ClaimRegistry.hashString` and ProviderRegistry
- [ ] Empty string → zero hash rule documented
- [ ] Examples for sample bundle: FID-35-108719-7, CR3248022528592-4, PMF-12-001

---

## EPIC B — ClaimRegistry enhancement and validation

### B1. Design ClaimRegistry V2 (provider validation + providerIdHash)

**Type:** Story  
**Priority:** High

**Description:**  
Current `ClaimRegistry` uses `providerNameHash` / `providerLevelHash` on the claim struct but has no `providerIdHash` field and does not call `ProviderRegistry`. Design V2 to validate `Organization.id` (FID) before `upsertClaim` and emit validation events.

**Acceptance criteria:**
- [ ] Solidity design reviewed: add `providerIdHash` or reuse existing fields consistently
- [ ] `upsertClaim` calls `ProviderRegistry.isProviderAuthorized(providerIdHash, dateFrom)` or equivalent
- [ ] Events: `ClaimProviderValidated`, `ClaimProviderRejected` (or equivalent)
- [ ] Rejected claims do not persist on-chain
- [ ] Migration plan for existing Spearhead deployment documented

---

### B2. Implement and deploy ClaimRegistry V2 to Spearhead testnet

**Type:** Story  
**Priority:** High  
**Depends on:** B1

**Description:**  
Implement, test, and deploy ClaimRegistry V2 with provider gate. Update deploy scripts and network reference documentation.

**Acceptance criteria:**
- [ ] Unit / integration tests for valid FID, invalid FID, expired license
- [ ] Deployed address and tx recorded in network-and-contract-reference.md
- [ ] ABI exported to backend

---

### B3. Map FHIR Claim bundle fields to ClaimRegistry struct

**Type:** Story  
**Priority:** High  
**Depends on:** A1, A2

**Description:**  
Implement mapping specification (not necessarily code) from QA MIS FHIR bundle to `ClaimRegistry.Claim` for institutional inpatient claims with dual coverage (SHA + PMF).

**Mapping reference (sample bundle):**

| FHIR source | ClaimRegistry field |
|-------------|---------------------|
| Claim.identifier (UUID) | claimIdHash |
| Bundle.id | bundleIdHash |
| Canonical bundle | shaPackageCodeHash |
| Organization.id (FID) | providerIdHash (V2) + ProviderRegistry check |
| Organization facility-level | providerLevelHash |
| Patient.id (CR) | crIdHash |
| Patient nationalid | nationalIdHash |
| Claim.total | claimedTotal |
| billablePeriod | dateFrom, dateTo |
| Claim.type / subType ip | claimTypeHash, ipsClaim |
| item PMF-12-001 | claimCodeHash |
| extension patientInvoiceIdentifier | externalIdHash |
| related pre-auth | guaranteeIdHash |
| Payers adjudication | approvedTotal, adjustment, status |

**Acceptance criteria:**
- [ ] Mapping doc covers all ClaimRegistry struct fields (used vs reserved vs zero)
- [ ] Dual coverage (sha-coverage + pmf-coverage) handling defined
- [ ] invoiceAmount (2111) vs Claim.total (11000) business rule documented

---

## EPIC C — E-claims submission API (FHIR → chain → Payers)

### C1. Design POST /api/eclaim/submit API

**Type:** Story  
**Priority:** High  
**Depends on:** A1, B3

**Description:**  
Design the primary E-claims submission endpoint that accepts a FHIR Bundle, validates structure, checks provider authorization, anchors on Spearhead, and forwards to Payers System API.

**Proposed flow:**
1. Receive FHIR Bundle (message type)
2. Parse Organization, Patient, Claim, Coverage entries
3. Validate required fields and profiles
4. ProviderRegistry check for FID at billablePeriod.start
5. Build Claim struct; `upsertClaim` (owner-signed backend tx)
6. Forward full bundle to Payers
7. Return `{ claimId, claimNumber, txHash, bundleHash, payerResponse }`

**Acceptance criteria:**
- [ ] OpenAPI spec drafted
- [ ] Error codes defined: invalid FHIR, unauthorized provider, duplicate claimId, payer reject, chain tx failure
- [ ] Idempotency strategy documented (claimIdHash dedup)
- [ ] Auth model documented (provider credential / API key)

---

### C2. Implement FHIR bundle parser and extractor service

**Type:** Story  
**Priority:** High  
**Depends on:** C1, B3

**Description:**  
Backend service to extract resources from Bundle.entry by resourceType: Organization, Patient, Claim, Coverage. Handle variable entry order.

**Acceptance criteria:**
- [ ] Parses sample institutional ip bundle with dual coverage
- [ ] Extracts FID, CR id, claim UUID, totals, dates, intervention code
- [ ] Returns structured DTO for chain mapper and Payers forwarder
- [ ] Unit tests with provided QA MIS sample JSON

---

### C3. Implement claim anchor writer (backend → ClaimRegistry)

**Type:** Story  
**Priority:** High  
**Depends on:** B2, C2

**Description:**  
NestJS service method to map extracted FHIR DTO to `ClaimRegistry.Claim` and submit via `OWNER_PRIVATE_KEY`. No MetaMask in production path.

**Acceptance criteria:**
- [ ] Successful anchor returns txHash and claimNumber
- [ ] Duplicate claimIdHash rejected or handled per idempotency rule
- [ ] Failed chain tx does not forward to Payers (or compensating flow documented)

---

### C4. Implement Payers forwarder integration

**Type:** Story  
**Priority:** High  
**Depends on:** C1

**Description:**  
After successful on-chain anchor, POST full FHIR bundle to Payers / Claim Engine API. Correlate payer response claim id with `externalIdHash` or follow-up update.

**Acceptance criteria:**
- [ ] Integration with Payers submit endpoint configured per environment
- [ ] Payer claim number / reference stored off-chain and optionally anchored
- [ ] Retry and failure handling documented

---

### C5. Implement claim status sync API (Payers → chain)

**Type:** Story  
**Priority:** Medium  
**Depends on:** C3

**Description:**  
Webhook or polling job receives adjudication outcomes from Payers and calls `setClaimStatus`, `approvedTotal`, `adjustment` on ClaimRegistry.

**Acceptance criteria:**
- [ ] Maps Payers statuses to ClaimRegistry.Status enum
- [ ] Updates: APPROVED, REJECTED, SENT_BACK, SENT_FOR_PAYMENT_PROCESSING, MEDICAL_REVIEW
- [ ] Audit log of each sync with payer reference
- [ ] Idempotent status updates

---

### C6. Implement claim search and audit read APIs

**Type:** Story  
**Priority:** Medium  
**Depends on:** C3

**Description:**  
Extend public APIs for operational and audit use: search by claimId, FID, date range, status; read on-chain state merged with off-chain payer reference only (no PII).

**Acceptance criteria:**
- [ ] GET/POST search by claimId (hash internally)
- [ ] GET claim by claimNumber with on-chain fields only
- [ ] GET claim audit timeline (events: submitted, status changes, payment)
- [ ] Pagination for list endpoints

---

## EPIC D — Provider registry integration (mostly done — remaining)

### D1. Provider sync job from Provider master / IFS to ProviderRegistry

**Type:** Story  
**Priority:** Medium

**Description:**  
Scheduled job syncs Facility Registry (KMPDC / FR) and license data into ProviderRegistry on Spearhead. Maps FID, LEVEL, license dates. Keeps chain aligned with national master without storing full org records on-chain.

**Acceptance criteria:**
- [ ] Sync source API documented (Provider master or IFS)
- [ ] Batch register/update/suspend on-chain
- [ ] Drift report: facilities in master but not on-chain
- [ ] Manual override process for exceptions

---

### D2. Expose provider authorization check API for HIE / Payers

**Type:** Story  
**Priority:** Low  
**Depends on:** ProviderRegistry deployed

**Description:**  
`GET /api/public/provider-registry/authorize?fid=&date=` returns on-chain authorization result for use by E-claims, HIE validations, or Payers pre-checks.

**Acceptance criteria:**
- [ ] Returns authorized true/false with status and license window
- [ ] Reads live from ProviderRegistry (no stale cache)
- [ ] Response time suitable for synchronous claim intake

---

## EPIC E — PreAuthRegistry

### E1. Design PreAuthRegistry.sol

**Type:** Story  
**Priority:** Medium  
**Depends on:** A1

**Description:**  
Design smart contract for guarantee letters and pre-authorizations: request, approve, reject, expire, single-use consume linked to claim.

**Acceptance criteria:**
- [ ] Struct and status enum defined
- [ ] Events: Requested, Approved, Rejected, Expired, Consumed
- [ ] consumePreAuth enforces one-time use and links to claimNumber
- [ ] Design reviewed against FHIR Claim.related pre-auth relationship

---

### E2. Implement and deploy PreAuthRegistry to Spearhead testnet

**Type:** Story  
**Priority:** Medium  
**Depends on:** E1

**Acceptance criteria:**
- [ ] Contract compiled, tested, deployed
- [ ] Address in network reference doc
- [ ] ABI in backend

---

### E3. Link pre-auth to claim submission (guaranteeIdHash)

**Type:** Story  
**Priority:** Medium  
**Depends on:** E2, C3, B2

**Description:**  
When FHIR Claim.related contains pre-auth relationship, extract guarantee UUID, verify PreAuth APPROVED, set `guaranteeIdHash` on claim, call `consumePreAuth` on successful submission.

**Acceptance criteria:**
- [ ] Submission rejected if pre-auth required but missing, expired, or already consumed
- [ ] claim.guaranteeIdHash populated on-chain
- [ ] Consumed state visible in PreAuth read API

---

### E4. Pre-authorization dashboard APIs

**Type:** Story  
**Priority:** Medium  
**Depends on:** E2

**Description:**  
Backend APIs for operations: search pre-auth by provider FID (hash), guarantee id, patient CR hash (hash); filter by status.

**Acceptance criteria:**
- [ ] POST search with filters
- [ ] GET pre-auth detail with on-chain status and history
- [ ] GET link to consumed claim if applicable
- [ ] No plaintext patient data in responses

---

### E5. Sync pre-auth lifecycle from Payers

**Type:** Story  
**Priority:** Medium  
**Depends on:** E2, E4

**Description:**  
Integrate Payers predetermination / pre-auth adjudication callbacks to call approve/reject/expire on PreAuthRegistry.

**Acceptance criteria:**
- [ ] Payers approve maps to on-chain approvePreAuth
- [ ] Reject maps to rejectPreAuth with reason hash
- [ ] Expiry job flags expired pre-auths

---

## EPIC F — PaymentLedger and settlement

### F1. Design PaymentLedger.sol

**Type:** Story  
**Priority:** Medium  
**Depends on:** A1

**Description:**  
Append-only ledger for settlement: claimNumber, providerIdHash, amount, payment reference hash, paidAt, reversal flag.

**Acceptance criteria:**
- [ ] Struct and events defined
- [ ] recordPayment and reversePayment specified
- [ ] Link to ClaimRegistry status (optional PAID enum) documented

---

### F2. Implement and deploy PaymentLedger to Spearhead testnet

**Type:** Story  
**Priority:** Medium  
**Depends on:** F1

**Acceptance criteria:**
- [ ] Deployed and documented
- [ ] Tests for record, duplicate reference handling, reversal

---

### F3. IFS / Payment Gateway payment confirmation integration

**Type:** Story  
**Priority:** Medium  
**Depends on:** F2, C5

**Description:**  
When IFS forwards payment to CPP/Bank and payment status returns, backend records `PaymentLedger.recordPayment` and updates claim status.

**Acceptance criteria:**
- [ ] Callback or poll from IFS/CPP documented
- [ ] Payment reference from bank stored as hash on-chain
- [ ] Failure handling: payment failed does not record false positive
- [ ] Notification flow aligned with national architecture (MOH, Provider, Payers)

---

### F4. Settlement reporting and export APIs

**Type:** Story  
**Priority:** Low  
**Depends on:** F3

**Description:**  
APIs for finance and audit: claim settlement history, provider payment history, export CSV/JSON. On-chain data merged with off-chain payer/ERP refs.

**Acceptance criteria:**
- [ ] GET settlements by claim, provider, date range
- [ ] Export endpoint with pagination
- [ ] Dashboard wireframe or API contract for frontend

---

## EPIC G — Cross-cutting platform

### G1. Centralise contract addresses and chain config

**Type:** Story  
**Priority:** Medium

**Description:**  
Move hardcoded RPC, contract addresses, and owner config to environment variables / config service for ClaimRegistry, ProviderRegistry, PreAuthRegistry, PaymentLedger.

**Acceptance criteria:**
- [ ] env.example updated
- [ ] Per-environment config for QA and production Spearhead
- [ ] No secrets in repository

---

### G2. Event indexer and audit timeline service

**Type:** Story  
**Priority:** Medium  
**Depends on:** B2, E2, F2

**Description:**  
Unified backend service scanning ClaimUpserted, ProviderRegistered, PreAuth*, PaymentRecorded events to build per-claim audit timelines for dashboards and regulators.

**Acceptance criteria:**
- [ ] Chunked event scan (existing pattern) extended to all contracts
- [ ] GET /api/audit/claim/:id/timeline
- [ ] Timestamps and tx hashes included

---

### G3. End-to-end integration test harness (FHIR sample → chain → mock Payers)

**Type:** Story  
**Priority:** Medium  
**Depends on:** C3, C4

**Description:**  
Automated test using provided QA MIS bundle JSON: parse, anchor, verify on-chain state, mock Payers forward.

**Acceptance criteria:**
- [ ] Test runs in CI against Spearhead testnet or local fork
- [ ] Covers institutional ip claim with FID-35-108719-7 sample
- [ ] Documents expected on-chain field values

---

### G4. Update GitBook / whitepaper with API and data model

**Type:** Story  
**Priority:** Low  
**Depends on:** A1, C1

**Description:**  
Update blockchain-fhir-integration.md and API reference when designs are approved.

**Acceptance criteria:**
- [ ] FHIR mapping reflects dual coverage bundle
- [ ] API spec linked from docs/SUMMARY.md
- [ ] Whitepaper unchanged (narrative only); technical detail in integration doc

---

## Suggested Jira import order

| Sprint theme | Tasks |
|--------------|-------|
| Foundation | A1, A2, A3, B3 |
| Claim gate | B1, B2, D1 |
| Submit API | C1, C2, C3, C4 |
| Adjudication sync | C5, C6 |
| Pre-auth | E1, E2, E3, E4, E5 |
| Payments | F1, F2, F3, F4 |
| Platform | G1, G2, G3, G4, D2 |

---

## Quick reference: what goes where

**Database / Payers / IFS (never blockchain):**  
Patient name, phone, birthDate, PDFs, full FHIR, diagnosis text, coverage objects, Rule Engine output, ERP bank details.

**Blockchain only:**  
claimIdHash, bundleIdHash, bundle content hash, providerIdHash (FID), crIdHash, nationalIdHash (hashed), claimTypeHash, claimCodeHash, claimedTotal, approvedTotal, adjustment, dateFrom, dateTo, guaranteeIdHash, externalIdHash, status, paymentReferenceHash.

**ProviderRegistry (separate contract):**  
FID registration, license dates, tier level, active/suspended/expired status.

E-CLAIMS BLOCKCHAIN WHITEPAPER

Prepared for: Social Health Authority (SHA) E-claims programme / ADI Spearhead L3 discussion
Version: 2.0 (aligned with SHA gap analysis + current implementation)
Status: Institutional whitepaper — ClaimRegistry-only scope on Spearhead testnet
Date: June 2026

IMPLEMENTATION SCOPE (read first)
  IMPLEMENTED NOW: FHIR QA MIS bundle → ClaimRegistry anchor (claim + pre-auth via Claim.use)
  NOT IN E-CLAIMS SCOPE: ProviderRegistry, Payers sync, IFS sync, PaymentLedger, provider wallet gas
  NATIONAL ECOSYSTEM (future): adjudication, payment proof, provider master validation — other SHA systems

HOW TO USE THIS DOCUMENT IN WORD OR GOOGLE DOCS
1. Select all text in this file and copy.
2. Paste into Word or Google Docs using Paste (Ctrl+V / Cmd+V).
3. Apply Heading 1 to main section titles (e.g. "1. Executive Summary").
4. Apply Heading 2 to subsections (e.g. "1.1 Problem").
5. Select tab-separated rows (tables below) and use Insert > Table > Convert Text to Table (Word) or let Google Docs auto-detect tabs.
6. Replace ASCII diagram placeholders with SmartArt or draw.io diagrams if required for publication.

================================================================================
1. EXECUTIVE SUMMARY
================================================================================

1.1 Problem

Healthcare claims in the SHA ecosystem move across multiple independent systems and organisations — Provider, Payers, IFS, and the Payment Gateway. Each platform maintains its own database, identifiers, audit logs, and version of events. When parties disagree about what was submitted, when it was approved, or whether payment occurred, reconciliation depends on manual cross-matching of siloed records.

This creates:
  • Duplicate or replayed claims across adjudication cycles
  • Claims from unauthorised or expired facilities entering the flow
  • Delayed payment disputes and inconclusive audits
  • High manual effort for regulators and internal audit teams

1.2 Proposed solution (E-claims programme scope)

E-claims introduces a thin blockchain trust layer on Spearhead L3 using a single smart contract: ClaimRegistry. The E-claims platform receives FHIR R4 Bundles from the provider channel, extracts anchor fields (hashes, amounts, dates), and signs upsertClaim on Spearhead. Full FHIR payloads, clinical data, and personal health information are never stored on-chain.

E-claims does not integrate directly with Payers, IFS, or Provider master systems in this phase. It anchors claims and pre-authorizations only. Both record types use the same FHIR bundle structure; Claim.use distinguishes claim (use = "claim") from pre-authorization (use = "preauthorization").

1.3 Technology choice

Spearhead operates as an ADI Layer 3 zero-knowledge rollup chain. Transactions execute on L3, batches are proved and settled to ADI Chain (L2), and security ultimately anchors to Ethereum (L1). This provides dedicated programme capacity, verifiable execution, and institutional-grade settlement without publishing sensitive payloads on a public ledger.

1.4 Expected outcomes (current implementation)

Outcome                          | Status | Description
---------------------------------|--------|------------------------------------------------------------
Tamper-evident submission        | Live   | Proof that a claim or pre-auth was lodged with amount and date
Duplicate prevention             | Live   | Same claim UUID rejected at intake (claimIdHash mapping)
Bundle integrity                 | Live   | bundleContentHash binds full FHIR bundle off-chain
Privacy by design                | Live   | No plaintext PHI; hash-only anchoring
Pre-auth and claims              | Live   | Same FHIR bundle; Claim.use = claim | preauthorization
Provider authorization on-chain  | Future | ProviderRegistry — national programme, not E-claims today
Adjudication / payment on-chain  | Future | Payers / IFS / CPP integration — national programme

Deployed (Spearhead testnet):
  • ClaimRegistry at 0xA8eFbf955496518D6e3Cb10ABC90627671534088
  • POST /api/public/eclaim-contract/submit (backend-signed upsertClaim)
  • Submit FHIR portal, list / search / duplicate-check APIs


================================================================================
2. BACKGROUND AND PROBLEM STATEMENT
================================================================================

2.1 National claims context

The Social Health Authority coordinates a national claims ecosystem where providers deliver services, submit pre-authorizations and claims, and receive payment through a multi-party chain. A single institutional claim may include:

  • Facility identity (Facility Identifier — FID)
  • Patient beneficiary record (Afyaangu CR id)
  • Clinical and intervention detail (diagnosis, items, attachments)
  • Dual or multiple coverage (e.g. SHA + PMF)
  • Adjudication outcomes and adjustments
  • Invoice and bank settlement through ERP and payment gateway

Each system is authoritative for its domain. None holds a record that all parties accept as neutral when disputes arise.

2.2 Concrete pain points

Pain point              | Impact
------------------------|------------------------------------------------------------
Duplicate claims        | Same claim UUID or bundle resubmitted; difficult to detect across systems
Unauthorised providers  | Facilities not registered, suspended, or outside license period submit claims
Reconciliation delays   | Matching payer claim numbers, invoice ids, and payment refs is manual
Payment disputes        | Proof of approval vs proof of payment held in separate databases
Audit effort            | Investigators reconstruct timelines from heterogeneous logs
Pre-auth abuse          | Guarantee letters reused or not linked to subsequent claims

2.3 Design response

E-claims addresses these gaps by anchoring what must be provable on Spearhead while preserving what must remain private and rich in operational databases. The blockchain layer is intentionally thin: hashes, amounts, dates, status, and events — not clinical narratives or bank account detail.


================================================================================
3. CURRENT E-CLAIMS ECOSYSTEM
================================================================================

3.1 System roles

Component           | Mandate                              | System of record for
--------------------|--------------------------------------|------------------------------------------
Provider            | Facility master, FID, submission     | Hospital records, FHIR bundles, FIDs
Payers              | Adjudication, approval, rejection    | Clinical/policy decisions, claim outcomes
IFS                 | ERP, financial operations            | Patients, providers, invoices, payment instructions
Payment Gateway     | Settlement execution                 | Payment transactions, bank disbursement
E-claims            | Validation, anchoring, handoff       | Intake orchestration, on-chain anchors, APIs

E-claims sits between these systems. It does not duplicate master data. It adds shared trust and traceability across boundaries.

3.2 National architecture context

The wider SHA architecture also includes MOH oversight, Health Information Exchange (HIE), Afyaangu CR, KMPDC facility registry (FR), Rule Engine, and datalake analytics.

E-claims blockchain integration (current scope):
  • FHIR R4 Bundles from provider channel (QA MIS profile)
  • Parse → hash → ClaimRegistry.upsertClaim (backend signer)
  • Claims (Claim.use = claim) and pre-authorizations (Claim.use = preauthorization)
  • No direct read/write to Payers, IFS, or Provider master data

3.3 Current implementation status

Capability                                      | Status
------------------------------------------------|----------------------------------
Spearhead L3 testnet (chain 99991)              | Live
ClaimRegistry.sol — claim + pre-auth anchor     | Deployed
POST /api/public/eclaim-contract/submit         | Implemented (FHIR → chain)
FHIR parser (Bundle → Claim struct)             | Implemented
Submit FHIR portal (/submit)                  | Implemented
GET list / search / duplicate check             | Implemented
ProviderRegistry / Payers / IFS sync            | Out of scope
PaymentLedger                                   | Out of scope


================================================================================
4. WHY BLOCKCHAIN
================================================================================

4.1 What a shared ledger adds

A conventional integration bus moves data between systems but does not give independent parties a neutral, tamper-evident timeline they can verify without trusting a single vendor database.

Blockchain anchoring provides:
  1. Immutability of recorded events — status transitions and submission receipts cannot be silently rewritten
  2. Independent verification — auditors, providers, and partners query Spearhead directly
  3. Deterministic integrity proofs — bundle content hash binds off-chain FHIR to on-chain anchor
  4. Programme-specific chain — Spearhead isolates E-claims execution from unrelated workloads

4.2 What blockchain does not do

  • Replace Payers as adjudication authority
  • Replace IFS as financial system of record
  • Store patient names, diagnoses, or full claim payloads on-chain
  • Eliminate the need for operational databases and APIs

4.3 Why not a private database alone?

SHA and partners need audit evidence that does not depend on any one organisation's willingness or ability to produce unaltered logs. A hash-anchored L3 record, settled through ADI L2 to Ethereum L1, provides cryptographic proof suitable for institutional dispute resolution and regulatory oversight.


================================================================================
5. PROPOSED ARCHITECTURE
================================================================================

5.1 End-to-end flow (E-claims scope)

    Provider MIS / channel
              │ FHIR Bundle (Claim.use = claim | preauthorization)
              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                         E-CLAIMS PLATFORM                                │
    │  POST /submit ──► FHIR parser ──► hash fields ──► backend signer       │
    └─────────────────────────────────────────────────────────────────────────┘
              │
              │ upsertClaim (hashes, amounts, dates only)
              ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                    SPEARHEAD L3 — ClaimRegistry ONLY                     │
    └─────────────────────────────────────────────────────────────────────────┘

Flow summary:
  Step 1: Provider channel sends FHIR Bundle JSON to E-claims API
  Step 2: E-claims parses Bundle; reads Claim.use (claim or preauthorization)
  Step 3: E-claims computes keccak256 hashes; rejects duplicate claimId
  Step 4: Backend owner wallet signs ClaimRegistry.upsertClaim
  Step 5: API returns claimId, claimNumber, txHash, bundleHash, recordUse

Note: E-claims does not forward FHIR to Payers or validate against ProviderRegistry in this implementation.

5.2 On-chain vs off-chain separation (diagram)

    OFF-CHAIN (Operational databases)          ON-CHAIN (Spearhead L3)
    ─────────────────────────────────          ───────────────────────
    Full FHIR Bundle                    ──►    bundle content hash only
    Patient & clinical data             ──►    never stored in plaintext
    Invoices & bank detail              ──►    stays in IFS / CPP
    Rule engine & coverage detail       ──►    stays off-chain

    On-chain stores: hashes, status enums, amounts, timestamps, events

5.3 FHIR submission sequence (implemented)

    Step | Actor            | Action
    -----|------------------|--------------------------------------------------
    1    | Provider channel | POST FHIR Bundle to /api/public/eclaim-contract/submit
    2    | E-claims         | Parse Claim.use → claim or preauthorization
    3    | E-claims         | Reject if duplicate claimId already on chain
    4    | E-claims         | Build Claim struct (hashed fields only)
    5    | Backend signer   | ClaimRegistry.upsertClaim
    6    | E-claims         | Return txHash, claimNumber, bundleHash, recordUse

5.4 L3 → L2 → L1 settlement (diagram)

    Spearhead L3 (E-claims smart contracts)
            │
            │ commit batches
            ▼
    ADI Chain L2 (ZK batch settlement, validity proofs)
            │
            │ settle proofs
            ▼
    Ethereum L1 (ultimate security anchor)

Operational use: Soft confirmation on L3 within seconds for claim intake and status updates. Stronger assurance builds as batches are proved on L2 and settled on L1, aligned with institutional risk appetite.


================================================================================
6. ADI NETWORK AND SPEARHEAD LAYER 3
================================================================================

6.1 Layer model

Layer              | Role                                    | Relevance to E-claims
-------------------|-----------------------------------------|----------------------------------
L3 — Spearhead     | Application execution; smart contracts  | Claim anchors (ClaimRegistry)
L2 — ADI Chain     | ZK rollup settlement, bridge registry   | Batch commitment and validity proofs
L1 — Ethereum      | Ultimate security anchor                | Long-term tamper evidence

Spearhead is a zero-knowledge rollup: transactions are ordered and executed on L3, then batched, proved, and settled upward. Sensitive payload data is not required on L1; only state commitments and proofs propagate.

6.2 Spearhead testnet parameters

Setting          | Value
-----------------|---------------------------------------------
Network name     | Spearhead Testnet
Chain ID         | 99991
RPC URL          | https://rpc.spearhead.adifoundation.ai
Block explorer   | https://explorer.spearhead.adifoundation.ai/
Native gas token | ADI (18 decimals)
Demo portal      | https://eclaim.apeiro-digital.com/

6.3 Deployed contract (E-claims uses this only)

Contract           | Address
-------------------|---------------------------------------------
ClaimRegistry      | 0xA8eFbf955496518D6e3Cb10ABC90627671534088
Owner wallet       | 0xE8d5A99D3A879C6c9b8A371279b9Da5220C3c362

Note: An earlier ProviderRegistry demo contract exists on testnet but is NOT used by the E-claims FHIR submit path. Provider facility validation remains a national-system responsibility in the current scope.

Further reading: https://docs.adi.foundation/adi-network-components/overview-1


================================================================================
7. ON-CHAIN VS OFF-CHAIN DATA MODEL
================================================================================

7.1 Classification matrix (QA MIS profile — implemented)

Data element                    | Location        | On-chain field           | In current contract
--------------------------------|-----------------|--------------------------|--------------------
Full FHIR Bundle JSON           | Provider MIS    | bundleContentHash        | Yes
Bundle.id                       | FHIR            | bundleIdHash             | Yes
Claim UUID                      | FHIR            | claimIdHash              | Yes
Claim.use (claim / pre-auth)    | FHIR            | recordUseHash            | Yes
Organization.id (FID)           | FHIR            | fidHash (hashed)         | Yes
Organization.name               | FHIR            | —                        | No (off-chain)
Facility level (LEVEL 4)        | FHIR extension  | facilityLevelHash        | Yes
Coverage schemeCategoryCode     | FHIR            | schemeCodeHash           | Yes
Patient.id (CR)                 | FHIR            | crIdHash (hashed)        | Yes
Patient national ID             | FHIR            | nationalIdHash (hashed)  | Yes
Patient name / phone / DOB      | FHIR            | —                        | No (off-chain)
Claim.type (institutional)      | FHIR            | claimTypeHash            | Yes
Claim.subType ip                | FHIR            | ipsClaim                 | Yes
Claim.item intervention code    | FHIR            | interventionCodeHash     | Yes
Claim.total                     | FHIR            | claimedTotal             | Yes
Claim.billablePeriod            | FHIR            | dateFrom, dateTo         | Yes
Claim.created                   | FHIR            | creationDate             | Yes
Diagnosis / attachments / items | FHIR            | —                        | No (bundle hash only)
Clinical notes                  | Payers / MIS    | —                        | No
Adjudication status             | Payers          | status (optional update) | Enum exists; manual API only
Approved amount / payment       | Payers / IFS    | —                        | No (future national)
Provider registry attestation   | National master | —                        | No (future national)

7.2 Hashing convention

All string identifiers use:

    keccak256(UTF-8 bytes of string)

Empty string maps to 32 zero bytes (0x000…000). Contracts expose hashString() for client verification.

Canonical bundle hash: Full FHIR bundle is canonicalised (stable key order, UTF-8, normalised dates) before hashing. Specification and test vectors are delivered in Phase 0 of the implementation plan.


================================================================================
8. SMART CONTRACTS AND ACCESS ROLES
================================================================================

8.1 ClaimRegistry — QA MIS profile only

Purpose: Anchor claims and pre-authorizations from the institutional FHIR bundle. No Patient struct; no fields outside this profile.

Required bundle resources: Bundle, Organization, Coverage, Patient, Claim.

FHIR field → on-chain field (all strings hashed except amounts/dates/bools):

FHIR path                              | ClaimRegistry field
---------------------------------------|----------------------------------
Bundle.id                              | bundleIdHash
Canonical Bundle JSON                  | bundleContentHash
Claim.identifier.value                 | claimIdHash
Claim.use (claim | preauthorization)   | recordUseHash
Organization.id (FID)                  | fidHash
Organization facility-level code       | facilityLevelHash
Coverage schemeCategoryCode            | schemeCodeHash
Patient.id (CR)                        | crIdHash
Patient.identifier nationalid          | nationalIdHash (hashed)
Claim.type e.g. institutional          | claimTypeHash
Claim.item productOrService code       | interventionCodeHash
Claim.created                          | creationDate
Claim.billablePeriod start/end         | dateFrom, dateTo
Claim.total                            | claimedTotal
Claim.subType ip                       | ipsClaim
(assigned)                             | claimNumber
(initial)                              | status = UNKNOWN

OFF-CHAIN ONLY (not in contract): Organization.name, Patient name/phone/gender/birthDate, diagnosis, attachments, Coverage detail beyond scheme code, Practitioner.

Claim vs pre-auth: same bundle shape; only Claim.use differs (claim or preauthorization).

8.2 Contract functions (implemented)

Write (owner only):
  upsertClaim(Claim)           — anchor claim or pre-auth; rejects duplicate claimIdHash
  setClaimStatus(claimNumber, status) — optional status update
  setClaimStatusByClaimIdHash(claimIdHash, status)

Read (owner only; exposed via E-claims backend APIs):
  getClaim, getClaimByClaimIdHash, existsClaim, hashString

Events:
  ClaimUpserted(claimNumber, claimIdHash, status, recordUseHash)
  ClaimStatusUpdated(claimNumber, oldStatus, newStatus)

Duplicate prevention: claimIdHash → claimNumber mapping; second submit with same UUID reverts.

8.3 Access control (implemented)

Role / actor              | Permission
--------------------------|--------------------------------------------------
E-claims backend signer   | upsertClaim, setClaimStatus (OWNER_PRIVATE_KEY)
Provider / MIS channel    | POST FHIR to /submit only; no wallet required
SHA administrator         | Contract owner; gas funding; deploy / transferOwnership
Auditor / regulator       | Read APIs + block explorer (no write keys)

Not implemented: multisig owner, emergency pause, separate payer/IFS signer roles.

8.4 Out of scope (gap analysis items — national / future)

The following appear in the SHA gap analysis but are NOT part of current E-claims delivery:
  • ProviderRegistry (facility register, suspend, license)
  • PaymentLedger (settlement proof)
  • Payers webhook → automatic status sync
  • IFS approval reference on-chain
  • Provider wallet gas payment


================================================================================
9. END-TO-END RECORD LIFECYCLE (E-CLAIMS SCOPE)
================================================================================

9.1 Implemented lifecycle (today)

    Provider MIS sends FHIR Bundle (Claim.use = claim | preauthorization)
        │
        ▼
    E-claims: parse → duplicate check → upsertClaim (status = UNKNOWN)
        │
        ▼
    Response: txHash, claimNumber, bundleHash, recordUse
        │
        └──► Optional: POST .../status → setClaimStatus (manual / ops)

9.2 National lifecycle (reference — not automated by E-claims today)

Gap analysis target states (for future national integration):

    Submitted → Validated → Adjudicated → Approved/Rejected → Sent to IFS → Payment Initiated → Settled

E-claims currently anchors the submission step only. Payers, IFS, and Payment Gateway remain authoritative for later stages.

9.3 Status enum (available for future sync)

Value                        | Meaning (when set)
-----------------------------|----------------------------------
UNKNOWN                      | Default at anchor
APPROVED / REJECTED / etc.   | Available via setClaimStatus; no automatic Payers feed yet


================================================================================
10. PRIVACY AND COMPLIANCE
================================================================================

10.1 Principles

  1. No PHI on-chain — Patient names, clinical narratives, and contact detail never appear in plaintext on Spearhead.
  2. Hash-only anchoring — Identifiers such as CR id and national ID are stored as one-way hashes when needed.
  3. Data minimisation — Only fields required for integrity, authorisation, and audit are anchored.
  4. Operational encryption — Sensitive data in Provider, Payers, and IFS remains encrypted per SHA policies.
  5. Attachments off-chain — PDFs stay in accredited document stores; bundle hash proves inclusion.

10.2 Compliance alignment

Topic                  | Approach
-----------------------|----------------------------------------------------------
Health data protection | PHI in accredited systems only; no reversible patient identity on-chain
Audit rights           | Regulators access off-chain systems; chain provides independent timeline
Retention              | Off-chain retention per SHA/MOH policy; on-chain anchors are permanent evidence
Right to erasure       | Erasure applies to operational DBs; on-chain hashes are not reversible
Cross-border           | Spearhead L3 dedicated to SHA programme; settlement via ADI/Ethereum

10.3 Privacy review checkpoint

Phase 0 of implementation requires formal sign-off that no FHIR parser path writes plaintext PII to chain transactions.


================================================================================
11. SECURITY AND GOVERNANCE
================================================================================

11.1 Governance — implemented vs proposed

Topic                         | Current (testnet)              | Proposed (production / national)
------------------------------|--------------------------------|----------------------------------
Spearhead operation           | ADI Foundation testnet         | SHA programme governance with ADI
Contract owner                | Single backend wallet          | Multisig or HSM-backed SHA admin
Provider onboarding on-chain  | Not implemented                | National ProviderRegistry (other team)
Contract upgrades             | Redeploy + address update      | SHA board + audit + migration runbook
Emergency pause               | Not implemented                | Owner pause or circuit breaker
Regulator access              | Read APIs + explorer           | Dedicated auditor APIs / dashboards
Off-chain vs on-chain dispute | Bundle hash is integrity proof | Payers DB + chain timeline reconciliation

11.2 Security — implemented vs target

Control                       | Status
------------------------------|--------------------------------------------------
Backend-signed chain writes   | Implemented (OWNER_PRIVATE_KEY in env)
Provider wallets              | Not required (sponsored gas)
API authentication            | Public submit endpoint (harden for production)
mTLS to Payers/IFS            | N/A — no integration yet
RBAC per payer/IFS role       | Future national integration
Key management (HSM/KMS)      | Target for production
Smart contract audit          | Planned before mainnet
Gas balance monitoring        | Implemented (pre-submit balance check)
Disaster recovery             | Redeploy runbook; per-env contract addresses

11.3 Trust assumptions (current)

  • E-claims backend correctly parses FHIR and computes bundleContentHash
  • Owner key is custodied securely (testnet: env variable)
  • FID in bundle is not validated against national facility register on-chain
  • Status updates are manual unless future Payers integration is added

Mitigations live today: duplicate claimId check, deterministic hashing, unit tests on FHIR parser.


================================================================================
12. INTEGRATION MODEL
================================================================================

12.1 API integration (implemented)

Integration                  | Direction | Mechanism
-----------------------------|-----------|--------------------------------------------------
Provider channel → E-claims  | Inbound   | POST /api/public/eclaim-contract/submit (FHIR Bundle)
E-claims → ClaimRegistry     | On-chain  | upsertClaim (OWNER_PRIVATE_KEY backend signer)
E-claims → Portal / auditors | Read      | GET list, GET by number, POST search, POST check-duplicate

12.2 Submit API request / response

Request: Full FHIR R4 Bundle JSON (QA MIS profile). Claim.use must be "claim" or "preauthorization".

Response (201):
  txHash, claimNumber, claimId, recordUse, fid, claimedTotal, bundleHash

12.3 Existing backend endpoints

Endpoint                                          | Purpose
--------------------------------------------------|----------------------------------
POST /api/public/eclaim-contract/submit           | FHIR Bundle → anchor on chain
GET /api/public/eclaim-contract?recordUse=        | List claims or pre-auths
GET /api/public/eclaim-contract/:claimNumber        | Claim read
POST /api/public/eclaim-contract/search             | Search by claim id
POST /api/public/eclaim-contract/check-duplicate    | Duplicate claim id check
POST /api/public/eclaim-contract/:n/status          | Update status (owner signer)

12.4 Error handling (implemented)

Scenario                    | Behaviour
----------------------------|--------------------------------------------------
Invalid FHIR / missing resources | 400 from parser before chain write
Duplicate claimId on chain    | Reject with duplicate error
Insufficient gas on signer  | 500 with balance message; no partial anchor
Chain write failure         | Error returned to client; no DB claim marked success


================================================================================
13. PERFORMANCE AND COST MODEL
================================================================================

13.1 Volume assumptions (indicative — confirm with SHA)

Metric                              | Current implementation
------------------------------------|----------------------------------
Transactions per FHIR submit        | 1 (upsertClaim)
Transactions per claim (full national lifecycle) | 3–5 when Payers/IFS sync added (future)
Batch submit                        | Not implemented (single upsertClaim per request)

13.2 Performance (measured on testnet)

Metric                              | Observed / target
------------------------------------|----------------------------------
L3 soft confirmation                | Seconds (RPC receipt after upsertClaim)
L2 / L1 finality                    | Minutes to hours (ADI settlement)
API latency (submit + chain)        | Target under 10 seconds p95
Gas per upsertClaim                 | ~0.26 ADI at ~552 gwei (testnet; varies with network)

13.3 Gas and fee model

Topic                   | Policy
------------------------|----------------------------------------------------------
Who pays gas?           | SHA sponsors via E-claims backend signer
Provider wallets        | Not required in production; demo portal only
Cost per claim anchor   | Low on L3; exact cost TBD from testnet metering
Optimisation            | Hash-only struct; single upsertClaim per submit (batching future)
Sponsored gas account   | Funded signer with monitoring and auto-alert

13.4 Storage growth

On-chain storage grows with claim volume. Hashes are fixed 32 bytes each. Events are log-based (lower cost than storage). Chain state is permanent; E-claims indexer may aggregate old events for reporting APIs.


================================================================================
14. STAKEHOLDER BENEFITS
================================================================================

Stakeholder           | Benefit
----------------------|----------------------------------------------------------
Providers             | Durable submission receipt; fair dispute resolution
Payers                | Intake validation; shared decision timeline
IFS                   | Align invoices and payments with independent settlement trail
Payment Gateway       | Confirm payment matches previously approved anchored claim
SHA / regulators      | Verifiable audit view without consolidating PHI on ledger
Patients/beneficiaries| Stronger fraud controls; personal data stays in accredited systems


================================================================================
15. IMPLEMENTATION ROADMAP
================================================================================

Phase | Focus                                         | Status
------|-----------------------------------------------|------------------
1     | ClaimRegistry minimal + FHIR submit API       | DONE (testnet)
1b    | Submit FHIR portal + duplicate check          | DONE
2     | Production hardening (auth, KMS, audit)       | Next
3     | Payers adjudication status sync (national)    | Future — not E-claims scope today
4     | IFS / payment settlement anchor (national)    | Future — not E-claims scope today
5     | ProviderRegistry on-chain (national)          | Future — not E-claims scope today
6     | Regulator dashboards, event indexer           | Planned
7     | Fraud analytics, reconciliation automation    | Planned

E-claims has delivered Phase 1: claim and pre-auth anchoring from QA MIS FHIR bundles. National integration phases depend on Payers, IFS, and SHA governance agreements.


================================================================================
16. RISKS AND MITIGATIONS
================================================================================

Risk                        | Impact                              | Mitigation (current / planned)
----------------------------|-------------------------------------|--------------------------------------------------
Wrong bundle hash           | Audit proof may not match record      | Canonical JSON hashing; parser unit tests
FID not validated on-chain  | Unauthorised facility id in bundle    | Future: national registry; today: off-chain validation by channel
Payers/IFS not integrated   | Incomplete lifecycle on chain         | Document scope; status enum ready for future sync
Smart contract defect       | Blocked or wrong anchors              | Testnet pilot; external audit before production
Privacy leakage             | Regulatory risk                       | Hash-only model; no PHI fields in struct
Gas/fee uncertainty         | Budget / ops risk                     | SHA-sponsored signer; balance pre-check
Governance (single owner)   | Key compromise                        | Multisig + HSM for production
Duplicate claim replay      | Double anchor attempt                 | claimIdHash mapping reverts duplicate


================================================================================
17. KPIs AND SUCCESS METRICS
================================================================================

KPI                                    | Applies now | Measurement
---------------------------------------|-------------|----------------------------------
Duplicate claims prevented at intake   | Yes         | Count rejected by check-duplicate / submit
Average anchor transaction cost        | Yes         | Gas per upsertClaim (~0.26 ADI testnet)
Average confirmation time              | Yes         | Submit API including chain receipt
Zero PII on-chain                      | Yes         | Struct + parser review
Lifecycle anchoring completeness       | Partial     | 100% submit anchor; adjudication/pay = future
Unauthorised provider blocks           | Future      | Requires ProviderRegistry / national master
Claim reconciliation time              | Future      | Baseline TBD with SHA
Payment dispute resolution time        | Future      | Requires IFS / CPP integration
Audit report generation time           | Future      | Regulator dashboard phase
Payers–chain status match rate         | Future      | Requires Payers webhook integration


================================================================================
18. CONCLUSION
================================================================================

The SHA E-claims programme introduces a thin blockchain trust layer on Spearhead L3 that anchors institutional claims and pre-authorizations from QA MIS FHIR bundles. Sensitive clinical and personal data remain off-chain; the ledger stores hashes, amounts, dates, and optional status — providing tamper-evident proof of submission without exposing PHI.

Current implementation (testnet): minimal ClaimRegistry, FHIR submit API, backend-sponsored gas, duplicate prevention, and portal tooling. This satisfies the core gap-analysis items for architecture, data model, smart contract specification, privacy, integration, and cost model for the submission anchor phase.

National programme items from the gap analysis — ProviderRegistry, Payers adjudication sync, IFS payment proof, full lifecycle, regulator dashboards, and advanced KPIs — are documented as future phases owned by the wider SHA ecosystem, not the current E-claims delivery.

Recommended next steps:
  1. SHA workshop: confirm production governance, gas budget, and API authentication.
  2. Privacy sign-off on hash-only model and FHIR parser paths.
  3. Smart contract audit before production cutover.
  4. Agree national integration roadmap with Payers / IFS when anchoring beyond submit is required.


================================================================================
APPENDIX A — GAP ANALYSIS COMPLETION CHECKLIST
================================================================================

Gap analysis item                    | Whitepaper § | Implementation status
-------------------------------------|--------------|------------------------
Executive summary                    | 1            | Complete
Detailed problem statement           | 2            | Complete (national context)
Architecture diagrams                | 5, 6         | Complete (ASCII; publish as SmartArt)
On-chain vs off-chain data model     | 7            | Complete (QA MIS profile)
Smart contract specification         | 8            | Complete (ClaimRegistry only)
Governance model                     | 11           | Partial — proposed for production
Security model                       | 11           | Partial — testnet implemented
Privacy and compliance               | 10           | Complete (hash-only)
Integration model                    | 12           | Complete (FHIR submit path)
Gas and fee model                    | 13           | Complete (sponsored gas; measured cost)
Performance and scalability          | 13           | Partial — submit path measured
Implementation roadmap               | 15           | Complete (phased; Phase 1 done)
Risks and mitigations                | 16           | Complete
KPIs and success metrics             | 17           | Partial — submit KPIs live; national TBD
ProviderRegistry                     | 8.4          | Out of scope — not required for E-claims
Payment / IFS settlement anchor      | 7, 9         | Future national programme
Full claim lifecycle automation      | 9            | Future — submit only today
Regulator dashboards                 | 15 phase 6   | Planned

Items requiring SHA workshop: production governance charter, claims volume baselines, national integration priorities, final gas budget.


================================================================================
APPENDIX B — DOCUMENT HISTORY
================================================================================

Version   | Date       | Author              | Notes
----------|------------|---------------------|------------------------------------------
1.0 draft | June 2026  | E-claims programme  | Initial institutional whitepaper
2.0       | June 2026  | E-claims programme  | Gap analysis alignment; ClaimRegistry-only scope; QA MIS mapping

# ADI programme products c–f — E-claims implementation plan

**Context:** Products **(a)** base DHIP infrastructure and **(b)** digital health identity / FHIR terminology server are **done** elsewhere. This plan covers what to build **in the E-claims stack** (contracts, backend, frontend) for:

| Product | Description |
|---------|-------------|
| **c)** | Decentralized verifiable registries — citizens, facilities, clinicians, insurers, hospitals |
| **d)** | Contracting module — onboard hospitals and insurance companies on ADI Chain |
| **e)** | Contracting module — insurers register members and benefit packages on ADI Chain |
| **f)** | E-claim transaction platform — FHIR claims/pre-auth validated by ADI Chain |

**Network:** Spearhead L3 (ADI) testnet first, then production cutover.

---

## 1. Current state vs target

| Product | What exists today | Gap (missing) |
|---------|-------------------|---------------|
| **c) Verifiable registries** | Facility registry contract + demo UI (hospitals/providers only); claim stores facility id hash | Citizen, clinician, insurer registries; sync from national master; unified verifier APIs; regulator views |
| **d) Hospital / insurer contracting** | None on-chain | Contracting contracts (agreement anchor, parties, effective dates); onboarding workflows; insurer + hospital portals |
| **e) Member / benefit packages** | Scheme code hash on claim from FHIR Coverage | Member registry on-chain; benefit package definitions; link member → coverage → claim |
| **f) E-claim platform** | Claim registry + FHIR submit + list/search + pre-auth via `Claim.use` | Provider validation on submit; payer status sync; payment proof; production auth & audit |

---

## 2. Target architecture (high level)

```
National masters (off-chain)          E-claims (this programme)
────────────────────────────          ─────────────────────────
Citizen / Afyaangu CR        ──sync──► CitizenRegistry (hash refs)
Facility / KMPDC FR          ──sync──► FacilityRegistry (exists → extend)
Clinician / KMPDC            ──sync──► ClinicianRegistry
Insurer master               ──sync──► InsurerRegistry

Hospital onboarding          ────────► HospitalContractRegistry
Insurer onboarding           ────────► InsurerContractRegistry

Insurer member + benefits    ────────► MemberRegistry + BenefitPackageRegistry

Provider MIS (FHIR)          ────────► Validate c+d+e ──► ClaimRegistry (f)
Payers / IFS (future)        ────────► Status + PaymentLedger
```

**Principle:** Registries hold **hashes and status**, not PHI. Full records stay in national systems and FHIR payloads.

---

## 3. Smart contracts — planned

### 3.1 Product c — Verifiable registries

| Contract | Purpose | Status |
|----------|---------|--------|
| **FacilityRegistry** | Hospitals / facilities — license, level, active/suspended | **Partial** — `ProviderRegistry` deployed; rename/align to facility FID model |
| **CitizenRegistry** | Beneficiary reference (CR id hash, status) | **To build** |
| **ClinicianRegistry** | Practitioner id, license, facility linkage (hashed) | **To build** |
| **InsurerRegistry** | Insurance company id, status, scheme codes (hashed) | **To build** |

**Shared capabilities (all registry contracts):**
- Register / update / suspend / expire
- `isAuthorized(idHash, atTime)` view for validators
- Status and license history events
- Owner or role-based writes (SHA admin + sync service)

### 3.2 Product d — Hospital & insurer contracting

| Contract | Purpose | Status |
|----------|---------|--------|
| **HospitalContractRegistry** | On-chain anchor of hospital participation agreement (party hashes, effective dates, contract ref hash) | **To build** |
| **InsurerContractRegistry** | Same for insurance companies | **To build** |

**Not storing on-chain:** full legal PDF, pricing tables, commercial terms — only **contract fingerprint + parties + dates + status**.

### 3.3 Product e — Members & benefit packages

| Contract | Purpose | Status |
|----------|---------|--------|
| **BenefitPackageRegistry** | Package id, insurer ref, scheme code hash, validity period | **To build** |
| **MemberRegistry** | Member id hash, insurer ref, package ref, enrollment status | **To build** |

**Link to claims:** At FHIR submit, validate Coverage scheme + member CR against MemberRegistry and BenefitPackageRegistry before `upsertClaim`.

### 3.4 Product f — E-claim transaction platform

| Contract | Purpose | Status |
|----------|---------|--------|
| **ClaimRegistry** | FHIR claim + pre-auth anchor | **Done** (minimal) |
| **ClaimRegistry (enhanced)** | Call facility + member validation before upsert | **To build** |
| **PreAuthRegistry** | Guarantee lifecycle, consume on claim | **To build** (optional phase) |
| **PaymentLedger** | Settlement proof after IFS / payment gateway | **To build** (later phase) |

---

## 4. Backend — planned work

### 4.1 Registry services

| Service | Responsibility | Status |
|---------|----------------|--------|
| Facility sync | Batch sync from national facility master → FacilityRegistry | **To build** |
| Citizen sync | CR / beneficiary status updates | **To build** |
| Clinician sync | Practitioner license updates | **To build** |
| Insurer sync | Insurer master → InsurerRegistry | **To build** |
| Registry read APIs | Authorize? queries for portals and submit pipeline | **Partial** (facility only) |

### 4.2 Contracting services (d)

| Service | Responsibility | Status |
|---------|----------------|--------|
| Hospital onboarding API | Create contract anchor; SHA admin approve | **To build** |
| Insurer onboarding API | Same for payers | **To build** |
| Contract status API | Active / suspended / expired lookup | **To build** |

### 4.3 Member & benefit services (e)

| Service | Responsibility | Status |
|---------|----------------|--------|
| Benefit package API | Register / update packages per insurer | **To build** |
| Member enrollment API | Register member to package | **To build** |
| Eligibility check | At claim submit — member active + package valid on service date | **To build** |

### 4.4 E-claim services (f)

| Service | Responsibility | Status |
|---------|----------------|--------|
| FHIR submit pipeline | Parse → validate registries → anchor claim | **Partial** (anchor done; validation missing) |
| Payers status webhook | Update claim status on-chain | **To build** |
| Payment callback | Record settlement on PaymentLedger | **To build** |
| Unified audit timeline | Events across all contracts | **To build** |

---

## 5. Frontend — planned work

| Portal / screen | Product | Status |
|-----------------|---------|--------|
| Submit FHIR (claim / pre-auth) | f | **Done** |
| Claims list & search | f | **Done** |
| Facility registry admin | c | **Partial** (demo page exists) |
| Citizen registry view | c | **To build** |
| Clinician registry view | c | **To build** |
| Insurer registry view | c | **To build** |
| Hospital contracting onboarding | d | **To build** |
| Insurer contracting onboarding | d | **To build** |
| Member & benefit package admin | e | **To build** |
| Regulator dashboard (read-only) | c, f | **To build** |
| Pre-auth dashboard | f | **To build** |
| Settlement / payment history | f | **To build** |

---

## 6. Implementation phases

### Phase 1 — Complete product f on testnet (2–3 weeks)

**Goal:** Production-quality claim anchoring path.

| # | Task | Depends on |
|---|------|------------|
| 1.1 | Wire facility validation into claim submit (enhanced ClaimRegistry) | FacilityRegistry deployed |
| 1.2 | Harden submit API (auth, errors, gas monitoring) | — |
| 1.3 | Remove wallet requirement for claims list (optional) | — |
| 1.4 | End-to-end demo script + SHA acceptance | 1.1–1.3 |

**Exit:** FHIR claim rejected if facility not authorized; otherwise anchored as today.

---

### Phase 2 — Product c verifiable registries (4–6 weeks)

**Goal:** Four registry types on Spearhead with sync jobs.

| # | Task | Depends on |
|---|------|------------|
| 2.1 | Finalize FacilityRegistry (align with national FID) | National FR API spec |
| 2.2 | Deploy CitizenRegistry + sync from Afyaangu CR | CR API / export |
| 2.3 | Deploy ClinicianRegistry + sync | KMPDC / practitioner master |
| 2.4 | Deploy InsurerRegistry + sync | Insurer master |
| 2.5 | Unified “authorize” API for all entity types | 2.1–2.4 |
| 2.6 | Regulator read-only portal (registry + claim timeline) | 2.5 |

**Exit:** Each entity type can be verified on-chain before claims or contracts reference it.

---

### Phase 3 — Product d contracting (3–4 weeks)

**Goal:** Hospitals and insurers onboarded via on-chain contract anchors.

| # | Task | Depends on |
|---|------|------------|
| 3.1 | Design legal anchor model (what hash, what dates) with SHA legal | — |
| 3.2 | Deploy HospitalContractRegistry + InsurerContractRegistry | 3.1 |
| 3.3 | Admin onboarding APIs + approval workflow | 3.2, 2.1, 2.4 |
| 3.4 | Portal: hospital + insurer onboarding screens | 3.3 |
| 3.5 | Block claim submit if hospital/insurer contract not active | 3.3, Phase 1 |

**Exit:** Only contracted hospitals/insurers can participate in anchored claim flow.

---

### Phase 4 — Product e members & benefits (3–4 weeks)

**Goal:** Insurers register packages and members on-chain; claims validate eligibility.

| # | Task | Depends on |
|---|------|------------|
| 4.1 | Deploy BenefitPackageRegistry | Phase 3 insurer contracts |
| 4.2 | Deploy MemberRegistry | 4.1 |
| 4.3 | Insurer APIs: create package, enroll member | 4.2 |
| 4.4 | Portal: benefit package + member admin | 4.3 |
| 4.5 | FHIR submit: validate Coverage + Patient CR against MemberRegistry | 4.2, Phase 1 |

**Exit:** Claim anchor includes proof that member and benefit package were valid on service date.

---

### Phase 5 — Product f lifecycle completion (4–6 weeks)

**Goal:** Full claim journey on-chain through adjudication and payment.

| # | Task | Depends on |
|---|------|------------|
| 5.1 | PreAuthRegistry (optional if pre-auth volume requires it) | Phase 4 |
| 5.2 | Payers webhook → claim status on-chain | Payers API |
| 5.3 | PaymentLedger + IFS/payment gateway callback | IFS API |
| 5.4 | Unified audit timeline API | 5.2, 5.3 |
| 5.5 | Production hardening (KMS, multisig, audit) | All phases |

**Exit:** Submit → adjudication → payment each have an on-chain proof; suitable for M3 go-live slice of (f).

---

## 7. Dependencies (external)

| Dependency | Needed for | Owner |
|------------|------------|-------|
| National facility registry (FID) API or batch export | c, d | SHA / MOH |
| Afyaangu CR / citizen beneficiary API | c, e | SHA |
| Clinician / KMPDC registry | c | MOH |
| Insurer master data | c, d, e | SHA / insurers |
| Payers adjudication webhook | f Phase 5 | Payers |
| IFS / payment gateway callback | f Phase 5 | IFS |
| Legal sign-off on contract hashes (d) | d | SHA legal |
| Smart contract security audit | Production | Security |
| Spearhead production environment | M3 go-live | ADI Foundation |

---

## 8. Missing items checklist (summary)

### Contracts — to build

- [ ] CitizenRegistry  
- [ ] ClinicianRegistry  
- [ ] InsurerRegistry  
- [ ] FacilityRegistry alignment (extend existing ProviderRegistry)  
- [ ] HospitalContractRegistry  
- [ ] InsurerContractRegistry  
- [ ] BenefitPackageRegistry  
- [ ] MemberRegistry  
- [ ] ClaimRegistry validation hooks (facility + member + contract)  
- [ ] PreAuthRegistry (optional)  
- [ ] PaymentLedger  

### Backend — to build

- [ ] Sync jobs for all registries  
- [ ] Contracting onboarding APIs  
- [ ] Member / benefit package APIs  
- [ ] Eligibility validation in FHIR submit  
- [ ] Payers status sync  
- [ ] Payment settlement sync  
- [ ] Regulator audit timeline  
- [ ] Production auth, rate limits, KMS signer  

### Frontend — to build

- [ ] Citizen / clinician / insurer registry views  
- [ ] Hospital & insurer contracting onboarding  
- [ ] Member & benefit package admin  
- [ ] Regulator dashboard  
- [ ] Pre-auth and settlement views  

### Already done (product f baseline)

- [x] ClaimRegistry minimal deploy on Spearhead  
- [x] FHIR QA MIS parser (claim + pre-auth)  
- [x] Submit API with sponsored gas  
- [x] List, search, duplicate check  
- [x] Submit FHIR portal + samples  
- [x] Facility registry contract + demo UI (not wired to claim submit)  

---

## 9. Suggested delivery order

```
Phase 1 (f complete)  →  Phase 2 (c registries)  →  Phase 3 (d contracting)
        →  Phase 4 (e members)  →  Phase 5 (f lifecycle + M3 hardening)
```

**Minimum viable for SHA demo of c+d+e+f together:** Phases **1 + 2 (facility+citizen+insurer) + 3 (hospital contract) + 4 (basic member)** — approximately **12–16 weeks** with parallel backend/frontend work, subject to national API availability.

---

## 10. What this repo covers vs other ADI products

| ADI product | Covered in E-claims repo? |
|-------------|---------------------------|
| a) Base DHIP infrastructure | No — assumed done |
| b) Terminology / identity server | No — consumes FHIR only |
| c) Verifiable registries | **Yes — Phase 2** |
| d) Hospital / insurer contracting | **Yes — Phase 3** |
| e) Member / benefit packages | **Yes — Phase 4** |
| f) E-claim platform | **Yes — Phase 1 done, Phase 5 completes lifecycle** |

---

**Version:** 1.0  
**Last updated:** July 2026  
**Related:** [Weekly implementation plan](./eclaims-weekly-implementation-plan.md) · [Blockchain expansion plan](./blockchain-expansion-plan.md) · [Whitepaper](./blockchain-whitepaper.md)

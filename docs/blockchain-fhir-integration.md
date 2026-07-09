# FHIR bundle integration with blockchain anchors

**Audience:** Solution architects, integration engineers  
**Purpose:** Describe how a standard FHIR claim bundle maps to on-chain fields in E-claims, what stays off-chain, and the recommended submission flow.

---

## 1. Context

### Ecosystem components

**Provider** maintains hospital and provider records and Facility Identifier details. Providers submit pre-authorizations and claims.

**Payers** receives, adjudicates, and approves claims and pre-authorizations.

**IFS** is the ERP and financial system of record for patients, providers, interventions, invoices, and payment instructions. Approved claims flow from Payers into IFS; IFS forwards payment requests to the Payment Gateway.

**Payment Gateway** executes settlement and returns payment status.

**E-claims** validates submissions, anchors critical data on Spearhead L3, and forwards claims to Payers. Master data remains in Provider, Payers, and IFS.

### FHIR payload

E-claims typically receives a **FHIR R4 Bundle** from the provider channel containing:

- `Organization` — healthcare facility (FID)  
- `Patient` — beneficiary  
- `Practitioner` — treating clinician (optional for anchor)  
- `Coverage` — scheme / SHA coverage  
- `Claim` — institutional or professional claim with items, diagnosis, attachments  

Patient, provider master, and clinical detail remain in Provider, Payers, and IFS. E-claims:

1. Validates business rules (including on-chain provider authorization against FID).  
2. Writes a **minimal claim anchor** to Spearhead L3.  
3. Forwards the **full FHIR bundle** to **Payers**.

This document maps the FHIR payload to blockchain fields and defines the integration pipeline. For narrative context and whitepaper text, see [blockchain-value-proposition.md](./blockchain-value-proposition.md).

---

## 2. Reference bundle structure

The following reflects a typical SHA institutional claim bundle (QA MIS profile). Resource order may vary; extraction logic should key off `resourceType`, not array index.

| Resource | Example ID | Role |
|----------|------------|------|
| `Practitioner` | `PUID-0002011-6` | Care team (off-chain for anchor v1) |
| `Coverage` | `CR1689914278498-4-sha-coverage` | Scheme linkage (off-chain; hash optional) |
| `Organization` | `FID-35-108719-7` | **Provider facility — primary on-chain ID** |
| `Patient` | `CR1689914278498-4` | Beneficiary (hash only if needed) |
| `Claim` | UUID | **Primary claim identifier** |
| `Bundle` | UUID | Container — use for bundle integrity hash |

---

## 3. On-chain vs off-chain matrix (QA MIS profile — implemented)

**Required bundle resources:** `Bundle`, `Organization`, `Coverage`, `Patient`, `Claim`.

| FHIR path | On-chain field | Notes |
|-----------|----------------|-------|
| `Bundle.id` | `bundleIdHash` | hashed |
| Full Bundle JSON | `bundleContentHash` | canonical JSON hash |
| `Claim.identifier` | `claimIdHash` | hashed UUID |
| `Claim.use` | `recordUseHash` | hash(`claim`) or hash(`preauthorization`) |
| `Organization.id` (FID) | `fidHash` | hashed |
| `Organization` facility-level | `facilityLevelHash` | hashed e.g. LEVEL 4 |
| `Coverage` schemeCategoryCode | `schemeCodeHash` | hashed e.g. CAT-SHA-001 |
| `Patient.id` (CR) | `crIdHash` | hashed |
| `Patient.identifier` nationalid | `nationalIdHash` | hashed |
| `Claim.type` | `claimTypeHash` | hashed e.g. institutional |
| `Claim.item[0]` code | `interventionCodeHash` | hashed e.g. PMF-12-001 |
| `Claim.created` | `creationDate` | Unix seconds |
| `Claim.billablePeriod` | `dateFrom`, `dateTo` | Unix seconds |
| `Claim.total` | `claimedTotal` | uint256 KES whole units |
| `Claim.subType` ip | `ipsClaim` | bool |
| (assigned) | `claimNumber` | uint256 |
| (initial) | `status` | UNKNOWN |

**Off-chain only (provable via `bundleContentHash`):** `Organization.name`, patient demographics, diagnosis, attachments, extra claim items, Practitioner, invoice extensions, pre-auth related.

**Not used:** Patient struct on-chain, ProviderRegistry, guaranteeIdHash, invoice hash, patient name hash.

**Hashing rule (aligned with contracts and app):**

```text
keccak256(UTF-8 bytes of string)
```

Empty string → `0x000…000` (32 zero bytes).

---

## 4. Field mapping — Organization

| FHIR path | Example | ClaimRegistry field |
|-----------|---------|---------------------|
| `Organization.id` | `FID-35-108719-7` | `fidHash` |
| `extension[facility-level].coding.code` | `LEVEL 4` | `facilityLevelHash` |
| `Organization.name` | `ST. LEONARDS HOSPITAL` | **Off-chain only** |

---

## 5. Field mapping — Claim → ClaimRegistry

| FHIR path | Example | ClaimRegistry field |
|-----------|---------|---------------------|
| `Claim.identifier.value` | UUID | `claimIdHash` |
| `Claim.use` | `claim` / `preauthorization` | `recordUseHash` |
| `Claim.total.value` | `11000` | `claimedTotal` |
| `Claim.billablePeriod` | ISO datetimes | `dateFrom`, `dateTo` |
| `Claim.created` | `2024-12-03` | `creationDate` |
| `Claim.type.coding.code` | `institutional` | `claimTypeHash` |
| `Claim.subType.coding.code` | `ip` | `ipsClaim` |
| `Claim.item[0].productOrService.code` | `PMF-12-001` | `interventionCodeHash` |

**Bundle-level:**

| FHIR path | ClaimRegistry field |
|-----------|---------------------|
| `Bundle.id` | `bundleIdHash` |
| Canonical Bundle JSON | `bundleContentHash` |

---

## 6. Field mapping — Patient (minimal)

| FHIR path | Example | ClaimRegistry field |
|-----------|---------|---------------------|
| `Patient.id` | `CR3248022528592-4` | `crIdHash` |
| `Patient.identifier[nationalid]` | `30360528` | `nationalIdHash` |
| Name, gender, birthDate, phone | — | **Off-chain only** |

---

## 7. Field mapping — Coverage

| FHIR path | Example | ClaimRegistry field |
|-----------|---------|---------------------|
| `extension[schemeCategoryCode]` | `CAT-SHA-001` | `schemeCodeHash` |

---

## 7. End-to-end submission flow

```
┌──────────┐    FHIR Bundle     ┌──────────────┐
│   MIS    │ ─────────────────▶ │   E-claims   │
└──────────┘                    │   API        │
                                └──────┬───────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
            Parse & validate    ProviderRegistry    Compute hashes
            required fields     isProviderAuthorized  bundle + IDs
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       ▼
                              ClaimRegistry.upsertClaim
                              (anchor record + event)
                                       │
                                       ▼
                              POST full FHIR → Payers API
                                       │
                                       ▼
                              Return { claimId, txHash,
                                       bundleHash, payerRef }
```

### Step-by-step

1. **Receive** `Bundle` (JSON) on `POST /api/eclaim/submit` (proposed).  
2. **Parse** resources: `Organization`, `Claim`, `Patient`, `Bundle.id`.  
3. **Validate** schema, required identifiers, amount &gt; 0, billable period present.  
4. **Resolve** `providerFid` from `Claim.provider` or `Organization.id`.  
5. **Check** `ProviderRegistry.isProviderAuthorized(hash(providerFid), dateFrom)`.  
6. **(Future)** `PreAuthRegistry.consume(guaranteeIdHash, claimIdHash)`.  
7. **Build** claim struct; `upsertClaim` on Spearhead (backend signer in production).  
8. **Forward** unchanged FHIR bundle to Payers / Claim Engine.  
9. **Return** client response with on-chain `txHash` and correlation IDs.

### Status lifecycle (payers → chain)

| Business event | Writer | On-chain action |
|----------------|--------|-----------------|
| Claim received by payer | Payers integration | Optional status update |
| Approved / rejected | Payers integration | `setClaimStatus` + `approvedTotal` |
| Sent for payment | Payers integration | `SENT_FOR_PAYMENT_PROCESSING` |
| Paid | IFS / Payment Gateway integration | `PaymentLedger.record` (roadmap) |

---

## 8. Example — sample claim extraction

Given a bundle containing:

- **Organization:** `id = FID-35-108719-7`, name `ST. LEONARDS HOSPITAL`, level `LEVEL 4`  
- **Claim:** `identifier = {uuid}`, `total = 3360 KES`, billable period `2025-12-24`  
- **Patient:** `nationalid = 30360528`  

**Anchor payload (conceptual):**

```json
{
  "claimIdHash": "hash(claim-uuid)",
  "bundleIdHash": "hash(bundle-uuid)",
  "providerIdHash": "hash(FID-35-108719-7)",
  "claimedTotal": 3360,
  "dateFrom": 1735028422,
  "dateTo": 1735044047,
  "creationDate": 1733289144,
  "claimTypeHash": "hash(institutional)",
  "nationalIdHash": "hash(30360528)",
  "shaPackageCodeHash": "hash(canonical-bundle-json)",
  "guaranteeIdHash": "0x00…00",
  "status": 0
}
```

Full FHIR (Practitioner, items, PDFs, diagnosis) is sent to payers **only**; integrity is proven by `shaPackageCodeHash`.

---

## 9. Duplicate detection

| Check | Method |
|-------|--------|
| Same claim UUID resubmitted | `claimIdToNumber` mapping on `ClaimRegistry` or event scan |
| Same bundle hash | Compare `shaPackageCodeHash` before upsert |
| Provider not authorized | `ProviderRegistry` at service date |

Backend today: `POST /api/public/eclaim-contract/check-duplicate` with `claimId`. FHIR submit service should use the same `claimIdHash` from `Claim.identifier`.

---

## 10. Privacy and compliance

- **No plaintext PII** on Spearhead for patient or practitioner.  
- **Hashes are one-way** — auditors with off-chain data can verify consistency; chain alone does not reveal identity.  
- **Attachments** remain in accredited document stores; only URLs and optional content hashes referenced.  
- **Data minimization** supports alignment with health data protection expectations while preserving auditability.

---

## 11. Implementation checklist

| Item | Owner | Notes |
|------|-------|-------|
| FHIR parser / extractor service | E-claims backend | Organization.id, Claim fields, Bundle.id |
| Provider sync job Provider / IFS → ProviderRegistry | E-claims backend | FID, level, license dates |
| `POST /api/eclaim/submit` | E-claims backend | Orchestrate validate → chain → payers |
| ClaimRegistry provider validation hook | Smart contract | Jira #5 |
| PreAuthRegistry + guarantee consume | Smart contract + API | Jira #6–8 |
| PaymentLedger on settlement callback | IFS / Payment Gateway | Jira #10–12 |
| Payer status webhook → `setClaimStatus` | Payers integration | Map payer enums to `ClaimRegistry.Status` |

---

## 12. Related documents

- [Blockchain value proposition](./blockchain-value-proposition.md) — executive / whitepaper narrative  
- [Blockchain expansion plan](./blockchain-expansion-plan.md) — contract and API design  
- [Jira implementation order](./jira-implementation-order.md) — delivery sequence  
- [Network & contract reference](./network-and-contract-reference.md) — Spearhead addresses  

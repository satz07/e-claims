# E-claims Blockchain API — Integration Guide

**Audience:** E-claims / MIS development teams  
**Purpose:** When a claim or pre-authorization is created in your system, anchor it on the blockchain and keep provider, citizen, and scheme registries in sync.

You do not need a wallet or gas on your side. The API signs transactions and pays fees. Registries are checked automatically; missing entries are registered from the claim database when needed.

---

## Overview

When you call the submit API with a FHIR Bundle, the backend:

1. Reads facility (FID), patient (CR ID), and scheme from the bundle  
2. Checks whether those registries exist on-chain  
3. Registers them from the claim DB if they are missing  
4. Anchors the claim on the blockchain  

| Field returned | Meaning |
|----------------|---------|
| `txHash` | Blockchain transaction hash (proof of anchor) |
| `claimNumber` | On-chain claim number |
| `claimId` | Your claim UUID (same as in FHIR) |
| `pending` | `false` = confirmed on-chain; `true` = broadcast, waiting for confirmation |

---

## Recommended flow

```
Claim created in E-claims / MIS
            │
            ▼
     Build FHIR Bundle
            │
            ▼
   POST /check-duplicate   (optional)
            │
            ▼
      POST /submit
            │
            │  Backend auto-checks registries
            │  and anchors the claim
            ▼
  Response: txHash, claimNumber, claimId
            │
            ▼
   Store txHash + claimNumber in your DB
```

For most integrations, a single call to `/submit` is enough.

---

## Base URL and connectivity

| Item | Value |
|------|--------|
| Base URL | `http://eclaim-api.apeiro-digital.com/api` |
| Swagger | `http://eclaim-api.apeiro-digital.com/api` |
| Authentication | **API key required** — header `X-API-Key` (or `Authorization: Bearer <key>`) |
| Health | `GET /api/public/integration/health` (no API key) |
| Chain info | `GET /api/public/eclaim-contract/info` |

```bash
curl -s http://eclaim-api.apeiro-digital.com/api/public/integration/health
```

---

## Authentication

All e-claim and registry endpoints (except health) require an API key issued by platform ops.

**Header (preferred):**

```http
X-API-Key: <your-api-key>
```

**Alternative:**

```http
Authorization: Bearer <your-api-key>
```

Without a valid key, the API returns HTTP `401 Unauthorized`.

Share the partner key only with the e-claims integration team. Do not commit keys to public repos.

Platform ops issues one API key per partner. Pass it on every request as `X-API-Key`.

Example:

```bash
curl -s -X POST http://eclaim-api.apeiro-digital.com/api/public/eclaim-contract/check-duplicate \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: <your-api-key>' \
  -d '{"claimId":"YOUR-CLAIM-UUID"}'
```

---

## Integration steps

### 1. Trigger on claim create

When a claim or pre-authorization is saved successfully in your system, call the blockchain API. The call can be asynchronous so it does not block the user interface.

### 2. Check duplicate (optional)

```http
POST /api/public/eclaim-contract/check-duplicate
Content-Type: application/json
X-API-Key: <your-api-key>

{ "claimId": "a8ce4901-a9d4-419c-abea-182ad42992ab" }
```

| Response | Action |
|----------|--------|
| `false` | Proceed to submit |
| `true` | Already on-chain — do not submit again |

### 3. Submit the claim

```http
POST /api/public/eclaim-contract/submit
Content-Type: application/json
X-API-Key: <your-api-key>
```

Body is the FHIR R4 Bundle (not wrapped).

**Success (HTTP 201):**

```json
{
  "txHash": "0x124c28a722855d41270d9e4d3c2c4761d2d68221207aab7768bc2e66bb05a1bd",
  "claimNumber": "1749123456789",
  "claimId": "a8ce4901-a9d4-419c-abea-182ad42992ab",
  "recordUse": "claim",
  "fid": "FID-35-108719-7",
  "bundleHash": "0x...",
  "claimedTotal": "11000",
  "pending": false
}
```

To return immediately without waiting for block confirmation:

```http
POST /api/public/eclaim-contract/submit?wait=false
```

This returns the same shape with `"pending": true`.

### 4. Persist the result

Store at least:

- `claimId`
- `claimNumber`
- `txHash`

Explorer link (Apeiro network):

```
https://explorer.apeiro.adifoundation.ai/tx/<txHash>
```

Confirm the correct explorer for your environment via `/info` or platform ops.

### 5. Look up a claim later (optional)

```http
GET /api/public/eclaim-contract/{claimNumber}
```

```http
POST /api/public/eclaim-contract/search
Content-Type: application/json
X-API-Key: <your-api-key>

{ "claimId": "a8ce4901-a9d4-419c-abea-182ad42992ab" }
```

---

## Registries

Before a claim can be anchored, these three entities must be authorized on-chain:

| Entity | ID in FHIR | Registry API base |
|--------|------------|-------------------|
| Provider (facility) | `Organization.id` (FID) | `/api/public/provider-registry` |
| Citizen (patient) | `Patient.id` (CR ID) | `/api/public/citizen-registry` |
| Scheme | `Coverage` → `schemeCategoryCode` | `/api/public/insurer-registry` |

All registry routes require `X-API-Key` (same key as submit).

### Recommended: auto ensure (no manual register)

`/submit` already ensures registries automatically. Prefer that for normal claim create.

To pre-check or fix registries before submit:

```http
POST /api/public/integration/ensure-registries
Content-Type: application/json
X-API-Key: <your-api-key>
```

**Body option A — FHIR Bundle** (same as submit):

```json
{
  "bundle": { "resourceType": "Bundle", "...": "..." }
}
```

Or send the Bundle as the root body.

**Body option B — explicit IDs:**

```json
{
  "fid": "FID-35-108719-7",
  "crId": "CR3248022528592-4",
  "schemeCode": "CAT-SHA-001"
}
```

**What it does:**

1. Checks each ID on-chain  
2. If missing → looks up claim DB (when configured) and registers  
3. If DB has no row → uses bundle fields or safe defaults  

**Example response:**

```json
{
  "ok": true,
  "fid": "FID-35-108719-7",
  "crId": "CR3248022528592-4",
  "schemeCode": "CAT-SHA-001",
  "claimDbConfigured": true,
  "provider": {
    "id": "FID-35-108719-7",
    "authorized": true,
    "action": "registered",
    "txHash": "0xabc...",
    "source": "db"
  },
  "citizen": {
    "id": "CR3248022528592-4",
    "authorized": true,
    "action": "none",
    "source": "on-chain"
  },
  "scheme": {
    "id": "CAT-SHA-001",
    "authorized": true,
    "action": "registered",
    "txHash": "0xdef...",
    "source": "db"
  }
}
```

| `action` | Meaning |
|----------|---------|
| `none` | Already authorized on-chain |
| `registered` | Newly registered |
| `license_updated` | Provider license dates updated |
| `deregistered_and_registered` | Citizen/scheme re-registered with valid license |
| `skipped` | That registry not configured |
| `failed` | See `error` field |

Continue only when `"ok": true`.

### Manual registry APIs (advanced)

Use only if you manage registration yourself instead of `/ensure-registries`.

#### Provider

```http
POST /api/public/provider-registry/register
Content-Type: application/json
X-API-Key: <your-api-key>

{
  "providerId": "FID-35-108719-7",
  "name": "ST. LEONARDS HOSPITAL",
  "level": "LEVEL 4",
  "county": "NAIROBI",
  "facilityType": "hospital",
  "licenseValidFrom": "2010-01-01",
  "licenseValidTo": "2035-12-31"
}
```

```http
POST /api/public/provider-registry/search
X-API-Key: <your-api-key>

{ "providerId": "FID-35-108719-7" }
```

```http
POST /api/public/provider-registry/{providerId}/license
X-API-Key: <your-api-key>

{ "licenseValidFrom": "2010-01-01", "licenseValidTo": "2035-12-31" }
```

#### Citizen

```http
POST /api/public/citizen-registry/register
Content-Type: application/json
X-API-Key: <your-api-key>

{
  "id": "CR3248022528592-4",
  "meta": "",
  "validFrom": "2010-01-01",
  "validTo": "2035-12-31"
}
```

```http
POST /api/public/citizen-registry/search
X-API-Key: <your-api-key>

{ "id": "CR3248022528592-4" }
```

#### Scheme (insurer)

```http
POST /api/public/insurer-registry/register
Content-Type: application/json
X-API-Key: <your-api-key>

{
  "id": "CAT-SHA-001",
  "meta": "",
  "validFrom": "2010-01-01",
  "validTo": "2035-12-31"
}
```

```http
POST /api/public/insurer-registry/search
X-API-Key: <your-api-key>

{ "id": "CAT-SHA-001" }
```

Register responses typically look like:

```json
{ "txHash": "0x...", "providerId": "FID-35-108719-7" }
```

or if already on-chain:

```json
{ "txHash": null, "providerId": "FID-35-108719-7", "alreadyRegistered": true }
```

---

## FHIR Bundle requirements

Profile: QA MIS institutional (`Claim.use` = `claim` or `preauthorization`).

Required resources in `entry[]`:

| Resource | Used for |
|----------|----------|
| `Organization` | Facility FID, name, facility level |
| `Patient` | Citizen CR ID, optional national ID |
| `Coverage` | Scheme code (`schemeCategoryCode`) |
| `Claim` | Claim UUID, type, totals, billable period, intervention |

Only hashes and numeric fields are written on-chain. The full FHIR document is not stored on-chain.

### Example Bundle

```json
{
  "resourceType": "Bundle",
  "id": "32b8cef8-9bc6-4402-8556-856f42ebc028",
  "type": "message",
  "entry": [
    {
      "resource": {
        "resourceType": "Organization",
        "id": "FID-35-108719-7",
        "name": "ST. LEONARDS HOSPITAL",
        "extension": [{
          "url": "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level",
          "valueCodeableConcept": { "coding": [{ "code": "LEVEL 4" }] }
        }]
      }
    },
    {
      "resource": {
        "resourceType": "Coverage",
        "extension": [{ "url": "schemeCategoryCode", "valueString": "CAT-SHA-001" }]
      }
    },
    {
      "resource": {
        "resourceType": "Patient",
        "id": "CR3248022528592-4",
        "identifier": [{ "system": "nationalid", "value": "30360528" }]
      }
    },
    {
      "resource": {
        "resourceType": "Claim",
        "use": "claim",
        "identifier": [{
          "system": "https://qa-mis.apeiro-digital.com/fhir/claim",
          "value": "a8ce4901-a9d4-419c-abea-182ad42992ab"
        }],
        "type": { "coding": [{ "code": "institutional" }] },
        "subType": { "coding": [{ "code": "ip" }] },
        "total": { "value": 11000, "currency": "KES" },
        "billablePeriod": {
          "start": "2026-03-27T03:59:22+03:00",
          "end": "2026-03-29T17:00:47+03:00"
        },
        "created": "2024-12-03",
        "provider": { "reference": "Organization/FID-35-108719-7" },
        "patient": { "reference": "Patient/CR3248022528592-4" },
        "item": [{
          "productOrService": {
            "coding": [{ "code": "PMF-12-001", "display": "palliative care" }]
          }
        }]
      }
    }
  ]
}
```

---

## Error handling

| Situation | Action |
|-----------|--------|
| `Record already anchored` / duplicate | Treat as already on-chain; do not retry submit |
| `claimId mapped to other` | Treat as duplicate; look up via `/search` |
| Facility / citizen / scheme not registered | Call `/ensure-registries`, then retry `/submit` once |
| FHIR validation error | Fix the Bundle before retrying |
| Timeout or HTTP 5xx | Retry with backoff (max 3), same `claimId` |

Suggested pattern:

1. `POST /check-duplicate` — if `true`, stop  
2. `POST /submit`  
3. On registry error → `POST /ensure-registries` → retry `/submit` once  
4. On duplicate → stop  
5. On success → store `txHash` and `claimNumber`  

---

## API reference

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/public/integration/health` | Health and contract addresses (no API key) |
| `GET` | `/api/public/eclaim-contract/info` | Deployment and field guide |
| `POST` | `/api/public/eclaim-contract/check-duplicate` | Check if `claimId` is already anchored |
| `POST` | `/api/public/integration/ensure-registries` | Ensure FID / CR / scheme on-chain |
| `POST` | `/api/public/eclaim-contract/submit` | Anchor FHIR claim on-chain |
| `POST` | `/api/public/eclaim-contract/submit?wait=false` | Submit without waiting for receipt |
| `POST` | `/api/public/eclaim-contract/search` | Lookup by claim UUID |
| `GET` | `/api/public/eclaim-contract/:claimNumber` | Lookup by on-chain number |
| `POST` | `/api/public/provider-registry/register` | Register facility (FID) |
| `POST` | `/api/public/provider-registry/search` | Lookup facility |
| `POST` | `/api/public/provider-registry/:id/license` | Update facility license dates |
| `POST` | `/api/public/citizen-registry/register` | Register citizen (CR ID) |
| `POST` | `/api/public/citizen-registry/search` | Lookup citizen |
| `POST` | `/api/public/insurer-registry/register` | Register scheme |
| `POST` | `/api/public/insurer-registry/search` | Lookup scheme |

---

## Smoke test

```bash
BASE=http://eclaim-api.apeiro-digital.com
KEY=<your-api-key>

curl -s "$BASE/api/public/integration/health"

curl -s -X POST "$BASE/api/public/eclaim-contract/check-duplicate" \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $KEY" \
  -d '{"claimId":"YOUR-CLAIM-UUID"}'

curl -s -X POST "$BASE/api/public/eclaim-contract/submit" \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $KEY" \
  -d @claim-bundle.json

# Optional: ensure registries only
curl -s -X POST "$BASE/api/public/integration/ensure-registries" \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $KEY" \
  -d '{"fid":"FID-35-108719-7","crId":"CR3248022528592-4","schemeCode":"CAT-SHA-001"}'
```

---

## Summary

| Question | Answer |
|----------|--------|
| When to call? | When a claim or pre-authorization is created in E-claims |
| What to send? | FHIR R4 Bundle + `X-API-Key` header |
| What comes back? | `txHash`, `claimNumber`, `claimId`, `pending` |
| Who handles registries? | The API — auto ensure on submit |
| Wallet required? | No |
| Auth required? | Yes — API key from platform ops |

**When a claim is created → POST FHIR Bundle to `/submit` with `X-API-Key` → store `txHash` and `claimNumber`.**

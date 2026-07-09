# Demo screenshots guide (E-Claims blockchain anchoring)

Capture these screenshots for stakeholder demos, runbooks, and ADI programme status reports.  
Save under `docs/images/demo/` (create the folder when you capture them).

## Prerequisites

- Backend running on `http://localhost:8001` with `OWNER_PRIVATE_KEY` and funded owner wallet (~1+ ADI).
- Frontend running on `http://localhost:3000`.
- ClaimRegistry deployed at `0xA8eFbf955496518D6e3Cb10ABC90627671534088` (Spearhead chain 99991).

---

## 1. How it works (on-chain vs off-chain)

**URL:** `/how-it-works`

**What to show:** End-to-end flow steps, green “On-chain (hashes only)” panel, grey “Off-chain” panel, live deployment block with contract address.

**Why:** Proves PHI is not stored on-chain and only hashes/amounts/dates are anchored.

**Filename suggestion:** `01-how-it-works.png`

---

## 2. Submit FHIR — before anchor

**URL:** `/submit`

**What to show:** Page with “Sample claim” selected, minimal FHIR JSON in textarea, “Anchor on Spearhead” button visible.

**Why:** Shows MIS → portal entry point without wallet.

**Filename:** `02-submit-before.png`

---

## 3. Submit FHIR — success

**URL:** `/submit` (after successful anchor)

**What to show:** Green success box with `claimId`, `claimNumber`, `txHash`, `bundleHash`, and links to Browse / Explorer.

**Why:** Proof of end-to-end anchoring.

**Filename:** `03-submit-success.png`

---

## 4. Spearhead explorer transaction

**URL:** `https://explorer.spearhead.adifoundation.ai/tx/<txHash>` (from success screen)

**What to show:** Confirmed transaction, contract `0xA8eF…`, method `upsertClaim`, gas used.

**Why:** On-chain evidence for auditors.

**Filename:** `04-explorer-tx.png`

---

## 5. Browse claims (no wallet)

**URL:** `/browse`

**What to show:** Claims table with the row from step 3 (claim id, FID, total, status). No MetaMask prompt.

**Why:** Read path for payers/reviewers without wallet.

**Filename:** `05-browse-claims.png`

---

## 6. Search by claim ID

**URL:** `/search` (wallet connected) **or** use Browse if search is wallet-gated

**What to show:** Search input with claim UUID from step 3, single matching result.

**Filename:** `06-search-claim.png`

---

## 7. Duplicate rejection

**URL:** `/submit`

**What to show:** Re-submit the **same** claim UUID; red error: “Record already anchored…”.

**Why:** Duplicate prevention before gas spend.

**Filename:** `07-duplicate-rejected.png`

---

## 8. Pre-authorization sample

**URL:** `/submit` → “Sample pre-auth” or “Full QA MIS pre-auth”

**What to show:** Success with `recordUse: preauthorization`.

**Filename:** `08-preauth-success.png`

---

## 9. Claims list with wallet (optional / legacy demo)

**URL:** `/` with MetaMask on Spearhead

**What to show:** Original wallet-gated claims list still works.

**Filename:** `09-claims-wallet.png`

---

## 10. Issue Claim demo (optional)

**URL:** `/issue-claim` with MetaMask

**What to show:** MetaMask-signed demo upsert (separate from sponsored FHIR flow).

**Filename:** `10-issue-claim-demo.png`

---

## 11. Provider registry (optional / future wiring)

**URL:** `/provider-registry` with MetaMask

**What to show:** Provider list UI (not yet validated on FHIR submit).

**Filename:** `11-provider-registry.png`

---

## 12. Insufficient gas error (optional)

**URL:** `/submit` when owner wallet is underfunded

**What to show:** Friendly backend error with balance vs required ADI.

**Filename:** `12-gas-error.png`

---

## 13. ADI programme hub

**URL:** `/registries`

**What to show:** Deliverables 1–3 and 6 marked Done; items 4–5 pending; registry portal links; integration health block.

**Filename:** `13-adi-registries-hub.png`

---

## 14. Citizen / insurer registry (hash-only)

**URL:** `/citizen-registry` and `/insurer-registry` after seed

**What to show:** Registered CR id and scheme code with status **registered**, authorized **Yes**. No patient names on screen or chain.

**Filename:** `14-citizen-insurer-registry.png`

---

## 15. Registry validation error (optional)

**URL:** `/submit` without seeding first

**What to show:** Error that facility or citizen is not authorized — proves validation before gas.

**Filename:** `15-registry-validation-error.png`

---

## Quick capture checklist (updated)

| # | Screen | Required for MVP demo |
|---|--------|---------------------|
| 1 | How it works | Yes |
| 13 | ADI registries hub | Yes |
| 2–3 | Submit before + success | Yes |
| 4 | Explorer tx | Yes |
| 5 | Browse claims | Yes |
| 7 | Duplicate rejection | Yes |
| 14 | Citizen/insurer registry | Recommended |
| 8 | Pre-auth | Recommended |
| 6, 9–12, 15 | Optional | As needed |

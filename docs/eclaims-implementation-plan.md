# E-Claims — Implementation Plan

**Programme:** SHA E-claims / ADI Spearhead  
**Document version:** 2.0  
**Last updated:** July 2026

---

## 1. Objective

Deliver the E-Claims blockchain anchoring platform in two stages:

| Stage | Environment | Goal |
|-------|-------------|------|
| **Stage 1 — Demonstration** | Spearhead **Testnet** | Prove end-to-end FHIR submit, anchoring, list, and search for SHA and partners |
| **Stage 2 — Production** | Spearhead **Mainnet** (production network) | Operate the same anchoring service for live institutional claims and pre-authorizations with production security and governance |

**Stage 1 — demonstration outcomes:**

1. A healthcare provider submits a complete institutional FHIR Bundle (claim or pre-authorization).
2. E-Claims validates the bundle, anchors required hashed fields on the blockchain, and returns a transaction receipt.
3. Users submit, search, and view anchored claims through the portal.
4. Technical documentation is prepared for SHA and implementation partners.

**Stage 2 — production outcomes:**

1. Same FHIR anchoring flow on Spearhead Mainnet with audited contracts and governed keys.
2. Sponsored gas and stable API for provider/MIS integration.
3. Monitoring, authentication, and operational runbooks for SHA operations.
4. Foundation for future payer sync, registry validation, and settlement proof (see Section 9).

---

## 2. Deployment environments

| Setting | Testnet (Stage 1) | Mainnet (Stage 2) |
|---------|-------------------|-------------------|
| **Purpose** | Demo, UAT, integration testing | Live claim / pre-auth anchoring |
| **Network** | Spearhead Testnet | Spearhead Mainnet (production) |
| **Chain ID** | `99991` | *As published by ADI Foundation for production* |
| **RPC** | `https://rpc.spearhead.adifoundation.ai` | *Production RPC (ADI / SHA agreed)* |
| **Explorer** | Spearhead testnet explorer | Spearhead mainnet explorer |
| **Gas token** | Test ADI | Production ADI |
| **Contract audit** | Recommended for testnet pilot | **Required** before mainnet deploy |
| **Owner key** | Development wallet | HSM / multisig (SHA governance) |
| **API exposure** | Internal + demo portal | Authenticated production APIs |

---

## 3. Features available by stage

### 3.1 Available on Testnet (Stage 1 — demonstration)

| Feature | Available | Description |
|---------|-----------|-------------|
| FHIR bundle submit (claim) | **Yes** | Full QA MIS institutional bundle → on-chain anchor |
| FHIR bundle submit (pre-authorization) | **Yes** | Same bundle; `Claim.use = preauthorization` |
| Bundle integrity hash | **Yes** | Full bundle fingerprint stored as hash only |
| Duplicate claim prevention | **Yes** | Same Claim UUID rejected at intake |
| Sponsored gas (no provider wallet) | **Yes** | Backend wallet signs and pays gas |
| List anchored claims | **Yes** | Paginated list via API and portal |
| Search by Claim ID / Claim Number | **Yes** | Lookup anchored records |
| Duplicate check API | **Yes** | Pre-submit verification |
| Manual status update | **Yes** | Backend updates on-chain status (ops / demo) |
| MetaMask demo (Issue Claim) | **Yes** | Optional workshop path |
| Full QA MIS sample bundles in portal | **Yes** | Minimal and full institutional samples |
| PHI on-chain | **No** | Hash-only model — privacy by design |
| Provider / facility registry validation | **No** | Future — facility id stored as hash only |
| Forward to Payers after anchor | **No** | Future — national integration |
| Payer status sync on-chain | **No** | Future |
| Payment settlement proof on-chain | **No** | Future |
| Production API authentication | **No** | Future (Stage 2 hardening) |

### 3.2 Available on Mainnet (Stage 2 — production launch)

**Included in mainnet v1.0** (same functional scope as proven on testnet):

| Feature | Available |
|---------|-----------|
| Institutional FHIR claim anchoring | **Yes** |
| Pre-authorization anchoring | **Yes** |
| Duplicate prevention | **Yes** |
| Bundle integrity proof | **Yes** |
| List, get, search, duplicate-check APIs | **Yes** |
| Provider/MIS integration via REST submit API | **Yes** |
| Sponsored gas model | **Yes** |
| Portal: submit, list, search | **Yes** |
| Production contract deployment (audited Claim Registry) | **Yes** |
| Governed owner wallet (multisig / HSM) | **Yes** |
| API authentication (OAuth2 / API keys) | **Yes** |
| Rate limiting and monitoring | **Yes** |
| Environment-specific configuration | **Yes** |
| Operational runbook and SHA handover | **Yes** |

**Not in mainnet v1.0** (planned future releases):

| Feature | Target |
|---------|--------|
| Verifiable facility / citizen / clinician / insurer registries on-chain | Programme phase c |
| Hospital and insurer contracting on-chain | Programme phase d |
| Member and benefit package registry | Programme phase e |
| Automatic payer adjudication sync | Post v1.0 |
| Payment settlement ledger | Post v1.0 |
| Regulator analytics dashboard | Post v1.0 |

---

## 4. Implementation scope

| Component | Work item |
|-----------|-----------|
| **Smart contract** | Deploy minimal Claim Registry on Spearhead (testnet then mainnet). Store only hashes, amounts, dates, and status — no patient or clinical data on-chain. |
| **Backend services** | Parse QA MIS FHIR bundles; validate mandatory fields; reject duplicates; submit transactions via sponsored backend wallet. |
| **REST APIs** | Submit bundle, list claims, get claim, search by Claim ID, duplicate check, optional status update. |
| **Frontend portal** | FHIR submission, claims list, claim search; optional MetaMask demo. |
| **Configuration** | Contract address, RPC, owner wallet, gas funding per environment (testnet vs mainnet). |
| **Production readiness (mainnet)** | Contract audit, key governance, API auth, monitoring, DR runbook. |

---

## 5. Project dependencies

**Required before development (both stages):**

- Spearhead network access (testnet, then mainnet)
- Funded owner wallet (ADI for gas)
- PostgreSQL database
- Redis cache

**Additional for mainnet (Stage 2):**

- Completed smart contract security audit
- SHA governance approval for contract address and signers
- Production RPC and explorer endpoints from ADI Foundation
- API authentication credentials for MIS / provider channels
- Privacy and data-classification sign-off (hash-only model)

**Implementation sequence:**

1. Deploy smart contract (testnet).
2. Configure owner wallet and fund for gas.
3. Develop and test FHIR parser.
4. Implement claim submission API.
5. Implement listing and search APIs.
6. Develop frontend pages.
7. End-to-end testing on testnet.
8. Documentation and SHA demo.
9. **Audit, mainnet deploy, production config, and go-live.**

---

## 6. Smart contract design

### Purpose

The smart contract is a tamper-evident registry for claim submissions. It does not store complete claim or clinical records.

### Data stored on-chain

- Claim ID (hash)
- Bundle ID (hash)
- Full bundle integrity hash
- Record type (claim / pre-authorization)
- Facility ID, facility level, scheme code (hashed)
- Patient reference hashes (CR id, national id)
- Claim type, intervention code
- Service dates, claim amount, inpatient flag
- Claim lifecycle status

Sensitive identifiers appear only as cryptographic hashes.

### Data stored off-chain

Patient name, phone, date of birth, demographics, diagnosis, clinical notes, attachments, invoices, and the complete FHIR bundle remain in the E-Claims platform and provider systems. Integrity is proven via the bundle hash.

### Smart contract capabilities

- Register new claim anchors
- Reject duplicate Claim IDs
- Update claim status (manual in v1; payer sync in future)
- Emit events for audit and reporting

**Deployment:** Spearhead Testnet (Stage 1) → Spearhead Mainnet (Stage 2, post-audit).

---

## 7. Backend services

### Claim submission flow

1. Receive institutional FHIR Bundle (JSON).
2. Validate structure and mandatory fields.
3. Check for duplicate Claim ID.
4. Extract anchor fields and generate bundle integrity hash.
5. Submit blockchain transaction (backend wallet).
6. Return transaction hash, claim number, claim ID, and bundle hash.

### Validation rules

- `Claim.use` must be `claim` or `preauthorization`.
- Claim amount and service period are mandatory.
- Duplicates are rejected before blockchain submission.

### Read APIs

| API | Description |
|-----|-------------|
| List claims | Paginated list of anchored claims |
| Get claim | Retrieve by claim number or Claim UUID |
| Search | Search by Claim ID |
| Duplicate check | Verify whether a claim is already anchored |

*Mainnet v1:* submit and read APIs protected by authentication.

---

## 8. Frontend portal

| Feature | Description |
|---------|-------------|
| **Submit claim** | Paste or load sample FHIR bundle; anchor without MetaMask |
| **Claims list** | Display anchored claims from backend APIs |
| **Claim search** | Search by Claim ID or claim number |
| **Manual claim (optional)** | MetaMask demo for workshops |

---

## 9. Acceptance criteria

| No. | Criterion | Testnet | Mainnet v1 |
|-----|-----------|---------|------------|
| 1 | Full institutional FHIR bundle anchored without provider wallet | Required | Required |
| 2 | Duplicate Claim UUID rejected | Required | Required |
| 3 | No PHI stored on-chain | Required | Required |
| 4 | Pre-authorization via `Claim.use = preauthorization` | Required | Required |
| 5 | Anchored claims in list and search | Required | Required |
| 6 | Transaction visible on Spearhead explorer | Required | Required |
| 7 | Clear errors for wallet / gas misconfiguration | Required | Required |
| 8 | API authentication enforced | N/A | Required |
| 9 | Contract audit completed | Recommended | **Required** |
| 10 | Governed production signer (not dev key in env) | N/A | Required |

---

## 10. Risks and mitigation

| Risk | Mitigation |
|------|------------|
| Owner wallet does not match contract | Redeploy or transfer ownership; update configuration per environment |
| Insufficient ADI for gas | Balance pre-check; alerts; funded operations wallet |
| PostgreSQL or Redis unavailable | Health checks; run both before backend start |
| Incorrect contract address | Single documented address per environment (testnet vs mainnet) |
| Invalid FHIR JSON | Validate and reject before blockchain submission |
| Mainnet deploy before audit | Gate mainnet on external audit sign-off |
| Testnet config used in production | Separate env files and deployment pipelines |

---

## 11. Future enhancements (after mainnet v1)

- Payer status synchronization to on-chain lifecycle
- Provider and facility registry validation at submit
- Verifiable registries (citizens, facilities, clinicians, insurers)
- Hospital and insurer contracting on ADI Chain
- Member and benefit package registration
- Blockchain payment settlement proof
- Regulator dashboard and unified audit timeline
- Advanced performance optimization and multi-region DR

See [ADI programme implementation plan (c–f)](./adi-programme-eclaims-implementation-plan.md) for the wider roadmap.

---

## 12. Expected outcome

**After testnet (Stage 1):** E-Claims demonstrates secure blockchain anchoring of institutional FHIR claim and pre-authorization bundles on Spearhead Testnet — tamper-evident integrity, duplicate prevention, searchable records, and a complete demo for SHA stakeholders.

**After mainnet (Stage 2):** The same capabilities operate on **Spearhead Mainnet** under SHA governance, with audited contracts, authenticated APIs, and operational readiness for provider/MIS integration — forming the production foundation for the national E-Claim transaction platform (ADI programme product **f**), with registries and payer/settlement features delivered in subsequent programme phases.

---

**Related documents:** [Demo runbook](./demo-runbook.md) · [Network reference](./network-and-contract-reference.md) · [FHIR mapping](./blockchain-fhir-integration.md) · [Whitepaper](./blockchain-whitepaper.md)

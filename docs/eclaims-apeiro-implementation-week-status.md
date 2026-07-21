# E-Claims – Implementation Status Report

Target Deployment: Apeiro Network (ADI Foundation L3)

Programme: SHA E-Claims / Blockchain Anchoring

Reporting Date: 17 July 2026

Status: Implemented and ready for demonstration and SHA review

Portal: https://eclaim.apeiro-digital.com/

API: https://eclaim-api.apeiro-digital.com/

Network Explorer: https://explorer.apeiro.adifoundation.ai


1. Objective

The E-Claims Claim Anchoring Platform has been implemented and deployed on a production-grade ADI Foundation chain — Apeiro Network (chain ID 37001).

The live platform now supports the following:

Healthcare providers can submit complete institutional FHIR Bundles for Claims or Pre-Authorizations.

The E-Claims platform validates the FHIR bundle against on-chain registries (facility, citizen, and scheme) before gas is spent.

The platform securely anchors the required hashed claim information on the blockchain. No personal health information (PHI) is stored on-chain.

Users can submit, list, and search anchored claims through the web portal.

Multi-registry governance is in place for providers, citizens, clinicians, and insurers, supporting trust and audit.

Deployment configuration, documentation, and demonstration materials are completed and available for SHA review.


2. What Was Implemented

Smart Contracts

The claim anchoring contracts were finalized, deployed to Apeiro, and documented with contract addresses and the owner wallet.

Delivered: Five contracts on Apeiro — ClaimRegistry, ProviderRegistry, CitizenRegistry, ClinicianRegistry, and InsurerRegistry. Owner wallet documented and funded for operations and demos.

Backend Services

FHIR parser, Claim Submission API, List / Search / Get APIs, duplicate claim validation, and sponsored gas transactions using the production signing wallet are implemented and live.

Delivered: End-to-end APIs. Registry authorization checks run before anchoring. Gas and transaction audit logging. Demo seeding APIs for bulk and random claim generation.

Frontend Portal

FHIR Bundle Submission, Claims List, and Claim Search are implemented in the portal.

Delivered: Submit FHIR, Claims browse and search with pagination, and registry management pages for provider, citizen, clinician, and insurer. MetaMask-assisted writes supported where needed for interactive demos.

Configuration

Apeiro RPC endpoint, contract addresses, owner wallet, and gas funding are configured.

Delivered: Network switch support for apeiro, adi, and spearhead. Apeiro RPC, explorer, and bridge configured. Production environment templates prepared for server deployment.

Documentation

Implementation documentation, deployment runbook, and network reference materials for SHA and partners are available.

Delivered: Network reference, server environment paste files, demo runbook, screenshots guide, and this status report.

Testing

End-to-end testing covering claim submission, blockchain anchoring, listing, and searching on Apeiro is completed.

Delivered: Registries seeded; ninety-five or more claim and pre-authorization anchors prepared for demonstration; list and search verified against on-chain data.


3. Features Available Now

The following functionality is live.

Submit institutional FHIR Claims.

Submit institutional FHIR Pre-Authorizations (Claim.use = preauthorization).

Store the full bundle integrity hash on the blockchain.

Duplicate Claim UUID prevention (API and on-chain mapping).

Sponsored gas via the platform owner wallet, so a provider wallet is not required for the server-side submit path.

Optional MetaMask signing path for interactive demonstrations.

View anchored claims (list with pagination).

Search by Claim ID.

Clear validation errors when owner wallet configuration, gas funding, or registry checks fail.

Manual claim status updates by the contract owner.

Portal-based claim submission, listing, and search.

Blockchain transaction verification via the Apeiro Explorer.

Provider (FID) registry — facility must exist and be authorized before a claim is accepted.

Citizen (CR) registry — beneficiary reference is hashed and checked before anchoring.

Insurer / scheme registry — scheme code must be authorized before anchoring.

Clinician registry — clinician license and facility linkage stored as hashes only.

Multi-network readiness — Apeiro is primary; ADI and Spearhead remain configurable.


4. What Is Stored On-Chain vs Off-Chain

This separation is central to SHA and data-protection expectations.

On-chain (immutable and auditable — hashes and structured numbers only)

Claim ID hash — uniquely identifies the claim without putting the clear UUID on chain as the primary display field.

Bundle ID hash and bundle content hash — prove integrity of the full FHIR bundle at a later date.

Record use hash — distinguishes claim from pre-authorization.

Facility (FID) hash and facility level hash — link to an authorized provider.

Scheme code hash — link to an authorized insurer or benefit category.

Citizen CR hash and national ID hash where applicable — link to a registered beneficiary reference.

Claim type and intervention code hashes — clinical coding references without free text.

Billable period, claimed total, and inpatient / outpatient flag — structured commercial fields for audit.

Lifecycle status — optional status updates by the owner.

No patient names, phone numbers, diagnosis narrative, attachments, or full FHIR JSON are written to the blockchain.

Off-chain (application and API)

Full FHIR Bundle — clinical and administrative detail for operations.

Display labels for list and search UX where the platform already knows the identifiers.

Portal session and API hosting — user experience.

Trust checks before anchoring (business benefit)

Before a claim spends gas or is accepted, the platform verifies:

The provider (FID) is registered and authorized in the ProviderRegistry.

The citizen (CR) is registered and authorized in the CitizenRegistry.

The scheme is registered and authorized in the InsurerRegistry.

The Claim UUID is not a duplicate of an already anchored record.

These controls prevent invalid facilities, unknown beneficiaries, or wrong schemes from polluting the ledger — a material control for SHA and payers.


5. Smart Contracts Implemented

ClaimRegistry

Anchors hashed claim and pre-authorization records, enforces duplicate mapping, and supports status updates.

Business value: a single source of truth that a claim was submitted and when.

ProviderRegistry

Facilities (FID), licence validity window, and authorization.

Business value: only approved providers can drive claims onto the chain.

CitizenRegistry

Hashed CR identifiers and enrollment validity.

Business value: beneficiary existence checks without storing PHI on-chain.

ClinicianRegistry

Hashed clinician identity and facility linkage.

Business value: optional clinical credentialing trail for future enforcement.

InsurerRegistry

Hashed scheme codes.

Business value: scheme-level gate before the payment pathway.

All five contracts are deployed on Apeiro (chain ID 37001) under a controlled owner wallet with gas funded for demonstration and operations.


6. Network and Deployment Snapshot (Apeiro)

Network name: Apeiro Network

Chain ID: 37001

RPC: https://rpc.apeiro.adifoundation.ai

Explorer: https://explorer.apeiro.adifoundation.ai

Alternate explorer (BLS): https://explorer-bls.apeiro.adifoundation.ai

Bridge: https://bridge.apeiro.adifoundation.ai

Owner / deployer wallet: 0xCb01D9DEc076837eF915E0ffd8d9182264FC5FAE

Contract addresses

ClaimRegistry: 0xA8eFbf955496518D6e3Cb10ABC90627671534088

ProviderRegistry: 0xeda747a951502878079a789DA5D3380dA6Ec2276

CitizenRegistry: 0xb859A8D8e23D8581aafb5e7C03A8CC2F854a9Cc4

ClinicianRegistry: 0xd646829b3310a17B660079acc7F4A97DBFC9ce2D

InsurerRegistry: 0x64e8Ffca1907B0769Bf02cB60DC62D0e1070a591


7. Project Dependencies

Access to the ADI Foundation chain and production RPC endpoint — in place. Apeiro RPC and explorer are live.

Production owner wallet funded with sufficient ADI tokens for gas — in place. Used for deployment and demo anchors.

PostgreSQL database and Redis cache — available on the deployment VMs as per the existing host platform.

Approved Golden FHIR sample bundle based on the QA MIS profile — in place. Minimal and full QA MIS samples are available in the portal.


8. Acceptance Criteria — All Met

Successfully anchor complete institutional FHIR Bundles on the target chain without requiring a provider wallet (sponsored path) — Done.

Automatically reject duplicate Claim UUID submissions — Done.

Ensure no Personal Health Information (PHI) is stored on the blockchain — Done. Hashes only.

Support Pre-Authorization submissions using Claim.use = preauthorization — Done.

Display successfully anchored claims in both the Claims List and Search pages — Done. List reads from chain.

Make blockchain transactions visible on the Apeiro Explorer — Done.

Display clear validation errors when the owner wallet configuration or gas funding is incorrect — Done.

Registry gates: provider, citizen, and scheme checked before anchor — Done. This strengthens the control story for SHA beyond a basic claim-hash demo.


9. Outcomes Summary (for Management)

The programme has moved from a narrow “claim hash on one contract” demonstration to an operational trust stack.

Chain deployment: the full stack is live on Apeiro (37001) with documented RPC, explorer, bridge, and environment templates.

Contract surface: five coordinated contracts — claims plus four identity and scheme registries.

Controls: pre-anchor validation against provider, citizen, and scheme reduces invalid ledger entries and supports anti-fraud narratives.

Product experience: Submit FHIR, browse and search claims, and manage registries in one portal.

Demo readiness: facilities, schemes, and citizens are seeded; ninety-five or more claim and pre-authorization anchors are available for review demos.

Operability: gas and transaction audit logs, deployment paste files for servers, and multi-network switching without a rewrite.

Compliance posture: an explicit on-chain versus off-chain boundary aligned with privacy expectations.

Bottom line: SHA stakeholders can review a live environment where claims are validated, anchored, discoverable, and independently verifiable on the Apeiro explorer — with a clear story for privacy, anti-fraud (duplicates and registry gates), and a path to production operations.


10. Deliverables Completed

The following deliverables are available:

Apeiro Claim Registry smart contract suite (five contracts), with addresses documented above.

Backend APIs for claim submission and retrieval.

Web portal for FHIR submission and claim search.

Blockchain-anchored institutional claims and pre-authorizations.

End-to-end demonstration environment with seeded data.

Deployment configuration documentation (including Apeiro server environment templates).

Technical and demo runbook materials.

This management implementation status report.


11. Optional Follow-On Work

Formal SHA walkthrough of the portal and explorer verification.

Align golden FHIR samples with final QA MIS production profiles.

Production wallet custody or multi-signature for the owner role (operations hardening).

Shared persistence for claim display metadata if multi-region API nodes are required.

Expand clinician enforcement into the submit path if SHA requires it as a hard gate.


Document prepared for SHA and programme management — E-Claims blockchain implementation completed on Apeiro, 17 July 2026.

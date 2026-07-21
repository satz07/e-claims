# E-Claims — Implementation Status (Apeiro)

Target: Apeiro Network (ADI Foundation L3, chain ID 37001)

Programme: SHA E-claims / Blockchain anchoring

Date: 17 July 2026

Status: Implemented

Full management report: eclaims-apeiro-implementation-week-status.md

Portal: https://eclaim.apeiro-digital.com/

Explorer: https://explorer.apeiro.adifoundation.ai


1. What is live

Providers can submit institutional FHIR claims and pre-authorizations.

The platform validates provider, citizen, and scheme registries before anchoring.

Hashed claim data is stored on Apeiro. No PHI is on-chain.

Users can submit, list, and search claims in the portal.

Five smart contracts are deployed: ClaimRegistry plus Provider, Citizen, Clinician, and Insurer registries.

Documentation and demo materials are ready for SHA review.


2. Features available now

Submit FHIR claims and pre-authorizations.

Bundle integrity hash on-chain.

Duplicate claim prevention.

Sponsored gas via platform wallet.

Claims list and Claim ID search.

Registry checks for facility, citizen, and scheme.

Apeiro explorer verification.


3. Network

Chain ID: 37001

RPC: https://rpc.apeiro.adifoundation.ai

Explorer: https://explorer.apeiro.adifoundation.ai

See the full status report for contract addresses and acceptance criteria.

Blockchain value for E-claims

Audience: Leadership, partners, auditors, whitepaper readers
Purpose: Explain why blockchain is used in the E-claims programme and what value it brings to the wider healthcare claims ecosystem.

For the full institutional whitepaper (architecture, contracts, governance, roadmap, KPIs), see [blockchain-whitepaper.md](./blockchain-whitepaper.md).


System components overview

The SHA claims ecosystem is built around four major platforms, each with a clear mandate.

Provider maintains hospital and facility records and is responsible for the creation and management of Facility Identifier details. Providers are the healthcare organisations that deliver services and submit pre-authorizations and claims into the national flow.

Payers receives, processes, adjudicates, and approves claims and pre-authorizations. This is where clinical and policy decisions are made and where claim outcomes are determined.

IFS is the enterprise resource planning system and the financial and operational system of record. It holds master data for patients, providers, and interventions or benefits. It stores invoice and payment-related information. When a claim is approved for payment, IFS forwards the payment request to the payment gateway.

Payment Gateway executes payment and settlement. It receives approved payment requests from IFS, completes the financial transaction, and returns payment status back into the operational flow.

E-claims sits between these systems as the channel through which claims are created, validated, and passed forward. It does not replace Provider, Payers, IFS, or the Payment Gateway. Each platform remains the authority for its own domain. E-claims adds a shared layer of trust and traceability across their boundaries.


The challenge

A single claim may touch every component in this chain. The provider submits it. Payers adjudicates it. IFS prepares the financial outcome. The Payment Gateway settles it. Along the way, each system records its own version of events, identifiers, amounts, and statuses.

When parties disagree about what was submitted, when it was approved, or whether payment occurred, investigations depend on reconciling separate databases and audit logs. That process is slow, expensive, and often inconclusive because no single party holds a record that all others accept as neutral.

E-claims addresses this gap not by copying clinical or financial master data onto a ledger, but by anchoring the critical moments in the claim lifecycle in a way that all participants can verify independently.


Design principle:

Patient names, clinical notes, invoices, and full claim payloads belong in Provider systems, Payers, and IFS. Those platforms are designed to manage rich operational and financial data at scale.

The blockchain layer stores only what is needed to prove integrity: that a claim was submitted by an authorised provider, that it carried a specific financial request for a defined period, that adjudication and payment milestones occurred in sequence, and that the underlying submission has not been altered without detection.

Personal and clinical detail stay off the ledger. What goes on-chain are cryptographic fingerprints, lifecycle states, and timestamps that bind the ecosystem together without exposing sensitive information.


How E-claims fits the end-to-end flow

When a provider raises a claim or pre-authorization, E-claims receives the submission and records an immutable receipt on Spearhead L3. That receipt links the provider facility identity, the claim reference, the requested amount, and the service period to a point in time that cannot be rewritten.

The full claim is then passed to Payers for adjudication as it is today. Payers continues to own the decision to approve, reject, or return a claim. When outcomes change, those transitions can be reflected on the ledger so that downstream systems and auditors see a single, ordered history.

Once Payers approves a claim for payment, IFS takes over as the financial system of record. Invoice and payment data remain in IFS. When IFS releases a payment request to the Payment Gateway, the settlement event can likewise be anchored so that proof of payment exists outside any one vendor database.

The result is a continuous thread from provider submission through payer decision, financial approval, and gateway settlement, without forcing any platform to surrender its role as system of record.


Value delivered by blockchain

Tamper-evident submission. Providers gain independent proof that a claim was lodged on a given date with a given financial request. If a dispute arises later, the original submission can be verified without relying solely on Payers or IFS logs.

Authorised provider assurance. Facility identifiers and provider standing can be attested on-chain before a claim is accepted. Claims from facilities that are not registered, licensed, or active for the service period can be stopped at intake, reducing fraud and rework in adjudication.

Pre-authorization integrity. Guarantee letters and pre-authorizations can be bound to subsequent claims so that each authorization is used once. This strengthens controls for inpatient and high-value pathways where duplicate billing is a material risk.

Cross-system traceability. Provider, Payers, IFS, and the Payment Gateway each use their own reference numbers. The ledger provides a neutral correlation point so investigations and reconciliations do not depend on manual matching across siloed systems.

Adjudication and payment transparency. Approval, rejection, and payment milestones recorded on-chain give regulators, auditors, and partners a timeline they can trust. No single organisation controls the only copy of that history.

Privacy by design. Because only fingerprints and states are stored on-chain, the model supports strong health data protection while still delivering the auditability the programme requires.


What each stakeholder gains
    
Providers receive a durable receipt of submission and a fair basis for dispute resolution when outcomes are questioned.

Payers benefit from intake validation against authorised facilities and from a shared record of decisions that supports surveillance and partner oversight.

IFS can align financial events with an independent settlement trail, simplifying reconciliation between approved claims and executed payments.

The Payment Gateway can confirm that a payment instruction corresponds to a claim that was previously approved and anchored, strengthening control over disbursement.

Regulators and the Social Health Authority gain a verifiable view across the full chain from service delivery through payment, without consolidating sensitive clinical data on a public ledger.

Patients and beneficiaries are protected because their personal information remains in accredited operational systems while the programme still gains stronger fraud and integrity controls.


ADI Network and Layer 3 architecture

The E-claims blockchain layer is built on the ADI Network, a purpose-designed ecosystem for institutional and enterprise workloads. Within this ecosystem, Spearhead operates as a Layer 3 chain: a dedicated execution environment where E-claims smart contracts run, while security is inherited from the layers below.

A Layer 3 chain in the ADI model is a zero-knowledge rollup. It processes transactions in its own sequencer and prover environment, then settles its state to the ADI Chain at Layer 2. The ADI Chain in turn settles to Ethereum Mainnet at Layer 1. This creates a layered security model. L3 transactions are not isolated promises from a single vendor; they are backed by validity proofs that propagate upward through L2 and ultimately to Ethereum.

Each batch of L3 activity moves through a defined lifecycle. Transactions are ordered and included in L3 blocks. Batches are committed to the settlement layer, proved using zero-knowledge cryptography, and then executed so that the new state root is recorded. Soft confirmation is available within seconds for operational use. Stronger confirmation builds as batches are committed and proved on L2, and as L2 itself is proved and executed on L1. For healthcare claims, this means that anchoring events can be used immediately in operational flows while cryptographic finality strengthens over time in line with institutional risk appetite.

The ADI L3 ecosystem uses shared infrastructure at the settlement layer, including a central bridge registry and state transition management, while each chain such as Spearhead maintains its own execution state and contracts. Multiple application-specific chains can coexist without sharing execution risk. E-claims contracts live on Spearhead; other programmes can deploy separate chains under the same ADI governance and proving model.

Zero-knowledge rollups are particularly suited to public-sector and regulated finance use cases. They provide verifiable execution without publishing sensitive payload data on the ledger. Combined with the E-claims design of storing only hashes and lifecycle states on-chain, the platform aligns technical architecture with health data protection expectations.

Further technical background on ADI L3 chains is published at:
https://docs.adi.foundation/adi-network-components/overview-1


Spearhead testnet and E-claims deployment

Spearhead Testnet is the ADI Layer 3 network used for the E-claims demonstration and integration programme today. It provides a controlled environment to deploy, test, and audit smart contracts before any production cutover.

Partners and auditors can verify contract code and transactions through the Spearhead block explorer. Wallet users connect to Spearhead Testnet in MetaMask or compatible wallets using the RPC URL and chain ID above, then interact with the E-claims portal to issue claims or manage provider records where authorised.

In production, the same architectural pattern applies: application logic and anchors on an ADI L3 chain, settlement and proving through ADI L2, and long-term security anchoring to Ethereum L1.

Why ZK rollup infrastructure matters for E-claims

Healthcare financing involves high transaction value, multiple independent organisations, and strong regulatory oversight. A general-purpose public blockchain may expose data or carry unpredictable cost. A private database offers control but not independent verification. ADI Layer 3 with zero-knowledge rollups offers a middle path: dedicated chain capacity for SHA programmes, cryptographic proof of correct execution, settlement to established Layer 1 security, and the ability to keep clinical and personal data off the ledger while still proving claim integrity.


Whitepaper excerpt

The Social Health Authority E-claims programme connects providers, payers, financial operations, and payment settlement in a national claims ecosystem. Provider platforms maintain facility records and Facility Identifier details and submit pre-authorizations and claims. Payers adjudicates those requests. IFS serves as the financial system of record for patients, providers, benefits, invoices, and payment instructions. The Payment Gateway executes settlement and returns payment status.

E-claims does not duplicate this master data on a blockchain. Instead, it introduces a thin trust layer on Spearhead, an ADI Layer 3 zero-knowledge rollup chain. Spearhead settles to the ADI Chain at Layer 2 and inherits security from Ethereum at Layer 1. On this infrastructure, E-claims records immutable anchors at each critical handoff: when a provider submits a claim, when payers reaches a decision, and when payment is executed. Provider authorisation, claim integrity, and settlement proof are verifiable by all parties without exposing personal health information on the ledger.

Smart contracts on Spearhead include ClaimRegistry for claim anchoring and ProviderRegistry for authorised facilities. The architecture preserves the authority of each existing system while giving the programme a shared, tamper-evident audit trail from submission to payment. The outcome is faster reconciliation, stronger fraud controls, greater regulatory confidence, and a foundation for transparent, accountable healthcare financing under the Social Health Authority on proof-backed institutional blockchain infrastructure.




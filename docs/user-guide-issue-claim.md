This guide explains how to **submit a new claim** in the E-claims portal using the **Issue Claim** screen in the left menu.

---

## Before you start

You will need:

- Access to the E-claims web application (https://eclaim.apeiro-digital.com/).  
- A **crypto wallet** connected to the browser (typically **MetaMask**).  
- The wallet set to the **Spearhead** network (chain ID **99991**).  
- A small amount of **native token** on Spearhead to pay the network fee for one submission.  

You may require the wallet to be an **authorised** account.

**RPC, contract address, and MetaMask setup:** [Network & contract reference](./network-and-contract-reference.md).

---

## Open Issue Claim

1. Sign in to the portal (if your deployment uses login).  
2. In the left sidebar, click **Issue Claim**.  
3. Connect your wallet when prompted (top of the page or browser extension).

---

## Fill in the form

| Field | Required? | What to enter |
|-------|-------------|----------------|
| **Claim Type** | Yes | Choose from the list (e.g. Surgical Claim, Approved Claim, Sent Back Claim, etc.). |
| **Provider Name** | No | Name of the healthcare provider or facility. |
| **Patient Name** | No | Name of the patient (as used in your process). |
| **Claimed Total** | Yes | The amount being claimed (enter numbers only, as your process defines). |
| **Date From** | Yes | Start date of the service period. |
| **Date To** | Yes | End date of the service period. |

**You do not enter** Claim ID, SHA Code, or Claim Number yourself. The system creates these automatically when you submit.

---

## Submit the claim

1. Check all required fields are filled.  
2. Click **Submit Claim**.  
3. Your wallet will open (e.g. MetaMask) asking you to **confirm** the transaction.  
4. Wait until the button stops showing “Confirm in MetaMask…” and a success message appears.

---

## After a successful submission

Save the details shown on screen. You will need them for search and audit:

| Reference | What it is |
|-----------|------------|
| **Claim Number** | A numeric reference (based on submission time). Use this on the **Claims** list or when searching by number. |
| **Claim ID** | A long unique ID (UUID format). **Best option for Search Claim.** |
| **SHA Code** | A short code starting with `SHA` (e.g. `SHA1974578B`). Shown in the list view. |
| **Tx (transaction hash)** | Proof of the on-chain registration. Keep for audit if your process requires it. |

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| **“Please fill in all required fields”** | Select claim type, claimed total, and both dates. |
| **MetaMask: network fee unavailable** | Switch to Spearhead (99991), check RPC settings, ensure you have native token for gas. Try again or ask IT. |
| **Transaction rejected** | Wallet may not be allowed to submit; wrong network; or contract configuration. Contact administrator. |
| **Success but claim not in list** | Wait a minute and refresh **Claims**. Confirm you are on the same environment (demo vs production). |
| **Cannot find claim in search** | Use the full **Claim ID** from the success box, not only the claim number, unless your admin confirms number search is enabled. |

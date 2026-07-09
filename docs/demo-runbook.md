# Demo runbook

Step-by-step to **try E-claims end-to-end**: wallet on Spearhead, issue a claim, confirm listing/search against your API.

---

## Portal users (hosted demo)

If you only need to **use** the live portal (no local install):

1. Open the URL your team provides (e.g. production or UAT).  
2. Connect **MetaMask** on **Spearhead** (chain ID **99991**) with a funded test wallet.  
3. Follow the user guides:
   - [Issue a claim](./user-guide-issue-claim.md)  
   - [Search & list claims](./user-guide-search.md)  
4. After issuing a claim, copy the **Claim ID** and **Claim Number** from the success message before searching.

For wallet and network help, see [Spearhead L3 overview](./spearhead-l3-overview.md).

---

## Technical setup (developers & operators)

The sections below are for running the stack locally or aligning contract addresses and API configuration.

## Prerequisites

- **Node.js** and **npm** (or **yarn**) for backend and frontend  
- **MetaMask** (or another injected wallet supported by Wagmi)  
- **Spearhead native token** on the demo account for gas (see [Spearhead L3 overview](./spearhead-l3-overview.md))  
- **ClaimRegistry** deployed to Spearhead; note the **contract address** and **deployer / owner** address  

## 1. Align contract address (critical)

The UI and API must point at the **same** ClaimRegistry deployment.

- **Frontend:** `eclaim-frontend/lib/contracts.ts` → `CONTRACT_ADDRESS`  
- **Backend:** `eclaim-backend/src/eclaim-contract/eclaim-contract.service.ts` → `CONTRACT_ADDRESS`  

Update both to your deployed address, commit or configure as your process requires, then rebuild.

## 2. Configure the backend

From `eclaim-backend/`:

1. Copy env from your team template (port, DB if required by `AppModule`, etc.).  
2. For eclaim reads/writes, set at minimum:  
   - **`OWNER_ADDRESS`** — must match on-chain **`owner()`** if `getClaim` is `onlyOwner`.  
   - **`OWNER_PRIVATE_KEY`** — only if you demo **POST** `.../:claimNumber/status` from the server (owner key; keep secret).  

3. Install and run:

```bash
cd eclaim-backend
npm install
npm run start:dev
```

Default port is whatever your `app.port` config uses (often **8001** in local setups—confirm in env).

## 3. Configure the frontend

From `eclaim-frontend/`:

1. Set **`NEXT_PUBLIC_BACKEND_URL`** to your API base **without** trailing slash, e.g. `http://localhost:8001` or your deployed `https://eclaim-api.example.com`.  
2. Optional: **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** for WalletConnect (otherwise injected wallet is enough for a local demo).  

```bash
cd eclaim-frontend
npm install
npm run dev
```

Open the printed local URL (commonly `http://localhost:3000`).

## 4. Wallet: Spearhead + funds

1. In MetaMask, add / select **Spearhead** (chain ID **99991**, RPC from [Spearhead L3 overview](./spearhead-l3-overview.md)).  
2. Ensure the **Issue claim** account has enough **native balance** for one contract write.  
3. Connect the site to that wallet on Spearhead.

## 5. Happy path: Issue claim

1. Open **Issue claim** in the app sidebar.  
2. Fill required fields (claim type, dates, claimed total, etc.).  
3. Submit → **Confirm** in MetaMask (`upsertClaim`).  
4. Wait for success: note **Claim number**, **Claim ID (UUID)**, **SHA code**, and **tx hash**.  
5. Confirm the browser called **`POST /api/public/eclaim-contract/meta`** (optional in Network tab); if it failed, listing/search may still work for on-chain fields but **human-readable** meta may be missing until fixed.

## 6. Verify listing and search

1. **Claims / All claims** — should show the new row (may show **status** as `unknown` until status is updated on-chain—see [E-claims project overview](./eclaims-project-overview.md)).  
2. **Search claim** — use the **full UUID** as Claim ID (recommended), or the numeric **claim number** if your backend contract + `OWNER_ADDRESS` are aligned.  
3. If search returns **404** with `No claim found for claimId ...`, see alignment in [E-claims project overview](./eclaims-project-overview.md) (wrong contract, wrong owner for static calls, or typo in ID).

## 7. Optional: change status (owner)

If your contract exposes **`setClaimStatus`** as owner-only:

```bash
curl -X POST "$API/api/public/eclaim-contract/$CLAIM_NUMBER/status" \
  -H "Content-Type: application/json" \
  -d '{"status":1}'
```

Use the numeric **enum** your contract expects (e.g. `1` for approved in the current `STATUS_MAP`—confirm against `ClaimRegistry.sol`). The server must sign with **`OWNER_PRIVATE_KEY`** matching **`owner()`**.

## 8. Deployed demo (no local API)

Point **`NEXT_PUBLIC_BACKEND_URL`** at your hosted API (e.g. `https://eclaim-api.apeiro-digital.com`). Ensure that deployment’s **`CONTRACT_ADDRESS`** and **`OWNER_ADDRESS`** match the same Spearhead deployment your users use in MetaMask.

## Troubleshooting (short)

| Symptom | Check |
|--------|--------|
| MetaMask fee **Unavailable** | RPC, network ID, explicit gas in issue page; native balance |
| **Transaction reverted** | ABI/struct match deployment; caller allowed to `upsertClaim` per contract |
| Search **404** / not found | Same contract as issue; UUID vs number; `OWNER_ADDRESS` for owner-gated `getClaim` |
| List shows **unknown** status | New claims often start at enum **0**; update status or relabel in API |

---

*Update this runbook when default ports, env names, or hosted URLs change.*

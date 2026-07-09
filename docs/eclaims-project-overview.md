# E-claims project overview

**E-claims** is a small **Web3 + API** stack: users **write claim records on-chain** (hashed fields + numbers), while the **backend** enriches and lists data via RPC and optional **off-chain metadata** for display.

## Repository layout

| Area | Path | Role |
|------|------|------|
| **Smart contracts** | `deploy-contracts/` | Hardhat project: `ClaimRegistry.sol`, deploy scripts |
| **Backend API** | `eclaim-backend/` | NestJS: public REST under `/api/public/eclaim-contract/*` |
| **Frontend** | `eclaim-frontend/` | Next.js + Wagmi: Spearhead, issue claim, search, listings |

Other folders (e.g. `deploy-contracts/`, DTPS-related backend code) may exist for separate features; the **eclaim-contract** module is the core of this documentation.

## ClaimRegistry (on-chain)

- **Contract:** `ClaimRegistry` stores **claims** (and optionally **patients** in the full Solidity layout).  
- **Writes used by the demo UI:** `upsertClaim` — submitted from the **browser wallet** (MetaMask), not from the Nest server.  
- **Reads:** `getClaim(claimNumber)` and related views; some methods may be **`onlyOwner`** depending on the deployed version—then the backend simulates calls `from` the **owner address** (see backend service).  
- **Events:** `ClaimUpserted` is used to resolve **claim UUID → claim number** and to build **“all claims”** lists.

Bytecode and full ABI live under **`deploy-contracts/artifacts/`** after `hardhat compile`. The backend ships a **trimmed ABI** in `eclaim-backend/src/eclaim-contract/CLAIM_REGISTRY.json`.

## Frontend (high level)

- **Network:** Spearhead (`99991`), RPC as in [Spearhead L3 overview](./spearhead-l3-overview.md).  
- **Contract address:** `CONTRACT_ADDRESS` in `eclaim-frontend/lib/contracts.ts` — **must match** the deployment you use.  
- **Issue claim:** Builds a struct, hashes strings with **viem** (`keccak256` + UTF-8 bytes, aligned with `ethers` on the backend), calls **`upsertClaim`**, then **POSTs** plaintext metadata to the API (`/meta`) for search/list UX.  
- **Search / list:** Calls the **backend** JSON API, not the contract directly for those flows.

## Backend (high level)

- **Global prefix:** `/api`  
- **Controller base:** `/public/eclaim-contract`  
- **Important env / constants (see `eclaim-contract.service.ts`):**  
  - **`CONTRACT_ADDRESS`** — ClaimRegistry on Spearhead  
  - **`OWNER_ADDRESS`** — used as `from` on **static** `getClaim` when the contract enforces **`onlyOwner`** on reads  
  - **`OWNER_PRIVATE_KEY`** — only for **owner** transactions such as **`setClaimStatus`** (optional if you do not use that endpoint)  
- **Metadata file:** `claim-meta.json` (next to process CWD) caches **human-readable** fields keyed by `claimNumber` after a successful issue + `/meta` POST.

### Main HTTP endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/public/eclaim-contract` | Paginated list (events + `getClaim` per row) |
| `POST` | `/api/public/eclaim-contract/meta` | Store display metadata after on-chain issue |
| `POST` | `/api/public/eclaim-contract/search` | Resolve **claimId** (UUID) or numeric **claimNumber** and return merged claim |
| `POST` | `/api/public/eclaim-contract/check-duplicate` | Whether a **claimId** appears on-chain |
| `GET` | `/api/public/eclaim-contract/:claimNumber` | Single claim by number |
| `POST` | `/api/public/eclaim-contract/:claimNumber/status` | Owner-only status update on-chain |

## End-to-end data flow (issue claim)

1. User fills the form and confirms **MetaMask** → **`upsertClaim`** on **ClaimRegistry**.  
2. On success, the browser **POSTs** `/api/public/eclaim-contract/meta` with UUID, names, SHA code, amounts, etc.  
3. List and search APIs read the **chain** plus **meta** where available.  
4. **Status** on new claims is typically enum value **0** (`UNKNOWN`) until an owner calls **`setClaimStatus`** (mapped to labels like `unknown`, `approved`, … in the API).

## Alignment checklist (common production issues)

- **Same `CONTRACT_ADDRESS`** in frontend and backend as the deployment users hit.  
- **`OWNER_ADDRESS`** equals **`owner()`** on that contract if reads are owner-gated.  
- **Swagger:** `GET /api` on the deployed API to confirm routes exist after deploy.

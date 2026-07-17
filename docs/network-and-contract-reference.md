# Network & contract reference

Quick reference for **Spearhead**, **ADI**, **Apeiro**, RPC, and contracts used by E-claims. Use this page when connecting a wallet, verifying transactions, or sharing links with auditors and partners.

App switch: `CHAIN_NETWORK` / `NEXT_PUBLIC_CHAIN_NETWORK` = `spearhead` | `adi` | `apeiro`.

---

## Supported networks

| Key | Name | Chain ID | RPC | Explorer |
|-----|------|----------|-----|----------|
| `spearhead` | Spearhead L3 | `99991` | https://rpc.spearhead.adifoundation.ai | https://explorer.spearhead.adifoundation.ai |
| `adi` | ADI Network | `36900` | https://rpc.adifoundation.ai | https://explorer.adifoundation.ai |
| `apeiro` | Apeiro Network | `37001` | https://rpc.apeiro.adifoundation.ai | https://explorer.apeiro.adifoundation.ai |

**Apeiro extras:** BLS explorer https://explorer-bls.apeiro.adifoundation.ai · Bridge https://bridge.apeiro.adifoundation.ai

**Portal (demo):** `https://eclaim.apeiro-digital.com/`

**Server env paste files:** `deploy-contracts/SERVER-ENV-ADI.txt`, `deploy-contracts/SERVER-ENV-APEIRO.txt`

**ADI L3 background:** [L3 Chains — ADI Network Components](https://docs.adi.foundation/adi-network-components/overview-1)

---

## Apeiro Network (current fresh deploy — 2026-07-17)

| Setting | Value |
|---------|--------|
| **Network name** | Apeiro Network |
| **Chain ID** | `37001` |
| **RPC URL** | `https://rpc.apeiro.adifoundation.ai` |
| **Explorer** | https://explorer.apeiro.adifoundation.ai |
| **Owner / deployer** | `0xCb01D9DEc076837eF915E0ffd8d9182264FC5FAE` |

| Contract | Address |
|----------|---------|
| **ClaimRegistry** | `0xA8eFbf955496518D6e3Cb10ABC90627671534088` |
| **ProviderRegistry** | `0xeda747a951502878079a789DA5D3380dA6Ec2276` |
| **CitizenRegistry** | `0xb859A8D8e23D8581aafb5e7C03A8CC2F854a9Cc4` |
| **ClinicianRegistry** | `0xd646829b3310a17B660079acc7F4A97DBFC9ce2D` |
| **InsurerRegistry** | `0x64e8Ffca1907B0769Bf02cB60DC62D0e1070a591` |

Full JSON: `deploy-contracts/deployed-apeiro.json` · Server paste: `deploy-contracts/SERVER-ENV-APEIRO.txt`

**Deploy:** `cd deploy-contracts && npm run deploy:all:apeiro`

**Seed demo IDs after deploy:**
```bash
curl -X POST http://localhost:8001/api/public/integration/seed-demo-registries
```

---

## Spearhead network (E-claims)

| Setting | Value |
|---------|--------|
| **Network name** | Spearhead Testnet |
| **Chain ID** | `99991` |
| **RPC URL (HTTPS)** | `https://rpc.spearhead.adifoundation.ai` |
| **Native currency** | ADI (app metadata); wallets may show **SPR** or another symbol depending on how the network was added |
| **Decimals** | `18` |

---

## ProviderRegistry contract

| Item | Value |
|------|--------|
| **Contract name** | `ProviderRegistry` |
| **Address** | `0xeda747a951502878079a789DA5D3380dA6Ec2276` |
| **Network** | Spearhead (chain ID `99991`) |
| **Deploy tx** | `0xbe30b832e0c72053b4b872e467f9b50b1c07579a3e5900ff0e975ba221cf34e6` |

```
https://explorer.spearhead.adifoundation.ai/address/0xeda747a951502878079a789DA5D3380dA6Ec2276
```

**Deploy:** `cd deploy-contracts && npm run deploy:provider-registry:spearhead`

---

## Verifiable registries (citizen, clinician, insurer)

Hash-only `VerifiableRegistry` contracts — no PHI on-chain.

| Registry | Address |
|----------|---------|
| **CitizenRegistry** | `0xd646829b3310a17B660079acc7F4A97DBFC9ce2D` |
| **ClinicianRegistry** | `0x64e8Ffca1907B0769Bf02cB60DC62D0e1070a591` |
| **InsurerRegistry** | `0xe8729132b31c0e1E7683360A4781A3307fb52163` |

**Deploy all three:** `cd deploy-contracts && npm run deploy:verifiable-registries:spearhead`

---

## ClaimRegistry contract

| Item | Value |
|------|--------|
| **Contract name** | `ClaimRegistry` |
| **Address** | `0xA8eFbf955496518D6e3Cb10ABC90627671534088` |
| **Owner** | `0xE8d5A99D3A879C6c9b8A371279b9Da5220C3c362` |
| **Deploy tx** | `0x6bab04c02e1ffb9fd3e0ebc245152bd1e46718cdabfebbb73c022d219a86d4e9` |
| **Previous addresses** | `0xaeF552…` (superseded), `0x2EEa…` (legacy) |
| **Network** | Spearhead (chain ID `99991`) |

### Contract link (block explorer)

Open the contract on your environment’s **block explorer** and bookmark it for audits:

```
https://explorer.spearhead.adifoundation.ai/address/0xA8eFbf955496518D6e3Cb10ABC90627671534088
```
---

## How to connect MetaMask to Spearhead

1. Install [MetaMask](https://metamask.io/) (browser extension or mobile).  
2. Open **MetaMask → Settings → Networks → Add network** (or **Add a network manually**).  
3. Enter:

| Field | Value |
|-------|--------|
| **Network name** | Spearhead Testnet |
| **RPC URL** | `https://rpc.spearhead.adifoundation.ai` |
| **Chain ID** | `99991` |
| **Currency symbol** | ADI or SPR (use what your org documents) |
| **Block explorer URL** | https://explorer.spearhead.adifoundation.ai/ |

4. **Save** and **switch** to Spearhead before using **Issue claim** on the portal.  
5. Ensure the account has **native token** for gas (small balance for one or more transactions).

### Connect wallet to the E-claims portal

1. Open the E-claims site (e.g. `https://eclaim.apeiro-digital.com/`).  
2. Click **Connect wallet** (or approve the connection prompt).  
3. In MetaMask, select the **Spearhead** network if prompted.  
4. Confirm the connected account is the one your organisation authorised for submissions.

---
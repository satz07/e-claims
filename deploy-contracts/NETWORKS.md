# Network selection for Hardhat deploys

## Networks

| Key | Name | Chain ID | RPC | Explorer |
|-----|------|----------|-----|----------|
| `spearhead` | Spearhead L3 | 99991 | https://rpc.spearhead.adifoundation.ai | https://explorer.spearhead.adifoundation.ai |
| `adi` | ADI Network (mainnet) | 36900 | https://rpc.adifoundation.ai | https://explorer.adifoundation.ai |

Aliases for ADI mainnet: `mainnet`, `adi-mainnet`.

## Setup

```bash
cp .env.example .env
# set PRIVATE_KEY=...
```

## Deploy

```bash
# Spearhead
npm run deploy:claim-registry:spearhead
npm run deploy:provider-registry:spearhead
npm run deploy:verifiable-registries:spearhead
# or all:
npm run deploy:all:spearhead

# ADI Network mainnet
npm run deploy:claim-registry:adi
npm run deploy:provider-registry:adi
npm run deploy:verifiable-registries:adi
# or all:
npm run deploy:all:adi
```

## Gas / cost logs

Every deploy and ownership transfer appends:

- `logs/deployments-YYYY-MM-DD.log` — human-readable (gas used, gwei, ADI fee, explorer link)
- `logs/deployments-YYYY-MM-DD.jsonl` — one JSON object per event (for cost analysis)

App-side txs (backend owner wallet) write to `eclaim-backend/logs/chain-tx-YYYY-MM-DD.*`.

## App env after deploy

**Backend** (`eclaim-backend/.env`):
```
CHAIN_NETWORK=spearhead   # or adi
CLAIM_REGISTRY_ADDRESS=0x...
PROVIDER_REGISTRY_ADDRESS=0x...
CITIZEN_REGISTRY_ADDRESS=0x...
CLINICIAN_REGISTRY_ADDRESS=0x...
INSURER_REGISTRY_ADDRESS=0x...
OWNER_PRIVATE_KEY=...
```

**Frontend** (`eclaim-frontend/.env.local`):
```
NEXT_PUBLIC_CHAIN_NETWORK=spearhead   # or adi
NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CONTRACT_OWNER_ADDRESS=0x...
NEXT_PUBLIC_BACKEND_URL=https://eclaim-api.apeiro-digital.com
```

Rebuild the frontend after changing `NEXT_PUBLIC_*` vars.

# Network selection for Hardhat deploys

## Networks

| Key | Name | Chain ID | RPC | Explorer |
|-----|------|----------|-----|----------|
| `spearhead` | Spearhead L3 | 99991 | https://rpc.spearhead.adifoundation.ai | https://explorer.spearhead.adifoundation.ai |
| `adi` | ADI Network | 36900 | https://rpc.adifoundation.ai | https://explorer.adifoundation.ai |
| `apeiro` | Apeiro Network | 37001 | https://rpc.apeiro.adifoundation.ai | https://explorer.apeiro.adifoundation.ai |

Aliases: `mainnet`/`adi-mainnet` → adi; `apeiro-network` → apeiro.

## Setup

```bash
cp .env.example .env
# set PRIVATE_KEY=...
```

## Deploy

```bash
# Spearhead
npm run deploy:all:spearhead

# ADI Network
npm run deploy:all:adi

# Apeiro Network
npm run deploy:all:apeiro
```

## Gas / cost logs

Every deploy appends:

- `logs/deployments-YYYY-MM-DD.log`
- `logs/deployments-YYYY-MM-DD.jsonl`

Backend app txs: `eclaim-backend/logs/chain-tx-YYYY-MM-DD.*`

## App env after deploy

**Backend** (`eclaim-backend/.env`):
```
CHAIN_NETWORK=apeiro   # or spearhead | adi
CLAIM_REGISTRY_ADDRESS=0x...
PROVIDER_REGISTRY_ADDRESS=0x...
CITIZEN_REGISTRY_ADDRESS=0x...
CLINICIAN_REGISTRY_ADDRESS=0x...
INSURER_REGISTRY_ADDRESS=0x...
OWNER_PRIVATE_KEY=...
```

**Frontend** (`eclaim-frontend/.env.local`):
```
NEXT_PUBLIC_CHAIN_NETWORK=apeiro
NEXT_PUBLIC_CLAIM_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CONTRACT_OWNER_ADDRESS=0x...
NEXT_PUBLIC_BACKEND_URL=https://eclaim-api.apeiro-digital.com
```

Rebuild the frontend after changing `NEXT_PUBLIC_*` vars.

## Seed registries (after deploy)

```bash
curl -X POST http://localhost:8001/api/public/integration/seed-demo-registries
# or production:
curl -X POST https://eclaim-api.apeiro-digital.com/api/public/integration/seed-demo-registries
```

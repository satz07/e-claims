# E-Claims Operations Dashboard

Live dashboard (similar to the [Apeiro Operations Dashboard](https://apeiro-operations-dashboard.ma0101461427.chatgpt.site/)) showing:

- **L3** block height, total transactions (matches [Apeiro Explorer](https://explorer.apeiro.adifoundation.ai/))
- **L2** ADI Mainnet settlement stats
- **E-Claims** claim anchors, registry health, DB import workers
- **Operators** commit/prove/execute wallet balances

## Run locally

```bash
cd eclaim-backend
node operations-dashboard/server.mjs
# Open http://localhost:8090
```

## Run on server (pm2)

```bash
cd /home/ubuntu/e-claims/eclaim-backend
git pull

pm2 start operations-dashboard/server.mjs --name eclaims-ops-dashboard
pm2 save
```

Optional env in `.env`:

```env
OPS_DASHBOARD_PORT=8090
OPS_DASHBOARD_CACHE_MS=60000
```

## Public URL (nginx)

```nginx
server {
    listen 80;
    server_name ops.apeiro-digital.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Or under existing API domain:

```nginx
location /operations/ {
    proxy_pass http://127.0.0.1:8090/;
}
```

Then open: `https://eclaim-api.apeiro-digital.com/operations/`

## API

```bash
curl http://localhost:8090/api/snapshot | jq .
```

Refresh interval: **60 seconds** (server-side cache).

## Transaction counts

The main [explorer.apeiro.adifoundation.ai](https://explorer.apeiro.adifoundation.ai/) UI does not expose a public JSON API. This dashboard uses the **BLS Blockscout API** (`explorer-bls.apeiro.adifoundation.ai`) which indexes the same Apeiro chain.

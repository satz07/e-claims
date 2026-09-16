# E-claims — local git setup

## Already cloned?

```bash
cd /Users/satheesh/go/src/gc/e-claims
git status
git remote -v
git branch
```

Expect remote: `https://github.com/satz07/e-claims.git`

## Fresh clone

```bash
mkdir -p /Users/satheesh/go/src/gc
cd /Users/satheesh/go/src/gc
git clone https://github.com/satz07/e-claims.git
cd e-claims
git checkout main   # or your working branch
git pull
```

## Useful commands

```bash
git pull
git status
git diff
git checkout -b feature/your-change
git push -u origin HEAD
```

## Do not commit

* `eclaim-backend/.env` (RPC, DB, private keys, API keys)
* Wallet private keys / operator secrets
* Large `logs/` seed dumps unless intentionally shared
* `node_modules/`

## Open in Cursor

File → Open Folder → `/Users/satheesh/go/src/gc/e-claims`

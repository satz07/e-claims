# Seed workers A→Z (sequential)

Maintain status in `eclaim-backend/scripts/seed-worker-queue.json`.  
Monitor (`check-seed-workers.mjs`) auto-advances when a range completes.

| Worker | From | To | Status |
|--------|------|-----|--------|
| A | 322719 | 340777 | done |
| B | 340778 | 358836 | done |
| C | 358837 | 376895 | skipped |
| D | 376896 | 394954 | done |
| E | 394955 | 413013 | done |
| F | 413014 | 431072 | **next** |
| G | 431073 | 449131 | pending |
| H | 449132 | 467190 | pending |
| I | 467191 | 485249 | pending |
| J | 485250 | 503308 | pending |
| K | 503309 | 521367 | pending |
| L | 521368 | 539426 | pending |
| M | 539427 | 557485 | pending |
| N | 557486 | 575544 | pending |
| O | 575545 | 593603 | pending |
| P | 593604 | 611662 | pending |
| Q | 611663 | 629721 | pending |
| R | 629722 | 647780 | pending |
| S | 647781 | 665839 | pending |
| T | 665840 | 683898 | pending |
| U | 683899 | 701957 | pending |
| V | 701958 | 720016 | pending |
| W | 720017 | 738075 | pending |
| X | 738076 | 756134 | pending |
| Y | 756135 | 774193 | pending |
| Z | 774194 | 792236 | pending |

## Why emails said “stopped” after topping up balance

Worker **E finished** its range (`cursor #413013 ≥ 413013`).  
`.env` still had `SEED_RESTART_WORKER=E`, so the monitor tried to restart E, saw “range already complete”, and never started **F**.

## Manual start (one worker)

```bash
cd ~/e-claims/eclaim-backend
node scripts/seed-from-db.mjs --worker F --from 413014 --to 431072 --limit 20000 --no-wait --skip-ensure-registries
```

## Force monitor recovery (uses queue)

```bash
cd ~/e-claims/eclaim-backend
node scripts/check-seed-workers.mjs --restart --force
```

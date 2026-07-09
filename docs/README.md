
For the **full platform README** (short technical index), see the repository root **[`README.md`](../README.md)**.

For **business and non-technical readers**, start with **[Business overview](./business-overview.md)**.

Welcome. This space describes **Spearhead** (the network the app targets), the **E-claims** stack (on-chain registry + web app + API), and how to **run or follow a demo**.

## Who this is for

- Developers integrating or deploying E-claims  
- Reviewers who need an end-to-end picture before trying the demo  
# E-claims documentation

## How to use with GitBook (GitHub Sync)

GitBook connects to **GitHub** with the **GitHub Sync** integration (under **Integrations → Categories → Git sync**). Use it to publish the Markdown in this repo’s **`docs/`** folder as a live space.

### One-time setup

1. **Push the `docs/` folder to GitHub**  
   Commit and push this repository (including `docs/README.md`, `docs/SUMMARY.md`, and the other `.md` files) to a branch you want to sync (usually `main` or `master`).

2. **Open your GitBook space**  
   e.g. **Space** → pick the space where you want this handbook (for example **Netgroup Docs → Docs**).

3. **Open the integration**  
   - Left sidebar: **Integrations** (or space settings, depending on your GitBook layout).  
   - Under **Categories**, open **Git sync**.  
   - Find **GitHub Sync** — if it is not installed, click **Install** and approve access for the GitHub account or organization that owns the repo.

4. **Configure the link to this repo**  
   - Click **Edit configuration** (shown when GitHub Sync is already installed).  
   - **Repository:** choose the GitHub repo that contains this monorepo (e.g. `your-org/e-claims`).  
   - **Branch:** select the branch you push docs to (e.g. `main`).  
   - **Content directory / root path:** set to **`docs`** so GitBook treats `docs/README.md` as the space root and reads **`docs/SUMMARY.md`** for the sidebar.  
     - If you leave the root as the repo root instead, you would need to move or duplicate `SUMMARY.md` — keeping **`docs`** as the content root matches this repo layout.

5. **Save / sync**  
   Finish the wizard and run the first **import** or **sync** so GitBook pulls files from GitHub. After that, behavior depends on **sync direction** (often bi-directional: GitBook edits can commit to GitHub, and new commits update the book).

### Ongoing workflow

- **Docs in Git:** change Markdown under **`docs/`**, merge to the linked branch; GitBook updates on the next sync (turn on **auto-sync** in the integration if you want that automatic).  
- **Docs in GitBook:** edit in the GitBook UI; with bi-directional sync, changes can be written back to the branch—resolve conflicts in GitHub if the same file changes on both sides.

### From GitHub → GitBook (push updates to the site)

You do **not** push “to GitBook” from the `git` CLI. You **push to GitHub**; GitBook **pulls** from GitHub when sync runs.

1. **Edit and commit locally** under `docs/` (or on GitHub’s web editor).  
2. **Push to the same branch** wired in GitHub Sync (e.g. `main`):

   ```bash
   git add docs/
   git commit -m "docs: update handbook"
   git push origin main
   ```9

3. **Let GitBook ingest the commit**  
   - If **auto-sync** is on for that space, GitBook will refresh after a short delay.  
   - If not: open the space → **Integrations** → **Git sync** → **GitHub Sync** → **Edit configuration** or the space’s **Git / Sync** area (wording varies) and use **Sync**, **Pull from Git**, or **Update from Git** so the latest commit is imported.

Until step 3 completes, the published book still shows the previous revision.

### If something does not show up

| Check | Action |
|--------|--------|
| Empty space | Confirm **content directory** is **`docs`** and that the linked branch contains `docs/SUMMARY.md`. |
| No sidebar | `SUMMARY.md` must sit in the **same** folder GitBook uses as root (here: **`docs/`**). |
| Permission / 404 from GitHub | In **Edit configuration**, ensure the **GitBook** GitHub App is installed on the **organization** that owns the repo, with access to that repository. |

Use your real GitHub path instead of `your-org/e-claims`.

## Contents

### For users

| Chapter | Description |
|--------|-------------|
| [Demo runbook](./demo-runbook.md) | Hosted demo + technical setup |
| [Issue a claim](./user-guide-issue-claim.md) | Submit a claim step by step |
| [Search & list claims](./user-guide-search.md) | List, search, duplicate check |

### Platform

| Chapter | Description |
|--------|-------------|
| [Network & contract reference](./network-and-contract-reference.md) | RPC, chain ID, contract address, explorer link, MetaMask |
| [Spearhead L3 overview](./spearhead-l3-overview.md) | Network role, chain parameters, RPC |
| [E-claims project overview](./eclaims-project-overview.md) | Architecture, contracts, API, data flow |

If anything drifts from the code (URLs, addresses), treat the repository as the source of truth and update these pages when you change config.

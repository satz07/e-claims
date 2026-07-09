# Spearhead L3 overview

This section explains how **Spearhead** fits into the E-claims story at a high level. Details below match the **chain configuration in this repository** (`eclaim-frontend` Wagmi / viem setup).

## What Spearhead is (in this project)

**Spearhead** is the **EVM network** used to deploy and interact with the **ClaimRegistry** smart contract. The frontend labels it **“Spearhead Testnet”** and uses it for wallet transactions (e.g. issuing a claim on-chain).

In documentation you may see it described as an **L3** in product or ecosystem terms. Operationally, what matters for E-claims is: **chain ID**, **RPC URL**, and **native gas token**—same as any EVM chain.

## Parameters (from app config)

See **[Network & contract reference](./network-and-contract-reference.md)** for the full table: **chain ID**, **RPC URL**, **contract address**, **block explorer link**, and **MetaMask step-by-step**.

| Item | Value |
|------|--------|
| **Chain ID** | `99991` |
| **Human-readable name** | Spearhead Testnet |
| **Public RPC (HTTP)** | `https://rpc.spearhead.adifoundation.ai` |
| **Native currency (app metadata)** | Name: ADI, symbol: **ADI**, decimals: `18` |

Wallets may show a different **ticker** (e.g. SPR) depending on how the network was added manually; gas is still paid in that chain’s native token.

## Adding Spearhead in MetaMask (manual network)

Full connection steps: **[Network & contract reference → How to connect MetaMask](./network-and-contract-reference.md#how-to-connect-metamask-to-spearhead)**.

## Gas and transactions

The frontend can attach **explicit EIP-1559-style fee caps** for Spearhead (see `SPEARHEAD_GAS_OVERRIDES` in `eclaim-frontend/components/providers/web3-provider.tsx`) to reduce MetaMask “fee unavailable” issues when RPC estimation is flaky.

You still need a **non-zero native balance** on Spearhead to pay gas for writes (e.g. `upsertClaim`).

## Further reading (outside this repo)

- Official Spearhead / ADI Foundation RPC and branding may evolve; confirm **chain ID** and **RPC** against current operator docs if production values differ from this repo.

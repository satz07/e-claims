# Hardhat Simple Contract

This project contains a minimal Hardhat 3 setup with a `SimpleStorage` contract and a deployment script.

## Install

```bash
npm install
```

## Compile

```bash
npm run compile
```

## Run on Spearhead

```bash
npm run run
```

This uses the `spearhead` network from `hardhat.config.js`. Make sure `PRIVATE_KEY` is set in `.env`.

## Deploy to an in-memory Hardhat network

```bash
npm run deploy
```

## Deploy to a local Hardhat node

Start a local node in one terminal:

```bash
npm run node
```

Deploy from another terminal:

```bash
npm run deploy:localhost
```

## Deploy to Spearhead explicitly

```bash
npm run deploy:spearhead
```

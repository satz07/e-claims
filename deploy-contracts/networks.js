/**
 * Shared ADI / Spearhead network definitions for Hardhat deploys and apps.
 * Select with --network <key> or CHAIN_NETWORK / NEXT_PUBLIC_CHAIN_NETWORK.
 */
export const NETWORKS = {
  spearhead: {
    key: "spearhead",
    name: "Spearhead L3",
    shortName: "Spearhead",
    chainId: 99991,
    rpcUrl: "https://rpc.spearhead.adifoundation.ai",
    explorerUrl: "https://explorer.spearhead.adifoundation.ai",
    explorerAltUrl: null,
    currency: { name: "ADI", symbol: "ADI", decimals: 18 },
    // EIP-1559 caps that work when RPC fee estimation is flaky
    maxFeePerGasGwei: 1000,
    maxPriorityFeePerGasGwei: 100,
    protocolVersion: null,
    notes: "ADI Foundation Spearhead L3 (test / demo)",
  },
  adi: {
    key: "adi",
    name: "ADI Network",
    shortName: "ADI Mainnet",
    chainId: 36900,
    rpcUrl: "https://rpc.adifoundation.ai",
    explorerUrl: "https://explorer.adifoundation.ai",
    explorerAltUrl: "https://explorer-bls.adifoundation.ai",
    currency: { name: "ADI", symbol: "ADI", decimals: 18 },
    maxFeePerGasGwei: 100,
    maxPriorityFeePerGasGwei: 10,
    l1AdiToken: "0x8b1484d57abbe239bb280661377363b03c89caea",
    bridgehub: "0xcf1c73439c85f7eb9d4439daf398fd6392d176e6",
    assetRouter: "0x47eec6f57c7e84391ba6c9ac976537d0db0bb257",
    protocolVersion: "v0.30.1",
    sequencerVersion: "v0.13.0-b1",
    externalNodeVersion: "v0.13.0-b4",
    notes: "ADI Network mainnet",
  },
};

export function resolveNetwork(key) {
  const k = String(key || "spearhead").toLowerCase().trim();
  const aliases = {
    spearhead: "spearhead",
    "adi-testnet": "spearhead",
    testnet: "spearhead",
    adi: "adi",
    mainnet: "adi",
    "adi-mainnet": "adi",
    "adi-network": "adi",
  };
  const resolved = aliases[k] || k;
  const net = NETWORKS[resolved];
  if (!net) {
    throw new Error(
      `Unknown network "${key}". Use: ${Object.keys(NETWORKS).join(", ")}`,
    );
  }
  return net;
}

export function gweiToWei(gwei) {
  return BigInt(Math.floor(Number(gwei) * 1e9));
}

export function explorerTxUrl(network, txHash) {
  const base = (network.explorerUrl || "").replace(/\/$/, "");
  return `${base}/tx/${txHash}`;
}

export function explorerAddressUrl(network, address) {
  const base = (network.explorerUrl || "").replace(/\/$/, "");
  return `${base}/address/${address}`;
}

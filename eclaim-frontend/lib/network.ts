/**
 * Active chain for the E-claims dapp.
 * Set NEXT_PUBLIC_CHAIN_NETWORK=spearhead | adi | apeiro
 */
export type ChainNetworkKey = "spearhead" | "adi" | "apeiro"

export type ChainNetworkConfig = {
  key: ChainNetworkKey
  name: string
  shortName: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  explorerAltUrl?: string
  bridgeUrl?: string
  currency: { name: string; symbol: string; decimals: number }
  maxFeePerGasGwei: number
  maxPriorityFeePerGasGwei: number
  l1AdiToken?: string
  bridgehub?: string
  assetRouter?: string
  protocolVersion?: string
}

export const CHAIN_NETWORKS: Record<ChainNetworkKey, ChainNetworkConfig> = {
  spearhead: {
    key: "spearhead",
    name: "Spearhead L3",
    shortName: "Spearhead",
    chainId: 99991,
    rpcUrl: "https://rpc.spearhead.adifoundation.ai",
    explorerUrl: "https://explorer.spearhead.adifoundation.ai",
    currency: { name: "ADI", symbol: "ADI", decimals: 18 },
    maxFeePerGasGwei: 1000,
    maxPriorityFeePerGasGwei: 100,
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
  },
  apeiro: {
    key: "apeiro",
    name: "Apeiro Network",
    shortName: "Apeiro",
    chainId: 37001,
    rpcUrl: "https://rpc.apeiro.adifoundation.ai",
    explorerUrl: "https://explorer.apeiro.adifoundation.ai",
    explorerAltUrl: "https://explorer-bls.apeiro.adifoundation.ai",
    bridgeUrl: "https://bridge.apeiro.adifoundation.ai",
    currency: { name: "ADI", symbol: "ADI", decimals: 18 },
    maxFeePerGasGwei: 100,
    maxPriorityFeePerGasGwei: 10,
  },
}

function resolveKey(raw?: string): ChainNetworkKey {
  const k = (raw || "spearhead").toLowerCase().trim()
  if (k === "adi" || k === "mainnet" || k === "adi-mainnet" || k === "adi-network") {
    return "adi"
  }
  if (k === "apeiro" || k === "apeiro-network" || k === "apeiro-mainnet") {
    return "apeiro"
  }
  return "spearhead"
}

/** Active network from NEXT_PUBLIC_CHAIN_NETWORK (default: spearhead). */
export const ACTIVE_NETWORK_KEY = resolveKey(process.env.NEXT_PUBLIC_CHAIN_NETWORK)

const baseNetwork = CHAIN_NETWORKS[ACTIVE_NETWORK_KEY]

/** Display name: optional NEXT_PUBLIC_CHAIN_NAME, else "Chain {id}" (no branded names in UI). */
export const ACTIVE_NETWORK: ChainNetworkConfig = {
  ...baseNetwork,
  name:
    process.env.NEXT_PUBLIC_CHAIN_NAME?.trim() ||
    `Chain ${baseNetwork.chainId}`,
  shortName:
    process.env.NEXT_PUBLIC_CHAIN_SHORT_NAME?.trim() ||
    `Chain ${baseNetwork.chainId}`,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || baseNetwork.rpcUrl,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || baseNetwork.explorerUrl,
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID
    ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10)
    : baseNetwork.chainId,
}

export function explorerTxUrl(txHash: string): string {
  return `${ACTIVE_NETWORK.explorerUrl.replace(/\/$/, "")}/tx/${txHash}`
}

export function explorerAddressUrl(address: string): string {
  return `${ACTIVE_NETWORK.explorerUrl.replace(/\/$/, "")}/address/${address}`
}

export function gweiToWei(gwei: number): bigint {
  return BigInt(Math.floor(gwei * 1e9))
}

export const NETWORK_GAS_OVERRIDES = {
  maxFeePerGas: gweiToWei(ACTIVE_NETWORK.maxFeePerGasGwei),
  maxPriorityFeePerGas: gweiToWei(ACTIVE_NETWORK.maxPriorityFeePerGasGwei),
}

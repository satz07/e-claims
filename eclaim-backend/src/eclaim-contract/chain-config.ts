/**
 * Backend chain selection — spearhead | adi | apeiro
 * Set CHAIN_NETWORK=spearhead | adi | apeiro
 */
export type ChainNetworkKey = 'spearhead' | 'adi' | 'apeiro';

export interface ChainNetworkConfig {
  key: ChainNetworkKey;
  name: string;
  shortName: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  explorerAltUrl?: string;
  bridgeUrl?: string;
  currencySymbol: string;
  l1AdiToken?: string;
  bridgehub?: string;
  assetRouter?: string;
  protocolVersion?: string;
}

const NETWORKS: Record<ChainNetworkKey, ChainNetworkConfig> = {
  spearhead: {
    key: 'spearhead',
    name: 'Spearhead L3',
    shortName: 'Spearhead',
    chainId: 99991,
    rpcUrl: 'https://rpc.spearhead.adifoundation.ai',
    explorerUrl: 'https://explorer.spearhead.adifoundation.ai',
    currencySymbol: 'ADI',
  },
  adi: {
    key: 'adi',
    name: 'ADI Network',
    shortName: 'ADI Mainnet',
    chainId: 36900,
    rpcUrl: 'https://rpc.adifoundation.ai',
    explorerUrl: 'https://explorer.adifoundation.ai',
    explorerAltUrl: 'https://explorer-bls.adifoundation.ai',
    currencySymbol: 'ADI',
    l1AdiToken: '0x8b1484d57abbe239bb280661377363b03c89caea',
    bridgehub: '0xcf1c73439c85f7eb9d4439daf398fd6392d176e6',
    assetRouter: '0x47eec6f57c7e84391ba6c9ac976537d0db0bb257',
    protocolVersion: 'v0.30.1',
  },
  apeiro: {
    key: 'apeiro',
    name: 'Apeiro Network',
    shortName: 'Apeiro',
    chainId: 37001,
    rpcUrl: 'https://rpc.apeiro.adifoundation.ai',
    explorerUrl: 'https://explorer.apeiro.adifoundation.ai',
    explorerAltUrl: 'https://explorer-bls.apeiro.adifoundation.ai',
    bridgeUrl: 'https://bridge.apeiro.adifoundation.ai',
    currencySymbol: 'ADI',
  },
};

function resolveKey(raw?: string): ChainNetworkKey {
  const k = (raw || 'spearhead').toLowerCase().trim();
  if (k === 'adi' || k === 'mainnet' || k === 'adi-mainnet' || k === 'adi-network') {
    return 'adi';
  }
  if (k === 'apeiro' || k === 'apeiro-network' || k === 'apeiro-mainnet') {
    return 'apeiro';
  }
  return 'spearhead';
}

export function getActiveChain(): ChainNetworkConfig {
  const key = resolveKey(process.env.CHAIN_NETWORK);
  const base = NETWORKS[key];
  const rpcByKey: Record<ChainNetworkKey, string | undefined> = {
    spearhead: process.env.SPEARHEAD_RPC_URL,
    adi: process.env.ADI_RPC_URL,
    apeiro: process.env.APEIRO_RPC_URL,
  };
  return {
    ...base,
    rpcUrl:
      process.env.CHAIN_RPC_URL ||
      process.env.RPC_URL ||
      rpcByKey[key] ||
      base.rpcUrl,
    explorerUrl: process.env.CHAIN_EXPLORER_URL || base.explorerUrl,
    chainId: process.env.CHAIN_ID
      ? parseInt(process.env.CHAIN_ID, 10)
      : base.chainId,
  };
}

export function explorerTxUrl(txHash: string): string {
  const net = getActiveChain();
  return `${net.explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;
}

"use client"

import type React from "react"
import { WagmiProvider, createConfig, http } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors"
import { useState, useEffect } from "react"
import { createPublicClient, defineChain } from "viem"
import {
  ACTIVE_NETWORK,
  NETWORK_GAS_OVERRIDES,
} from "@/lib/network"

/** @deprecated use NETWORK_GAS_OVERRIDES — kept for existing imports */
export const SPEARHEAD_GAS_OVERRIDES = NETWORK_GAS_OVERRIDES

export const activeChain = defineChain({
  id: ACTIVE_NETWORK.chainId,
  name: ACTIVE_NETWORK.name,
  nativeCurrency: ACTIVE_NETWORK.currency,
  rpcUrls: {
    default: { http: [ACTIVE_NETWORK.rpcUrl] },
    public: { http: [ACTIVE_NETWORK.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: `${ACTIVE_NETWORK.shortName} Explorer`,
      url: ACTIVE_NETWORK.explorerUrl,
    },
  },
  fees: {
    defaultPriorityFee: () => NETWORK_GAS_OVERRIDES.maxPriorityFeePerGas,
  },
})

/** @deprecated use activeChain */
export const adiTestnet = activeChain

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(ACTIVE_NETWORK.rpcUrl),
})

function makeConfig() {
  return createConfig({
    chains: [activeChain],
    connectors: [
      injected(),
      walletConnect({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
        showQrModal: true,
      }),
      coinbaseWallet({
        appName: "Fortiquo",
      }),
    ],
    transports: {
      [activeChain.id]: http(ACTIVE_NETWORK.rpcUrl),
    },
    ssr: false,
  })
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [config] = useState(makeConfig)
  const [queryClient] = useState(() => new QueryClient())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {mounted ? children : <div className="min-h-screen" />}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

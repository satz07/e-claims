"use client"

import type React from "react"
import { WagmiProvider, createConfig, http } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors"
import { useState, useEffect } from "react"
import { createPublicClient, defineChain } from "viem"

export const SPEARHEAD_GAS_OVERRIDES = {
  maxFeePerGas: BigInt("1000000000000"), // 1000 gwei
  maxPriorityFeePerGas: BigInt("100000000000"), // 100 gwei
}

export const adiTestnet = defineChain({
  id: 99991,
  name: "Spearhead Testnet",
  nativeCurrency: {
    name: "ADI",
    symbol: "ADI",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.spearhead.adifoundation.ai"],
    },
    public: {
      http: ["https://rpc.spearhead.adifoundation.ai"],
    },
  },
  fees: {
    defaultPriorityFee: () => SPEARHEAD_GAS_OVERRIDES.maxPriorityFeePerGas,
  },
})

export const publicClient = createPublicClient({
  chain: adiTestnet,
  transport: http("https://rpc.spearhead.adifoundation.ai"),
})

function makeConfig() {
  return createConfig({
    chains: [adiTestnet],
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
      [adiTestnet.id]: http("https://rpc.spearhead.adifoundation.ai"),
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

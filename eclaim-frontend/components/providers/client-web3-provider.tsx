"use client"

import dynamic from "next/dynamic"
import type React from "react"

const Web3Provider = dynamic(
  () => import("@/components/providers/web3-provider").then((m) => ({ default: m.Web3Provider })),
  { ssr: false }
)

export function ClientWeb3Provider({ children }: { children: React.ReactNode }) {
  return <Web3Provider>{children}</Web3Provider>
}

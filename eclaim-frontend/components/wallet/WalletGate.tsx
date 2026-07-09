"use client"

import { useAccount } from "wagmi"
import { WalletRequiredModal } from "./WalletRequiredModal"

export function WalletGate({ children }: { children: React.ReactNode }) {
    const { isConnected } = useAccount()
    if (!isConnected) {
        return <WalletRequiredModal />
    }

    return <>{children}</>
}
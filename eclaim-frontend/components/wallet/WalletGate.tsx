"use client"

import { useAccount, useChainId } from "wagmi"
import { WalletRequiredModal } from "./WalletRequiredModal"
import { NetworkRequiredModal } from "./NetworkRequiredModal"
import { adiTestnet } from "../providers/web3-provider"

export function WalletGate({ children }: { children: React.ReactNode }) {
    const { isConnected } = useAccount()
    const chainId = useChainId()
    if (!isConnected) {
        return <WalletRequiredModal />
    }

    if (chainId !== adiTestnet.id) {
        return <NetworkRequiredModal />
    }

    return <>{children}</>
}
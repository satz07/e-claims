"use client"

import { useSwitchChain, useChainId } from "wagmi"
import { sepolia } from "wagmi/chains"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { adiTestnet } from "../providers/web3-provider"

export function NetworkRequiredModal() {
    const chainId = useChainId()
    const { switchChain, isPending } = useSwitchChain()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            {/* Modal box */}
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-bold">Wrong Network</h2>
                </div>

                {/* Body */}
                <p className="text-sm text-gray-600 mb-4">
                    Please switch from chain ID <b>{chainId}</b> to <b>ADI Testnet</b>.
                </p>

                {/* Action button */}
                <Button
                    className="w-full"
                    disabled={isPending}
                    onClick={() => switchChain({ chainId: adiTestnet.id })}
                >
                    {isPending ? "Switching..." : "Switch to ADI"}
                </Button>
            </div>
        </div>
    )
}

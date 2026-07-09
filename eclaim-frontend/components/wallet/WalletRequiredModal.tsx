"use client"

import { useConnect, useConnectors } from "wagmi"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

export function WalletRequiredModal() {
    const connectors = useConnectors()
    const { connect, isPending } = useConnect()

    const metaMask = connectors.find(
        (c) => c.id === "metaMask" || c.name.toLowerCase().includes("metamask")
    )

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            {/* Modal box */}
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    <h2 className="text-lg font-bold">Connect Wallet</h2>
                </div>

                {/* Body */}
                <p className="text-sm text-gray-600 mb-4">
                    You must connect MetaMask to continue.
                </p>

                {/* Action button */}
                <Button
                    className="w-full"
                    disabled={!metaMask || isPending}
                    onClick={() => metaMask && connect({ connector: metaMask })}
                >
                    {isPending ? "Connecting..." : "Connect MetaMask"}
                </Button>
            </div>
        </div>
    )
}

"use client"

import { useSwitchChain, useChainId } from "wagmi"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { activeChain } from "../providers/web3-provider"
import { ACTIVE_NETWORK } from "@/lib/network"

export function NetworkRequiredModal() {
    const chainId = useChainId()
    const { switchChain, isPending } = useSwitchChain()

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md space-y-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-bold">Wrong network</h2>
                </div>
                <p className="text-sm text-gray-600">
                    MetaMask is on chain <b>{chainId}</b>. E-claims requires{" "}
                    <b>
                      {ACTIVE_NETWORK.name} (chain ID {ACTIVE_NETWORK.chainId})
                    </b>
                    .
                </p>
                <p className="text-xs text-gray-500">
                    RPC: <code>{ACTIVE_NETWORK.rpcUrl}</code>
                    <br />
                    Set <code>NEXT_PUBLIC_CHAIN_NETWORK=spearhead</code>,{" "}
                    <code>adi</code>, or <code>apeiro</code> in the frontend env, then rebuild.
                </p>
                <Button
                    className="w-full"
                    disabled={isPending}
                    onClick={() => switchChain({ chainId: activeChain.id })}
                >
                    {isPending
                      ? "Switching…"
                      : `Switch to ${ACTIVE_NETWORK.shortName} (${ACTIVE_NETWORK.chainId})`}
                </Button>
            </div>
        </div>
    )
}

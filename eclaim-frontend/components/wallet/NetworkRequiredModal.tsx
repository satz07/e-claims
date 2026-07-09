"use client"

import { useSwitchChain, useChainId } from "wagmi"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { adiTestnet } from "../providers/web3-provider"

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
                    <b>Spearhead Testnet (chain ID 99991)</b>.
                </p>
                <p className="text-xs text-gray-500">
                    RPC: <code>https://rpc.spearhead.adifoundation.ai</code>
                    <br />
                    &quot;ADI Network&quot; in MetaMask is often a <em>different</em> chain — balance
                    shows 0 even if you have ADI on Spearhead.
                </p>
                <Button
                    className="w-full"
                    disabled={isPending}
                    onClick={() => switchChain({ chainId: adiTestnet.id })}
                >
                    {isPending ? "Switching…" : "Switch to Spearhead (99991)"}
                </Button>
            </div>
        </div>
    )
}

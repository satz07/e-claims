// app/layout.tsx
"use client"

import { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"
import { WalletButton } from "@/components/wallet-button"
import { WalletGate } from "@/components/wallet/WalletGate"

export default function IsseClaimLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="bg-white border-b border-border px-4 md:px-8 py-4 flex justify-end">
                    <WalletButton />
                </header>

                {/* Page content */}
                <main className="flex-1 px-4 md:px-8 py-6">
                    <WalletGate>
                        {children}
                    </WalletGate></main>
            </div>
        </div>
    )
}

"use client"

import { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"
import { WalletButton } from "@/components/wallet-button"

export default function SearchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-border px-4 md:px-8 py-4 flex justify-end">
          <WalletButton />
        </header>
        <main className="flex-1 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  )
}

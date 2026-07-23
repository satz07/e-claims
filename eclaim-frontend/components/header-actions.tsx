"use client"

import { WalletButton } from "@/components/wallet-button"
import { ApeiroDashboardLink } from "@/components/apeiro-dashboard-link"

/** Top-right header actions: ops dashboard + wallet. */
export function HeaderActions({ showWallet = true }: { showWallet?: boolean }) {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      <ApeiroDashboardLink />
      {showWallet ? <WalletButton /> : null}
    </div>
  )
}

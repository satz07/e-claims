"use client"

import { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function ProviderRegistryLayout({ children }: { children: ReactNode }) {
  return <AppShell showWallet={false}>{children}</AppShell>
}

"use client"

import { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function InsurerRegistryLayout({ children }: { children: ReactNode }) {
  return <AppShell showWallet={false}>{children}</AppShell>
}

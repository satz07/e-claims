"use client"

import { ReactNode } from "react"
import { AppShell } from "@/components/app-shell"

export default function SubmitLayout({ children }: { children: ReactNode }) {
  return <AppShell showWallet={false}>{children}</AppShell>
}

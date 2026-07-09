"use client"

import { ReactNode } from "react"
import { WritePageShell } from "@/components/wallet/write-page-shell"

export default function RegistryLayout({ children }: { children: ReactNode }) {
  return <WritePageShell>{children}</WritePageShell>
}

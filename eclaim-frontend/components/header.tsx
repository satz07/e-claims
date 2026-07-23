"use client"

import { HeaderActions } from "@/components/header-actions"
import { Database } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 md:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary">
              <Database className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-foreground">Fortiquo</h1>
              <p className="text-[10px] md:text-xs text-muted-foreground">Blockchain Records</p>
            </div>
          </div>
          <HeaderActions />
        </div>
      </div>
    </header>
  )
}

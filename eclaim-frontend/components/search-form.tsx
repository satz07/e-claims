"use client"

import type React from "react"
import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"

interface SearchFormProps {
  onSearch: (filters: { claimId: string }) => void
  onClear?: () => void
}

export function SearchForm({ onSearch, onClear }: SearchFormProps) {
  const [claimId, setClaimId] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (claimId.trim()) onSearch({ claimId: claimId.trim() })
  }

  return (
    <div className="bg-background">
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-2">
        FHIR Claims
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Search by Claim ID from your FHIR bundle, or browse all claims submitted via Submit FHIR.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Claim ID</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                className="pl-10 bg-background border-input"
              />
            </div>
            <Button type="submit" disabled={!claimId.trim()} className="sm:px-8">
              Search
            </Button>
            {onClear && (
              <Button type="button" variant="outline" onClick={() => { setClaimId(""); onClear() }}>
                Show all
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

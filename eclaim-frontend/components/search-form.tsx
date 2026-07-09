"use client"

import type React from "react"
import { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Input } from "./ui/input"

interface SearchFormProps {
  onSearch: (filters: any) => void
}

const STATUS_OPTIONS = {
  UNKNOWN: "Unknown",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  DECLINE: "Decline",
  SENT_BACK: "Sent Back",
  SENT_FOR_PAYMENT_PROCESSING: "Sent For Payment Processing",
  MEDICAL_REVIEW: "Medical Review",
} as const

const CLAIM_TYPE_OPTIONS = {
  SURGICAL: "Surgical Claim",
  MATERNITY: "Maternity Claim",
  APPROVED: "Approved Claim",
  SENT_BACK: "Sent Back Claim",
} as const

export function SearchForm({ onSearch }: SearchFormProps) {
  const [searchType, setSearchType] = useState("")
  const [filterValue, setFilterValue] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    onSearch({
      searchType,
      value: searchType === "claim-number" ? searchQuery : filterValue,
    })
  }

  const showSecondSelect =
    searchType === "status" || searchType === "claim-type"

  const showSearchInput = searchType === "claim-number"


  const submitForm = (type: string, value: string) => {
    onSearch({
      searchType: type,
      value,
    })
  }
  return (
    <div className="bg-background">
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6">
        All Claims
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6 w-[702px]">
        <div
          className={`grid gap-4 ${showSecondSelect
            ? "grid-cols-[161px_161px_1fr]"
            : showSearchInput
              ? "grid-cols-[161px_1fr]"
              : "grid-cols-[161px]"
            }`}
        >

          {/* Search Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Search Type</label>
            <Select
              value={searchType}
              onValueChange={(val) => {
                setSearchType(val)
                setFilterValue("")
                setSearchQuery("")
              }}
            >
              <SelectTrigger className="bg-background border-input w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="claim-type">Claim Type</SelectItem>
                <SelectItem value="claim-number">Claim Number</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Second Select (Status / Claim Type) */}
          {showSecondSelect && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {searchType === "status" ? "Select Status" : "Select Claim Type"}
              </label>

              <Select value={filterValue} onValueChange={(val) => {
                console.log("Selected Filter Value:", val);
                setFilterValue(val)
                submitForm(searchType, val)
              }}>
                <SelectTrigger className="bg-background border-input w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>

                  {Object.entries(
                    searchType === "status" ? STATUS_OPTIONS : CLAIM_TYPE_OPTIONS
                  ).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search Input */}
          {showSearchInput && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Search</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="E.g. 938 - 3716 - 5341"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background border-input"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground sm:px-8 w-full sm:w-auto cursor-pointer transition-all duration-150 ease-in-out hover:bg-primary/90 active:scale-95 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Search
                </Button>
              </div>
            </div>
          )}
        </div>


      </form >
    </div >
  )
}

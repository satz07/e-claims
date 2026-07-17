"use client"

import { useEffect, useState } from "react"
import { ClaimDetailCard } from "./claim-detail-card"
import {
  formatCareSetting,
  formatKes,
  formatPeriod,
  formatRecordUse,
  type ClaimRow,
} from "@/lib/claim-display"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

interface ResultsTableProps {
  results: ClaimRow[]
  isLoading: boolean
  page: number
  totalPages: number
  totalElements?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  detailMode?: boolean
}

function PaginationControls({
  page,
  totalPages,
  sizeDraft,
  setSizeDraft,
  onPageChange,
  onPageSizeChange,
  pageSize,
}: {
  page: number
  totalPages: number
  pageSize: number
  sizeDraft: string
  setSizeDraft: (v: string) => void
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  if (!onPageChange) return null

  const applySize = () => {
    if (!onPageSizeChange) return
    const n = parseInt(sizeDraft, 10)
    onPageSizeChange(Number.isFinite(n) ? n : pageSize)
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {onPageSizeChange && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">Per page</span>
          <Input
            type="number"
            min={1}
            max={100}
            value={sizeDraft}
            onChange={(e) => setSizeDraft(e.target.value)}
            onBlur={applySize}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applySize()
              }
            }}
            className="h-8 w-16 px-2 text-sm"
          />
        </label>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0 || totalPages <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-foreground whitespace-nowrap px-1">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages || 1}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages || totalPages <= 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function ResultsTable({
  results,
  isLoading,
  page,
  totalPages,
  totalElements = 0,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  detailMode = false,
}: ResultsTableProps) {
  const [sizeDraft, setSizeDraft] = useState(String(pageSize))

  useEffect(() => {
    setSizeDraft(String(pageSize))
  }, [pageSize])

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm font-medium text-primary">Fetching claims…</span>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        No FHIR claims found. Submit a claim via Submit FHIR, then search by Claim ID here.
      </p>
    )
  }

  if (detailMode && results.length === 1) {
    return <ClaimDetailCard claim={results[0]} />
  }

  const total = totalElements || results.length

  return (
    <div className="bg-background space-y-3">
      <div className="flex justify-end">
        <PaginationControls
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          sizeDraft={sizeDraft}
          setSizeDraft={setSizeDraft}
          onPageChange={onPageChange}
          onPageSizeChange={(size) => {
            setSizeDraft(String(size))
            onPageSizeChange?.(size)
          }}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-muted/80">
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Claim ID</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Use</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Facility</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Patient (CR)</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Scheme</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Intervention</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Period</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Total</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">Care</th>
            </tr>
          </thead>
          <tbody>
            {results.map((claim) => (
              <tr key={claim.claimNumber ?? claim.claimId} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-3 text-xs md:text-sm text-foreground font-mono">
                  <div className="max-w-[200px] truncate" title={claim.claimId}>
                    {claim.claimId}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">
                  {formatRecordUse(claim.recordUse)}
                </td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground">
                  <div className="whitespace-nowrap">{claim.fid}</div>
                  {claim.facilityLevel && claim.facilityLevel !== "—" && (
                    <div className="text-xs text-muted-foreground">{claim.facilityLevel}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.crId}</td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.schemeCode}</td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.interventionCode}</td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">
                  {formatPeriod(claim.dateFrom, claim.dateTo)}
                </td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap font-medium">
                  {formatKes(claim.claimedTotal)}
                </td>
                <td className="px-3 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">
                  {formatCareSetting(claim.ipsClaim)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground pt-1">
        Total <span className="font-medium text-foreground">{total}</span>{" "}
        claim{total === 1 ? "" : "s"}
      </p>
    </div>
  )
}

"use client"

import { ClaimDetailCard } from "./claim-detail-card"
import {
  formatCareSetting,
  formatKes,
  formatPeriod,
  formatRecordUse,
  type ClaimRow,
} from "@/lib/claim-display"

interface ResultsTableProps {
  results: ClaimRow[]
  isLoading: boolean
  page: number
  totalPages: number
  onPageChange?: (page: number) => void
  detailMode?: boolean
}

export function ResultsTable({
  results,
  isLoading,
  page,
  totalPages,
  onPageChange,
  detailMode = false,
}: ResultsTableProps) {
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

  return (
    <div className="bg-background">
      <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
        {results.length} claim{results.length === 1 ? "" : "s"}
      </h2>

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

      {onPageChange && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">Page {page + 1} of {totalPages}</span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

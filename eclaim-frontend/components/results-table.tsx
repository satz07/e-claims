"use client"

import { useEffect, useState } from "react"
import { ClaimDetailCard } from "./claim-detail-card"
import {
  formatCareSetting,
  formatKes,
  formatPeriod,
  formatRecordUse,
  shortHash,
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

function CopyableClaimId({
  claimId,
  claimIdHash,
}: {
  claimId?: string
  claimIdHash?: string
}) {
  const [copied, setCopied] = useState(false)

  // Prefer plaintext UUID when meta has it; otherwise full on-chain hash (never the truncated "0xabc…def")
  const full = (() => {
    const id = (claimId || "").trim()
    const hash = (claimIdHash || "").trim()
    if (id && !id.includes("…") && !id.includes("...")) return id
    if (hash) return hash
    if (id) return id.replace(/…/g, "").replace(/\.\.\./g, "")
    return ""
  })()

  if (!full || full === "—") {
    return <span className="text-muted-foreground">—</span>
  }

  const display = shortHash(full, 10, 8)

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`${full}\n\nClick to copy full ID`}
      className="group relative max-w-[220px] text-left font-mono text-xs md:text-sm text-foreground hover:text-primary underline-offset-2 hover:underline"
    >
      <span className="block truncate">{copied ? "Copied!" : display}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 bottom-full z-30 mb-1 hidden w-max max-w-[min(90vw,420px)] break-all rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] font-mono text-popover-foreground shadow-md group-hover:block"
      >
        {full}
        <span className="mt-1 block text-[10px] text-muted-foreground normal-case">
          Click to copy full ID
        </span>
      </span>
    </button>
  )
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

      <div className="overflow-x-auto overflow-y-visible rounded-lg border border-border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-muted/80">
              <th className="px-3 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">
                Claim ID <span className="font-normal text-muted-foreground">(hover / click to copy)</span>
              </th>
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
                <td className="px-3 py-3 text-xs md:text-sm text-foreground font-mono relative overflow-visible">
                  <CopyableClaimId claimId={claim.claimId} claimIdHash={claim.claimIdHash} />
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

"use client"
import { StatusBadge } from "./status-badge"

interface ResultsTableProps {
  results: any[]
  isLoading: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function ResultsTable({
  results,
  isLoading,
  page,
  totalPages,
  onPageChange,
}: ResultsTableProps) {
  console.log(isLoading, '=====isLoading=====')
  return (
    <div className="bg-background">
      <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">All Results</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Claim #</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Type</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">FID</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Claim ID</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Created</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Total</th>
              <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">Status</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <div className="flex justify-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-sm font-medium text-primary">
                      Fetching claims…
                    </span>
                  </div>
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted-foreground">
                  No data found
                </td>
              </tr>
            ) : (
              results.map((claim) => (
                <tr key={claim.claimNumber} className="border-b">
                  <td className="x-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.claimNumber}</td>
                  <td className="x-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.recordUse || claim.claimType}</td>
                  <td className="px-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.fid || claim.providerName}</td>
                  <td className="px-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">
                    <div className="max-w-[140px] md:max-w-[220px] truncate" title={claim.claimId}>
                      {claim.claimId}
                    </div>
                  </td>
                  <td className="x-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.creationDate}</td>
                  <td className="x-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">{claim.claimedTotal}</td>
                  <td className="x-2 md:px-4 py-3 text-xs md:text-sm text-foreground whitespace-nowrap">
                    <StatusBadge status={claim.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>

          <span className="text-sm">
            Page {page + 1} of {totalPages}
          </span>

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

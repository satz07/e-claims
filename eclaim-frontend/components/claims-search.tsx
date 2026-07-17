"use client"

import { useEffect, useState } from "react"
import { SearchForm } from "./search-form"
import { ResultsTable } from "./results-table"

export function ClaimsSearch() {
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchMode, setSearchMode] = useState<"list" | "claimId">("list")

  const base = () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

  const loadClaims = async (pageNo = 0) => {
    try {
      setLoading(true)
      setSearchMode("list")
      const url = new URL(`${base()}/api/public/eclaim-contract`)
      url.searchParams.set("page", pageNo.toString())
      url.searchParams.set("size", pageSize.toString())

      const res = await fetch(url.toString(), {
        headers: { accept: "application/json" },
      })
      if (!res.ok) throw new Error("Failed to fetch claims")

      const data = await res.json()
      setSearchResults(data?.claims || [])
      setTotalPages(data?.page?.totalPages || 0)
      setPage(pageNo)
    } catch (err: any) {
      setErrorMessage(err.message)
      setModalOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async ({ claimId }: { claimId: string }) => {
    try {
      setLoading(true)
      setSearchMode("claimId")
      const res = await fetch(`${base()}/api/public/eclaim-contract/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ claimId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || "Claim not found")
      }
      const claim = await res.json()
      setSearchResults([claim])
      setTotalPages(1)
      setPage(0)
    } catch (err: any) {
      setSearchResults([])
      setErrorMessage(err.message)
      setModalOpen(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClaims(0)
  }, [])

  return (
    <div className="space-y-8">
      <SearchForm
        onSearch={handleSearch}
        onClear={() => loadClaims(0)}
      />

      <ResultsTable
        results={searchResults}
        isLoading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={searchMode === "list" ? loadClaims : undefined}
        detailMode={searchMode === "claimId"}
      />

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-xl font-semibold mb-4">Error</h2>
            <p className="text-red-600">{errorMessage}</p>
            <button
              onClick={() => setModalOpen(false)}
              className="mt-6 w-full py-2 bg-blue-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

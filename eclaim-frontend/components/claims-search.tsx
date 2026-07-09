"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SearchForm } from "./search-form"
import { ResultsTable } from "./results-table"

export function ClaimsSearch() {
  const searchParams = useSearchParams()
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [status, setStatus] = useState<string | undefined>()
  const [type, setType] = useState<string | undefined>()

  const [page, setPage] = useState(0)
  const [pageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  /* ---------------- API ---------------- */

  const fetchClaims = async (
    status?: string,
    type?: string,
    page = 0,
    size = 10
  ) => {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"
    const url = new URL(`${base}/api/public/eclaim-contract`)

    url.searchParams.set("page", page.toString())
    url.searchParams.set("size", size.toString())

    const res = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    })

    if (!res.ok) {
      throw new Error("Failed to fetch claims")
    }

    return res.json()
  }

  /* ---------------- Loader ---------------- */

  const loadClaims = async (
    status?: string,
    type?: string,
    pageNo = 0
  ) => {
    try {
      setLoading(true)
      const data = await fetchClaims(status, type, pageNo, pageSize)
      setSearchResults(data?.claims || [])
      setTotalPages(data?.page?.totalPages || 0)
      setPage(pageNo)
    } catch (err: any) {
      setErrorMessage(err.message)
      setModalOpen(true)
    } finally {
      console.log('finally called')
      setLoading(false)
    }
  }

  /* ---------------- Search Handler ---------------- */

  const handleSearch = async (filters: any) => {
    try {
      if (filters.searchType === "status") {
        setStatus(filters.value)
        setType(undefined)
        loadClaims(filters.value, undefined, 0)
      }

      if (filters.searchType === "claim-type") {
        setType(filters.value)
        setStatus(undefined)
        loadClaims(undefined, filters.value, 0)
      }

      if (filters.searchType === "claim-number" && filters.value) {
        setLoading(true)
        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"
        const res = await fetch(`${base}/api/public/eclaim-contract/${filters.value}`)
        if (!res.ok) throw new Error("Claim not found")
        const claim = await res.json()
        setSearchResults([claim])
        setTotalPages(1)
        setPage(0)
      }
    } catch (err: any) {
      setErrorMessage(err.message)
      setModalOpen(true)
    }
  }

  /* ---------------- Initial Load ---------------- */

  useEffect(() => {
    const claimNumber = searchParams.get("claimNumber")
    if (claimNumber) {
      handleSearch({ searchType: "claim-number", value: claimNumber })
      return
    }
    loadClaims(undefined, undefined, 0)
  }, [searchParams])

  return (
    <div className="space-y-8">
      <SearchForm onSearch={handleSearch} />

      <ResultsTable
        results={searchResults}
        isLoading={loading}
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => loadClaims(status, type, p)}
      />

      {/* Error Modal */}
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

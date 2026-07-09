"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

const CLAIM_TYPES = [
    { value: "surgical",           label: "Surgical Claim" },
    { value: "approved",           label: "Approved Claim" },
    { value: "declined",           label: "Declined Claim" },
    { value: "maternity-inpatient",label: "Maternity Inpatient Claim" },
    { value: "patient",            label: "Patient" },
    { value: "rejected",           label: "Rejected Claim" },
    { value: "resubmitted",        label: "Resubmitted Claim" },
    { value: "sent-back",          label: "Sent Back Claim" },
]

type TabType = "search" | "duplicate"

export default function SearchClaimPage() {
    const [activeTab, setActiveTab] = useState<TabType>("search")

    /** ---------- Search Claim ---------- */
    const [claimId, setClaimId] = useState("")
    const [claimType, setClaimType] = useState("")
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /** ---------- Check Duplicate ---------- */
    const [fileType, setFileType] = useState("")
    const [duplicateValue, setDuplicateValue] = useState("")
    const [dupLoading, setDupLoading] = useState(false)
    const [dupResult, setDupResult] = useState<any>(null)

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

    const handleSearch = async () => {
        if (!claimId) {
            setError("Please enter a Claim ID.")
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch(`${base}/api/public/eclaim-contract/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claimId, claimType }),
            })

            if (!res.ok) {
                const text = await res.text()
                let message = text
                try { message = JSON.parse(text)?.message || text } catch { /* keep text */ }
                throw new Error(message || "Claim not found")
            }

            const data = await res.json()
            setResult(data)
        } catch (err: any) {
            setError(err.message || "Failed to fetch claim")
        } finally {
            setLoading(false)
        }
    }

    const handleCheckDuplicate = async () => {
        if (!fileType || !duplicateValue) return

        setDupLoading(true)
        setDupResult(null)

        try {
            const res = await fetch(`${base}/api/public/eclaim-contract/check-duplicate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claimId: duplicateValue, fileType }),
            })

            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || "Failed to check duplicate")
            }
            const isDuplicate: boolean = await res.clone().json()
            setDupResult(isDuplicate)
        } catch (err: any) {
            alert(err.message || "Duplicate check failed")
        } finally {
            setDupLoading(false)
        }
    }

    const unixToHuman = (unix: string | number) =>
        new Date(Number(unix) * 1000).toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
        })

    return (
        <div className="max-w-4xl">
            <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6">Claim Services</h1>

            {/* Tabs */}
            <div className="flex border-b border-border mb-6">
                {(["search", "duplicate"] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize
                            ${activeTab === tab
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-primary"
                            }`}
                    >
                        {tab === "search" ? "Search Claim" : "Record Check"}
                    </button>
                ))}
            </div>

            {/* Search Claim Tab */}
            {activeTab === "search" && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                className="pl-10 bg-background border-input"
                                placeholder="Enter Claim ID"
                                value={claimId}
                                onChange={(e) => setClaimId(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>

                        <Button onClick={handleSearch} disabled={loading || !claimId} className="sm:w-auto w-full">
                            {loading ? "Searching..." : "Search"}
                        </Button>
                    </div>

                    {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

                    {result && (
                        <div className="bg-card p-6 rounded-xl shadow space-y-3">
                            <Detail label="Claim Number"   value={result.claimNumber} />
                            <Detail label="Claim ID"       value={result.claimId} />
                            <Detail label="Claim Type"     value={result.claimType} />
                            <Detail label="Patient Name"   value={result.patientName} />
                            <Detail label="Provider Name"  value={result.providerName} />
                            <Detail label="SHA Code"       value={result.shaCode} />
                            <Detail label="Claimed Total"  value={result.claimedTotal} />
                            <Detail label="Approved Total" value={result.approvedTotal} />
                            <Detail label="Status"         value={result.status} />
                            <Detail label="Date From"      value={unixToHuman(result.dateFrom)} />
                            <Detail label="Date To"        value={unixToHuman(result.dateTo)} />
                        </div>
                    )}
                </>
            )}

            {/* Record Check Tab */}
            {activeTab === "duplicate" && (
                <div className="space-y-4 max-w-xl">
                    <Input
                        placeholder="Enter Claim ID to check"
                        value={duplicateValue}
                        onChange={(e) => setDuplicateValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCheckDuplicate()}
                    />

                    <Button onClick={handleCheckDuplicate} disabled={dupLoading || !duplicateValue}>
                        {dupLoading ? "Checking..." : "Record Check"}
                    </Button>

                    {dupResult !== null && (
                        <div className="bg-card p-4 rounded-lg border">
                            <p className="text-sm">
                                Record exists:{" "}
                                <span className={`font-semibold ${dupResult ? "text-red-600" : "text-green-600"}`}>
                                    {dupResult ? "Yes (duplicate)" : "No (available)"}
                                </span>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between border-b border-border pb-2">
            <span className="font-medium text-muted-foreground">{label}</span>
            <span className="break-all">{value}</span>
        </div>
    )
}

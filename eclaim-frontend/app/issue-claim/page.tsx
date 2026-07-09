"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWriteContract } from "wagmi"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { keccak256, stringToBytes } from "viem"
import { CONTRACT_ADDRESS, UPSERT_CLAIM_ABI } from "@/lib/contracts"
import { randomUuid } from "@/lib/utils"

const CLAIM_TYPES = [
    { value: "surgical",            label: "Surgical Claim" },
    { value: "approved",            label: "Approved Claim" },
    { value: "declined",            label: "Declined Claim" },
    { value: "maternity-inpatient", label: "Maternity Inpatient Claim" },
    { value: "patient",             label: "Patient" },
    { value: "rejected",            label: "Rejected Claim" },
    { value: "resubmitted",         label: "Resubmitted Claim" },
    { value: "sent-back",           label: "Sent Back Claim" },
]

const ZERO_HASH = `0x${"00".repeat(32)}` as `0x${string}`

/** Hash a string to bytes32 using UTF-8 encoding */
function h(s: string): `0x${string}` {
    if (!s) return ZERO_HASH
    return keccak256(stringToBytes(s))
}

function toUnixBigInt(date: string): bigint {
    return BigInt(Math.floor(new Date(date).getTime() / 1000))
}

/** Generate a compact uppercase SHA code from a seed string */
function generateShaCode(seed: string): string {
    const hash = keccak256(stringToBytes(seed))
    return "SHA" + hash.slice(2, 10).toUpperCase()
}

export default function IssueClaimPage() {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<{ txHash: string; claimNumber: number; claimId: string; shaCode: string } | null>(null)

    const [form, setForm] = useState({
        claimType: "",
        providerName: "",
        patientName: "",
        claimedTotal: "",
        dateFrom: "",
        dateTo: "",
    })

    const { writeContractAsync, isPending } = useWriteContract()

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async () => {
        setError(null)
        setSuccess(null)

        const { claimType, claimedTotal, dateFrom, dateTo } = form
        if (!claimType || !claimedTotal || !dateFrom || !dateTo) {
            setError("Please fill in all required fields.")
            return
        }

        // Auto-generate unique identifiers
        const claimNumber = Date.now()                          // unique uint256 from timestamp
        const claimId = randomUuid()                     // globally unique string ID
        const shaCode = generateShaCode(claimId + claimNumber)  // short readable hash

        try {
            const bundleId = randomUuid()
            const claimStruct = {
                claimIdHash:            h(claimId),
                claimNumber:            BigInt(claimNumber),
                bundleIdHash:           h(bundleId),
                bundleContentHash:      h(claimId + bundleId + claimedTotal),
                recordUseHash:          h("claim"),
                fidHash:                h(form.providerName || "FID-DEMO"),
                facilityLevelHash:      ZERO_HASH,
                schemeCodeHash:         h("CAT-SHA-001"),
                crIdHash:               h(form.patientName || "CR-DEMO"),
                nationalIdHash:         ZERO_HASH,
                claimTypeHash:          h(claimType),
                interventionCodeHash:   h("PMF-12-001"),
                creationDate:           BigInt(Math.floor(Date.now() / 1000)),
                dateFrom:               toUnixBigInt(dateFrom),
                dateTo:                 toUnixBigInt(dateTo),
                claimedTotal:           BigInt(claimedTotal),
                ipsClaim:               false,
                status:                 0,
            } as const

            const txHash = await writeContractAsync({
                address: CONTRACT_ADDRESS,
                abi: UPSERT_CLAIM_ABI,
                functionName: "upsertClaim",
                args: [claimStruct],
            })

            // Persist plaintext metadata in backend
            const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"
            fetch(`${base}/api/public/eclaim-contract/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    claimNumber,
                    claimId,
                    claimType,
                    patientName: form.patientName,
                    providerName: form.providerName,
                    shaCode,
                    claimedTotal,
                }),
            }).catch(() => { /* non-critical */ })

            setSuccess({ txHash, claimNumber, claimId, shaCode })
            setForm({ claimType: "", providerName: "", patientName: "", claimedTotal: "", dateFrom: "", dateTo: "" })
        } catch (err: any) {
            setError(err?.shortMessage || err?.message || "Transaction rejected")
        }
    }

    return (
        <div className="max-w-4xl">
            <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6">Issue Claim</h1>

            <div className="bg-card p-6 lg:p-8 rounded-xl shadow space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Claim Type *">
                        <Select
                            value={form.claimType}
                            onValueChange={(val) => setForm((prev) => ({ ...prev, claimType: val }))}
                        >
                            <SelectTrigger className="bg-background border-input w-full">
                                <SelectValue placeholder="Select Claim Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLAIM_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    <FormField label="Provider Name">
                        <Input name="providerName" value={form.providerName} placeholder="Provider Name" onChange={handleChange} />
                    </FormField>

                    <FormField label="Patient Name">
                        <Input name="patientName" value={form.patientName} placeholder="Patient Name" onChange={handleChange} />
                    </FormField>

                    <FormField label="Claimed Total *">
                        <Input name="claimedTotal" value={form.claimedTotal} placeholder="Amount" onChange={handleChange} />
                    </FormField>

                    <FormField label="Date From *">
                        <Input type="date" name="dateFrom" value={form.dateFrom} onChange={handleChange} />
                    </FormField>

                    <FormField label="Date To *">
                        <Input type="date" name="dateTo" value={form.dateTo} onChange={handleChange} />
                    </FormField>
                </div>

                <p className="text-xs text-muted-foreground">
                    Claim ID, SHA Code, and Claim Number are auto-generated on submission.
                </p>

                {error && <p className="text-sm text-red-600">{error}</p>}

                {success && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                        <p className="font-medium text-green-600">Claim submitted successfully!</p>
                        <p><span className="text-muted-foreground">Claim Number:</span> {success.claimNumber}</p>
                        <p><span className="text-muted-foreground">Claim ID:</span> <span className="font-mono break-all">{success.claimId}</span></p>
                        <p><span className="text-muted-foreground">SHA Code:</span> <span className="font-mono">{success.shaCode}</span></p>
                        <p><span className="text-muted-foreground">Tx:</span> <span className="font-mono break-all">{success.txHash}</span></p>
                    </div>
                )}

                <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
                    {isPending ? "Confirm in MetaMask..." : "Submit Claim"}
                </Button>
            </div>
        </div>
    )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm text-muted-foreground">{label}</label>
            {children}
        </div>
    )
}

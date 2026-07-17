"use client"

import { useState } from "react"
import Link from "next/link"
import { useWriteContract, useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { buildFullQaMisSample } from "@/lib/qa-mis-full-sample"
import { randomUuid } from "@/lib/utils"
import { CONTRACT_ADDRESS, CONTRACT_OWNER_ADDRESS, UPSERT_CLAIM_ABI } from "@/lib/contracts"
import { ACTIVE_NETWORK, explorerTxUrl } from "@/lib/network"
import { claimStructTuple, type PreparedClaimStruct } from "@/lib/claim-struct"
import { writeContractAndWait } from "@/lib/write-contract"

type RecordUse = "claim" | "preauthorization"
type SampleKind = "minimal" | "full"

const SAMPLE_CLAIM = `{
  "resourceType": "Bundle",
  "id": "REPLACE-BUNDLE-ID",
  "type": "message",
  "entry": [
    {
      "resource": {
        "resourceType": "Organization",
        "id": "FID-35-108719-7",
        "name": "ST. LEONARDS HOSPITAL",
        "extension": [{
          "url": "https://qa-mis.apeiro-digital.com/fhir/StructureDefinition/facility-level",
          "valueCodeableConcept": { "coding": [{ "code": "LEVEL 4" }] }
        }]
      }
    },
    {
      "resource": {
        "resourceType": "Coverage",
        "extension": [{ "url": "schemeCategoryCode", "valueString": "CAT-SHA-001" }]
      }
    },
    {
      "resource": {
        "resourceType": "Patient",
        "id": "CR3248022528592-4",
        "identifier": [{ "system": "nationalid", "value": "30360528" }]
      }
    },
    {
      "resource": {
        "resourceType": "Claim",
        "use": "claim",
        "identifier": [{
          "system": "https://qa-mis.apeiro-digital.com/fhir/claim",
          "value": "REPLACE-CLAIM-UUID"
        }],
        "type": { "coding": [{ "code": "institutional" }] },
        "subType": { "coding": [{ "code": "ip" }] },
        "total": { "value": 11000, "currency": "KES" },
        "billablePeriod": {
          "start": "2026-03-27T03:59:22+03:00",
          "end": "2026-03-29T17:00:47+03:00"
        },
        "created": "2024-12-03",
        "provider": { "reference": "Organization/FID-35-108719-7" },
        "patient": { "reference": "Patient/CR3248022528592-4" },
        "item": [{
          "productOrService": {
            "coding": [{ "code": "PMF-12-001", "display": "palliative care" }]
          }
        }]
      }
    }
  ]
}`

function withRecordUse(template: string, use: RecordUse, id: string) {
  const bundleId = randomUuid()
  const recordId = id || randomUuid()
  return template
    .replace("REPLACE-BUNDLE-ID", bundleId)
    .replace("REPLACE-CLAIM-UUID", recordId)
    .replace('"use": "claim"', `"use": "${use}"`)
}

export default function SubmitFhirPage() {
  const { isConnected, address } = useAccount()
  const { writeContractAsync, isPending: isTxPending } = useWriteContract()
  const [recordUse, setRecordUse] = useState<RecordUse>("claim")
  const [sampleKind, setSampleKind] = useState<SampleKind>("minimal")
  const [jsonText, setJsonText] = useState(() => withRecordUse(SAMPLE_CLAIM, "claim", randomUuid()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, string> | null>(null)

  const loadSample = (use: RecordUse, kind: SampleKind = sampleKind) => {
    setRecordUse(use)
    setSampleKind(kind)
    setJsonText(
      kind === "full"
        ? buildFullQaMisSample(use)
        : withRecordUse(SAMPLE_CLAIM, use, randomUuid()),
    )
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    if (!isConnected) {
      setError("Connect MetaMask first — your wallet signs and pays gas.")
      return
    }
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const body = JSON.parse(jsonText)
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"

      const prepRes = await fetch(`${base}/api/public/eclaim-contract/prepare-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      })
      const prepared = await prepRes.json()
      if (!prepRes.ok) {
        throw new Error(prepared?.message || prepared?.error || "Validation failed")
      }

      const claimStruct = prepared.claimStruct as PreparedClaimStruct
      const txHash = await writeContractAndWait(writeContractAsync, {
        address: CONTRACT_ADDRESS,
        abi: UPSERT_CLAIM_ABI,
        functionName: "upsertClaim",
        args: [claimStructTuple(claimStruct)],
      }, address)

      const metaRes = await fetch(`${base}/api/public/eclaim-contract/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          claimNumber: Number(claimStruct.claimNumber),
          source: "fhir",
          ...(prepared.meta ?? {}),
          claimedTotal: prepared.claimedTotal,
        }),
      })
      if (!metaRes.ok) {
        const metaErr = await metaRes.json().catch(() => ({}))
        throw new Error(metaErr?.message || "Claim anchored but metadata cache failed")
      }

      setResult({
        recordUse: prepared.recordUse,
        claimId: prepared.claimId,
        claimNumber: claimStruct.claimNumber,
        fid: prepared.fid,
        claimedTotal: prepared.claimedTotal,
        txHash,
        bundleHash: prepared.bundleHash,
      })
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string }
      setError(err?.shortMessage || err?.message || "Submit failed — confirm in MetaMask")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Submit FHIR to blockchain</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Paste a QA MIS FHIR Bundle (minimal or full institutional payload). The backend hashes the{" "}
          <strong>entire bundle</strong> for integrity and anchors only required fields on-chain.{" "}
          <code className="text-xs">Claim.use</code> = <strong>claim</strong> or{" "}
          <strong>preauthorization</strong>. Connect MetaMask as contract owner{" "}
          <code className="text-xs">{CONTRACT_OWNER_ADDRESS.slice(0, 6)}…{CONTRACT_OWNER_ADDRESS.slice(-4)}</code>
          {" "}(chain ID {ACTIVE_NETWORK.chainId}) — other accounts cannot write.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Minimal samples</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={recordUse === "claim" && sampleKind === "minimal" ? "default" : "outline"} onClick={() => loadSample("claim", "minimal")}>
            Sample claim
          </Button>
          <Button
            variant={recordUse === "preauthorization" && sampleKind === "minimal" ? "default" : "outline"}
            onClick={() => loadSample("preauthorization", "minimal")}
          >
            Sample pre-auth
          </Button>
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide pt-2">Full QA MIS bundle</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={recordUse === "claim" && sampleKind === "full" ? "default" : "outline"} onClick={() => loadSample("claim", "full")}>
            Full QA MIS claim
          </Button>
          <Button
            variant={recordUse === "preauthorization" && sampleKind === "full" ? "default" : "outline"}
            onClick={() => loadSample("preauthorization", "full")}
          >
            Full QA MIS pre-auth
          </Button>
        </div>
      </div>

      <textarea
        className="min-h-[480px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
      />

      <Button onClick={handleSubmit} disabled={loading || isTxPending}>
        {loading
          ? isTxPending
            ? "Confirm in MetaMask…"
            : "Waiting for confirmation…"
          : "Anchor on Chain"}
      </Button>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {result && (
        <div className="rounded-md border border-green-800 bg-green-950/40 p-4 text-sm space-y-2">
          <p><strong>recordUse:</strong> {result.recordUse}</p>
          <p><strong>claimId:</strong> {result.claimId}</p>
          <p><strong>claimNumber:</strong> {result.claimNumber}</p>
          <p><strong>FID:</strong> {result.fid}</p>
          <p><strong>claimedTotal:</strong> {result.claimedTotal} KES</p>
          <p className="break-all"><strong>txHash:</strong> {result.txHash}</p>
          <p className="break-all"><strong>bundleHash:</strong> {result.bundleHash}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">View claims</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={explorerTxUrl(result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on explorer
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

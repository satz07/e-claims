"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { buildFullQaMisSample } from "@/lib/qa-mis-full-sample"

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
  const bundleId = crypto.randomUUID()
  const recordId = id || crypto.randomUUID()
  return template
    .replace("REPLACE-BUNDLE-ID", bundleId)
    .replace("REPLACE-CLAIM-UUID", recordId)
    .replace('"use": "claim"', `"use": "${use}"`)
}

export default function SubmitFhirPage() {
  const [recordUse, setRecordUse] = useState<RecordUse>("claim")
  const [sampleKind, setSampleKind] = useState<SampleKind>("minimal")
  const [jsonText, setJsonText] = useState(() => withRecordUse(SAMPLE_CLAIM, "claim", crypto.randomUUID()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, string> | null>(null)

  const loadSample = (use: RecordUse, kind: SampleKind = sampleKind) => {
    setRecordUse(use)
    setSampleKind(kind)
    setJsonText(
      kind === "full"
        ? buildFullQaMisSample(use)
        : withRecordUse(SAMPLE_CLAIM, use, crypto.randomUUID()),
    )
    setError(null)
    setResult(null)
  }

  const handleSubmit = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const body = JSON.parse(jsonText)
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8001"
      const res = await fetch(`${base}/api/public/eclaim-contract/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Submit failed")
      }
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed")
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
          <strong>preauthorization</strong>. No wallet required.
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

      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? "Anchoring…" : "Anchor on Spearhead"}
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
              <Link href="/browse">View on browse claims</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://explorer.spearhead.adifoundation.ai/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Spearhead explorer
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

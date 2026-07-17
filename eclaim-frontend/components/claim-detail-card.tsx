"use client"

import {
  formatCareSetting,
  formatClaimType,
  formatKes,
  formatPeriod,
  formatRecordUse,
  shortHash,
  type ClaimRow,
} from "@/lib/claim-display"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground break-all">{value}</dd>
    </div>
  )
}

export function ClaimDetailCard({ claim }: { claim: ClaimRow }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Claim details</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Fields extracted from the anchored FHIR bundle (hashes stored on-chain; identifiers shown here for lookup).
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Field label="Claim ID" value={claim.claimId || "—"} />
        <Field label="Claim number (on-chain)" value={claim.claimNumber || "—"} />
        <Field label="Record use" value={formatRecordUse(claim.recordUse)} />
        <Field label="Claim type" value={formatClaimType(claim.claimType)} />
        <Field label="Care setting" value={formatCareSetting(claim.ipsClaim)} />
        <Field label="Facility ID (FID)" value={claim.fid || "—"} />
        <Field label="Facility level" value={claim.facilityLevel || "—"} />
        <Field label="Patient CR ID" value={claim.crId || "—"} />
        <Field label="Scheme code" value={claim.schemeCode || "—"} />
        <Field label="Intervention code" value={claim.interventionCode || "—"} />
        <Field label="Billable period" value={formatPeriod(claim.dateFrom, claim.dateTo)} />
        <Field label="Claimed total" value={formatKes(claim.claimedTotal)} />
        <Field label="Created" value={claim.creationDate || "—"} />
        <Field label="Bundle ID" value={claim.bundleId || "—"} />
        <Field label="Bundle hash (on-chain)" value={shortHash(claim.bundleHash, 12, 10)} />
      </dl>
    </div>
  )
}

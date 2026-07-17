export type ClaimRow = {
  claimNumber?: string
  claimId?: string
  recordUse?: string
  claimType?: string
  fid?: string
  crId?: string
  schemeCode?: string
  facilityLevel?: string
  interventionCode?: string
  bundleId?: string
  ipsClaim?: boolean
  claimedTotal?: string
  dateFrom?: string
  dateTo?: string
  creationDate?: string
  bundleHash?: string
  status?: string
}

export function formatRecordUse(use?: string): string {
  if (!use || use === "—") return "—"
  if (use === "preauthorization") return "Pre-authorization"
  if (use === "claim") return "Claim"
  return use
}

export function formatClaimType(type?: string): string {
  if (!type || type === "—") return "—"
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function formatKes(total?: string): string {
  if (!total || total === "—") return "—"
  const n = Number(total)
  if (Number.isNaN(n)) return total
  return `${new Intl.NumberFormat("en-KE").format(n)} KES`
}

export function formatCareSetting(ips?: boolean): string {
  if (ips === undefined || ips === null) return "—"
  return ips ? "Inpatient (IP)" : "Outpatient"
}

export function formatPeriod(from?: string, to?: string): string {
  if ((!from || from === "—") && (!to || to === "—")) return "—"
  if (from && to && from !== "—" && to !== "—") return `${from} → ${to}`
  return from && from !== "—" ? from : (to ?? "—")
}

export function shortHash(hash?: string, head = 10, tail = 8): string {
  if (!hash || hash === "—") return "—"
  if (hash.length <= head + tail + 3) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

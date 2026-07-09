export type PreparedClaimStruct = {
  claimIdHash: `0x${string}`
  claimNumber: string
  bundleIdHash: `0x${string}`
  bundleContentHash: `0x${string}`
  recordUseHash: `0x${string}`
  fidHash: `0x${string}`
  facilityLevelHash: `0x${string}`
  schemeCodeHash: `0x${string}`
  crIdHash: `0x${string}`
  nationalIdHash: `0x${string}`
  claimTypeHash: `0x${string}`
  interventionCodeHash: `0x${string}`
  creationDate: string
  dateFrom: string
  dateTo: string
  claimedTotal: string
  ipsClaim: boolean
  status: number
}

/** Tuple for ClaimRegistry.upsertClaim */
export function claimStructTuple(s: PreparedClaimStruct) {
  return {
    claimIdHash: s.claimIdHash,
    claimNumber: BigInt(s.claimNumber),
    bundleIdHash: s.bundleIdHash,
    bundleContentHash: s.bundleContentHash,
    recordUseHash: s.recordUseHash,
    fidHash: s.fidHash,
    facilityLevelHash: s.facilityLevelHash,
    schemeCodeHash: s.schemeCodeHash,
    crIdHash: s.crIdHash,
    nationalIdHash: s.nationalIdHash,
    claimTypeHash: s.claimTypeHash,
    interventionCodeHash: s.interventionCodeHash,
    creationDate: BigInt(s.creationDate),
    dateFrom: BigInt(s.dateFrom),
    dateTo: BigInt(s.dateTo),
    claimedTotal: BigInt(s.claimedTotal),
    ipsClaim: s.ipsClaim,
    status: s.status,
  } as const
}
